// ERP Sync Edge Function
// Pulls customers + ledger data from krazey_erp Supabase project
// and imports them into Krazey CRM with "Won" leads.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ErpCustomer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  gst_number: string | null;
  store_id: string;
  notes: string | null;
}

interface ErpLedgerEntry {
  customer_id: string;
  debit_amount: number;
  credit_amount: number;
  transaction_type: string;
  transaction_date: string;
  notes: string | null;
}

interface SyncResult {
  customers_created: number;
  customers_updated: number;
  leads_created: number;
  errors: string[];
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { business_id } = await req.json();

    if (!business_id) {
      return new Response(JSON.stringify({ error: 'business_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize CRM Supabase client (this project)
    const crmClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Load ERP connection config from this business's settings
    const { data: business, error: bizError } = await crmClient
      .from('businesses')
      .select('id, erp_supabase_url, erp_supabase_anon_key, erp_enabled')
      .eq('id', business_id)
      .single();

    if (bizError || !business) {
      return new Response(JSON.stringify({ error: 'Business not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!business.erp_enabled) {
      return new Response(JSON.stringify({ error: 'ERP integration is not enabled for this business' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!business.erp_supabase_url || !business.erp_supabase_anon_key) {
      return new Response(JSON.stringify({ error: 'ERP Supabase credentials are not configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create a sync log entry
    const { data: syncLog, error: logError } = await crmClient
      .from('erp_sync_logs')
      .insert({
        business_id,
        status: 'running',
      })
      .select('id')
      .single();

    if (logError || !syncLog) {
      throw new Error('Failed to create sync log: ' + logError?.message);
    }

    const syncLogId = syncLog.id;
    const result: SyncResult = { customers_created: 0, customers_updated: 0, leads_created: 0, errors: [] };

    try {
      // Connect to ERP Supabase project
      const erpClient = createClient(
        business.erp_supabase_url,
        business.erp_supabase_anon_key
      );

      // Step 1: Fetch all ERP customers
      const { data: erpCustomers, error: erpCustError } = await erpClient
        .from('customers')
        .select('id, name, phone, email, address, gst_number, store_id, notes');

      if (erpCustError) throw new Error('Failed to fetch ERP customers: ' + erpCustError.message);
      if (!erpCustomers || erpCustomers.length === 0) {
        await finalizeSyncLog(crmClient, syncLogId, 'success', result, business_id);
        return new Response(JSON.stringify({ success: true, message: 'No customers found in ERP', ...result }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Step 2: Fetch all customer ledger entries from ERP
      const erpCustomerIds = erpCustomers.map((c: ErpCustomer) => c.id);
      const { data: allLedgerEntries, error: ledgerError } = await erpClient
        .from('customer_ledger')
        .select('customer_id, debit_amount, credit_amount, transaction_type, transaction_date, notes')
        .in('customer_id', erpCustomerIds);

      if (ledgerError) throw new Error('Failed to fetch ERP ledger: ' + ledgerError.message);

      // Build a map: erp_customer_id → aggregated ledger data
      const ledgerMap = new Map<string, { totalDebit: number; totalCredit: number; lastDate: string | null; entries: ErpLedgerEntry[] }>();
      for (const entry of (allLedgerEntries || []) as ErpLedgerEntry[]) {
        if (!ledgerMap.has(entry.customer_id)) {
          ledgerMap.set(entry.customer_id, { totalDebit: 0, totalCredit: 0, lastDate: null, entries: [] });
        }
        const agg = ledgerMap.get(entry.customer_id)!;
        agg.totalDebit += Number(entry.debit_amount ?? 0);
        agg.totalCredit += Number(entry.credit_amount ?? 0);
        agg.entries.push(entry);
        if (!agg.lastDate || entry.transaction_date > agg.lastDate) {
          agg.lastDate = entry.transaction_date;
        }
      }

      // Step 3: Fetch ERP sales order totals for deal value
      const { data: salesOrders } = await erpClient
        .from('sales_orders')
        .select('customer_id, total_amount')
        .in('customer_id', erpCustomerIds);

      // Build map: erp_customer_id → total billed from sales orders
      const salesMap = new Map<string, number>();
      for (const order of (salesOrders || [])) {
        const prev = salesMap.get(order.customer_id) ?? 0;
        salesMap.set(order.customer_id, prev + Number(order.total_amount ?? 0));
      }

      // Step 4: Process each ERP customer into CRM
      for (const erpCust of erpCustomers as ErpCustomer[]) {
        try {
          const ledgerData = ledgerMap.get(erpCust.id);
          const outstandingBalance = ledgerData ? ledgerData.totalDebit - ledgerData.totalCredit : 0;
          const totalBilled = salesMap.get(erpCust.id) ?? (ledgerData?.totalDebit ?? 0);
          const totalPaid = ledgerData?.totalCredit ?? 0;
          const lastTransDate = ledgerData?.lastDate ?? null;

          // Check if this ERP customer already exists in CRM
          let { data: existingCustomer } = await crmClient
            .from('customers')
            .select('id, erp_customer_id')
            .eq('business_id', business_id)
            .eq('erp_customer_id', erpCust.id)
            .maybeSingle();

          // If not found by erp_customer_id, try by phone
          if (!existingCustomer && erpCust.phone) {
            const { data: byPhone } = await crmClient
              .from('customers')
              .select('id, erp_customer_id')
              .eq('business_id', business_id)
              .eq('phone', erpCust.phone)
              .maybeSingle();
            existingCustomer = byPhone;
          }

          // If not found by phone, try by GST
          if (!existingCustomer && erpCust.gst_number) {
            const { data: byGst } = await crmClient
              .from('customers')
              .select('id, erp_customer_id')
              .eq('business_id', business_id)
              .eq('gst_number', erpCust.gst_number)
              .maybeSingle();
            existingCustomer = byGst;
          }

          let crmCustomerId: string;
          let isNewCustomer = false;

          if (existingCustomer) {
            // Update existing customer's ERP fields
            const { error: updateErr } = await crmClient
              .from('customers')
              .update({
                erp_customer_id: erpCust.id,
                erp_source: true,
                outstanding_balance: outstandingBalance,
                // Sync contact details from ERP if missing in CRM
                email: erpCust.email,
                address: erpCust.address,
                gst_number: erpCust.gst_number,
              })
              .eq('id', existingCustomer.id);

            if (updateErr) throw new Error(`Update customer ${erpCust.name} failed: ${updateErr.message}`);
            crmCustomerId = existingCustomer.id;
            result.customers_updated++;
          } else {
            // Create new CRM customer
            const { data: newCust, error: createErr } = await crmClient
              .from('customers')
              .insert({
                business_id,
                name: erpCust.name,
                phone: erpCust.phone ?? '',
                email: erpCust.email,
                address: erpCust.address,
                gst_number: erpCust.gst_number,
                notes: erpCust.notes,
                tags: ['ERP Customer'],
                erp_customer_id: erpCust.id,
                erp_source: true,
                outstanding_balance: outstandingBalance,
              })
              .select('id')
              .single();

            if (createErr || !newCust) throw new Error(`Create customer ${erpCust.name} failed: ${createErr?.message}`);
            crmCustomerId = newCust.id;
            isNewCustomer = true;
            result.customers_created++;
          }

          // Step 5: If new customer, create a "Won" lead
          if (isNewCustomer) {
            const { error: leadErr } = await crmClient
              .from('leads')
              .insert({
                business_id,
                customer_id: crmCustomerId,
                stage: 'Won',                   // ERP customers are always won
                source: 'erp_import',
                priority: 'low',
                expected_deal_value: totalBilled,
              });

            if (leadErr) throw new Error(`Create lead for ${erpCust.name} failed: ${leadErr.message}`);
            result.leads_created++;
          }

          // Step 6: Upsert ledger snapshot
          const { error: ledgerUpsertErr } = await crmClient
            .from('erp_ledgers')
            .upsert({
              business_id,
              customer_id: crmCustomerId,
              erp_customer_id: erpCust.id,
              erp_customer_name: erpCust.name,
              outstanding_balance: outstandingBalance,
              total_billed: totalBilled,
              total_paid: totalPaid,
              last_transaction_date: lastTransDate,
              ledger_entries: ledgerData?.entries ?? [],
              synced_at: new Date().toISOString(),
            }, { onConflict: 'business_id,erp_customer_id' });

          if (ledgerUpsertErr) {
            result.errors.push(`Ledger upsert for ${erpCust.name}: ${ledgerUpsertErr.message}`);
          }
        } catch (custErr) {
          result.errors.push((custErr as Error).message);
        }
      }

      // Update business last_synced_at
      await crmClient
        .from('businesses')
        .update({ erp_last_synced_at: new Date().toISOString() })
        .eq('id', business_id);

      await finalizeSyncLog(crmClient, syncLogId, 'success', result, business_id);

      return new Response(
        JSON.stringify({ success: true, ...result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (innerErr) {
      result.errors.push((innerErr as Error).message);
      await finalizeSyncLog(crmClient, syncLogId, 'failed', result, business_id);
      throw innerErr;
    }
  } catch (err) {
    console.error('ERP Sync error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function finalizeSyncLog(
  crmClient: ReturnType<typeof createClient>,
  logId: string,
  status: 'success' | 'failed',
  result: SyncResult,
  _businessId: string
) {
  await crmClient
    .from('erp_sync_logs')
    .update({
      status,
      customers_created: result.customers_created,
      customers_updated: result.customers_updated,
      leads_created: result.leads_created,
      errors: result.errors,
      finished_at: new Date().toISOString(),
    })
    .eq('id', logId);
}
