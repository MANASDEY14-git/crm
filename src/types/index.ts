export interface Business {
  id: string;
  name: string;
  created_at: string;
  ycloud_api_key?: string | null;
  ycloud_sender_phone?: string | null;
  whatsapp_provider?: string | null;
  openwa_api_url?: string | null;
  openwa_api_key?: string | null;
  openwa_session_id?: string | null;
  // ERP Integration
  erp_supabase_url?: string | null;
  erp_supabase_anon_key?: string | null;
  erp_sync_schedule?: string | null;
  erp_last_synced_at?: string | null;
  erp_enabled?: boolean;
}

export interface Profile {
  id: string;
  business_id: string | null;
  email: string;
  full_name: string | null;
  role: 'admin' | 'sales_staff';
  created_at: string;
}

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  phone: string;
  email: string | null;
  tags: string[];
  assigned_staff_id: string | null;
  created_at: string;
  address?: string | null;
  gst_number?: string | null;
  notes?: string | null;
  // ERP fields
  erp_customer_id?: string | null;
  erp_source?: boolean;
  outstanding_balance?: number;
  // Joins
  assigned_staff?: Profile;
}

export interface Lead {
  id: string;
  business_id: string;
  customer_id: string;
  stage: 'New Inquiry' | 'Contacted' | 'Interested' | 'Follow-up Pending' | 'Quotation Sent' | 'Won' | 'Lost';
  expected_deal_value: number;
  priority: 'low' | 'medium' | 'high';
  follow_up_date: string | null;
  created_at: string;
  source?: 'manual' | 'whatsapp' | 'erp_import';
  // Joins
  customer?: Customer;
}

export interface ErpLedger {
  id: string;
  business_id: string;
  customer_id: string;
  erp_customer_id: string;
  erp_customer_name: string | null;
  outstanding_balance: number;
  total_billed: number;
  total_paid: number;
  last_transaction_date: string | null;
  ledger_entries: ErpLedgerEntry[];
  synced_at: string;
}

export interface ErpLedgerEntry {
  customer_id: string;
  debit_amount: number;
  credit_amount: number;
  transaction_type: string;
  transaction_date: string;
  notes: string | null;
}

export interface ErpSyncLog {
  id: string;
  business_id: string;
  status: 'running' | 'success' | 'failed';
  customers_created: number;
  customers_updated: number;
  leads_created: number;
  errors: string[];
  started_at: string;
  finished_at: string | null;
}

export interface Conversation {
  id: string;
  business_id: string;
  customer_id: string;
  last_message: string | null;
  last_message_at: string;
  unread_count: number;
  created_at: string;
  // Joins
  customer?: Customer;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_type: 'customer' | 'staff';
  sender_id: string | null;
  content: string;
  attachment_url: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  business_id: string;
  customer_id: string;
  type: 'Call' | 'WhatsApp Follow-up' | 'Meeting' | 'Callback';
  due_date: string;
  assigned_staff_id: string | null;
  status: 'pending' | 'completed';
  created_at: string;
  // Joins
  customer?: Customer;
  assigned_staff?: Profile;
}

export interface Note {
  id: string;
  business_id: string;
  customer_id: string;
  content: string;
  author_id: string | null;
  created_at: string;
  // Joins
  author?: Profile;
}
