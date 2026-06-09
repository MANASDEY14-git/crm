import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Customer, Lead, Task, Note, Profile, ErpLedger } from '../../types';
import { 
  Users, 
  Search, 
  Phone, 
  Mail, 
  Tag, 
  Calendar, 
  Clock, 
  FileText, 
  Plus, 
  Check, 
  Trash2,
  TrendingUp,
  ChevronRight,
  UserCheck,
  Building,
  Database,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';

interface CustomersProps {
  selectedCustomerId: string | null;
  setSelectedCustomerId: (id: string | null) => void;
  setCurrentTab: (tab: string) => void;
}

export const Customers: React.FC<CustomersProps> = ({ 
  selectedCustomerId, 
  setSelectedCustomerId,
  setCurrentTab
}) => {
  const { business, profile } = useAuth();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Right details states
  const [custDetails, setCustDetails] = useState<any | null>(null);
  const [activityFeed, setActivityFeed] = useState<any[]>([]);
  
  // Add item states
  const [newNote, setNewNote] = useState('');
  const [newTaskType, setNewTaskType] = useState<'Call' | 'Follow-up' | 'Meeting' | 'Callback'>('Call');
  const [newTaskDate, setNewTaskDate] = useState('');
  const [newTagText, setNewTagText] = useState('');

  // Billing edit states
  const [isEditingBilling, setIsEditingBilling] = useState(false);
  const [editAddress, setEditAddress] = useState('');
  const [editGst, setEditGst] = useState('');

  // ERP Ledger state
  const [erpLedger, setErpLedger] = useState<ErpLedger | null>(null);

  useEffect(() => {
    if (business) {
      fetchCustomers();
    }
  }, [business]);

  useEffect(() => {
    if (selectedCustomerId && business) {
      fetchCustomerDetails(selectedCustomerId);
      fetchErpLedger(selectedCustomerId);
    } else {
      setCustDetails(null);
      setActivityFeed([]);
      setErpLedger(null);
    }
  }, [selectedCustomerId, business]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*, leads(*)')
        .eq('business_id', business?.id)
        .order('name');

      if (error) throw error;
      setCustomers(data || []);
      
      // Auto-select first customer if none selected on desktop
      if (data && data.length > 0 && !selectedCustomerId && window.innerWidth >= 768) {
        setSelectedCustomerId(data[0].id);
      }
    } catch (e) {
      console.error('Error fetching customers:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchErpLedger = async (custId: string) => {
    try {
      const { data } = await supabase
        .from('erp_ledgers')
        .select('*')
        .eq('customer_id', custId)
        .maybeSingle();
      setErpLedger(data as ErpLedger | null);
    } catch (e) {
      console.error('Error fetching ERP ledger:', e);
    }
  };

  const fetchCustomerDetails = async (custId: string) => {
    try {
      const { data: customer, error } = await supabase
        .from('customers')
        .select('*, leads(*), tasks(*, assigned_staff:profiles(*)), notes(*, author:profiles(*))')
        .eq('id', custId)
        .single();

      if (error) throw error;
      setCustDetails(customer);

      // Create a unified Activity Feed / Timeline
      const timeline: any[] = [];

      // 1. Add notes
      customer.notes?.forEach((n: any) => {
        timeline.push({
          id: n.id,
          type: 'note',
          content: n.content,
          author: n.author?.full_name || 'Staff',
          date: new Date(n.created_at),
          rawDate: n.created_at
        });
      });

      // 2. Add tasks
      customer.tasks?.forEach((t: any) => {
        timeline.push({
          id: t.id,
          type: 'task',
          content: `Scheduled a ${t.type} (Due: ${new Date(t.due_date).toLocaleDateString()})`,
          status: t.status,
          author: t.assigned_staff?.full_name || 'Staff',
          date: new Date(t.created_at),
          rawDate: t.created_at
        });
      });

      // 3. Add lead creation
      customer.leads?.forEach((l: any) => {
        timeline.push({
          id: l.id,
          type: 'lead',
          content: `Lead Pipeline initialized at stage: ${l.stage} (Value: ₹${l.expected_deal_value.toLocaleString('en-IN')})`,
          date: new Date(l.created_at),
          rawDate: l.created_at
        });
      });

      // Sort timeline descending
      timeline.sort((a, b) => b.date.getTime() - a.date.getTime());
      setActivityFeed(timeline);
    } catch (e) {
      console.error('Error fetching customer details:', e);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !custDetails || !business) return;

    try {
      const { error } = await supabase.from('notes').insert({
        business_id: business.id,
        customer_id: custDetails.id,
        content: newNote,
        author_id: profile?.id || null
      });

      if (error) throw error;
      setNewNote('');
      fetchCustomerDetails(custDetails.id);
    } catch (e) {
      console.error('Error adding note:', e);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskDate || !custDetails || !business) return;

    try {
      const { error } = await supabase.from('tasks').insert({
        business_id: business.id,
        customer_id: custDetails.id,
        type: newTaskType,
        due_date: new Date(newTaskDate).toISOString(),
        assigned_staff_id: profile?.id || null,
        status: 'pending'
      });

      if (error) throw error;
      setNewTaskDate('');
      fetchCustomerDetails(custDetails.id);
    } catch (e) {
      console.error('Error adding task:', e);
    }
  };

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagText.trim() || !custDetails) return;

    const newTags = [...(custDetails.tags || []), newTagText.trim()];
    try {
      const { error } = await supabase
        .from('customers')
        .update({ tags: newTags })
        .eq('id', custDetails.id);

      if (error) throw error;
      setNewTagText('');
      fetchCustomerDetails(custDetails.id);
      fetchCustomers();
    } catch (e) {
      console.error('Error adding tag:', e);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!custDetails) return;
    if (!confirm(`Are you sure you want to delete customer ${custDetails.name}? All chats, leads, and tasks will be deleted.`)) return;

    try {
      const { error } = await supabase.from('customers').delete().eq('id', custDetails.id);
      if (error) throw error;
      
      setSelectedCustomerId(null);
      fetchCustomers();
    } catch (e) {
      console.error('Error deleting customer:', e);
    }
  };

  // Filter list
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery) ||
    (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex-1 flex overflow-hidden h-[calc(100vh-4rem)]">
      
      {/* LEFT LIST: Customers Directory */}
      <div className={cn(
        "w-full md:w-80 lg:w-96 border-r border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-950 flex flex-col shrink-0 z-10",
        selectedCustomerId ? "hidden md:flex" : "flex"
      )}>
        
        {/* Search */}
        <div className="p-4 border-b border-zinc-200/50 dark:border-zinc-800/50">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-zinc-400" size={16} />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/20 focus:outline-none focus:ring-1 focus:ring-emerald-600 text-zinc-900 dark:text-zinc-50"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-900">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent"></div>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-400">
              No customers found. Click Quick Add to create one.
            </div>
          ) : (
            filteredCustomers.map(c => {
              const isSelected = selectedCustomerId === c.id;

              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCustomerId(c.id)}
                  className={cn(
                    "w-full flex items-center justify-between p-4 text-left transition-colors cursor-pointer relative",
                    isSelected 
                      ? "bg-zinc-50 dark:bg-zinc-900/50" 
                      : "hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20"
                  )}
                >
                  {isSelected && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-600"></div>
                  )}

                  <div className="flex items-center gap-3 truncate">
                    <div className="h-9 w-9 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0">
                      {c.name.charAt(0)}
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">{c.name}</h4>
                        {c.erp_source && (
                          <span className="shrink-0 flex items-center gap-0.5 text-[8px] font-bold bg-indigo-100 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-full">
                            <Database size={8} /> ERP
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-0.5">{c.phone}</p>
                    </div>
                  </div>

                  <ChevronRight size={14} className="text-zinc-300" />
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Details Profile timeline view */}
      <div className={cn(
        "flex-1 flex flex-col bg-zinc-50/30 dark:bg-zinc-950/20 overflow-y-auto p-6 space-y-6",
        selectedCustomerId ? "flex" : "hidden md:flex"
      )}>
        {custDetails ? (
          <div className="max-w-4xl w-full mx-auto space-y-6">
            
            {/* Mobile Back button */}
            <button
              onClick={() => setSelectedCustomerId(null)}
              className="md:hidden text-xs font-semibold text-zinc-500 hover:text-zinc-800 flex items-center gap-1 cursor-pointer"
            >
              ← Back to list
            </button>

            {/* Profile Header Card */}
            <div className="p-6 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
                  {custDetails.name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{custDetails.name}</h2>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-1.5 mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="flex items-center gap-1"><Phone size={13} />{custDetails.phone}</span>
                    {custDetails.email && <span className="flex items-center gap-1"><Mail size={13} />{custDetails.email}</span>}
                  </div>
                </div>
              </div>

              {/* Header Actions */}
              <div className="flex flex-wrap gap-2.5">
                <button
                  onClick={() => {
                    setSelectedCustomerId(custDetails.id);
                    setCurrentTab('inbox');
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3.5 py-2 rounded-xl shadow-md cursor-pointer transition-colors"
                >
                  Open Chat Inbox
                </button>
                <button
                  onClick={handleDeleteCustomer}
                  className="p-2 border border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-red-500 rounded-xl cursor-pointer"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Grid Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Profile Details (Left col) */}
              <div className="space-y-6">
                
                {/* ERP Ledger Card — shown only for ERP-synced customers */}
                {custDetails.erp_source && (
                  <div className="p-4 rounded-2xl border border-indigo-200/40 dark:border-indigo-900/30 bg-indigo-50/30 dark:bg-indigo-950/10 shadow-sm space-y-3">
                    <div className="flex items-center gap-1.5">
                      <Database size={13} className="text-indigo-500" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-500 dark:text-indigo-400">ERP Ledger</h3>
                    </div>

                    {erpLedger ? (
                      <>
                        {/* Outstanding Balance — primary metric */}
                        <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-indigo-100/50 dark:border-indigo-900/20">
                          <span className="text-[10px] text-zinc-400 font-medium">Outstanding Balance</span>
                          <p className={cn(
                            'text-xl font-extrabold mt-0.5',
                            erpLedger.outstanding_balance > 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          )}>
                            {formatCurrency(Math.abs(erpLedger.outstanding_balance))}
                            {erpLedger.outstanding_balance > 0 && (
                              <span className="ml-1.5 text-[10px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/20 px-1.5 py-0.5 rounded-full">DUES</span>
                            )}
                            {erpLedger.outstanding_balance <= 0 && (
                              <span className="ml-1.5 text-[10px] font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded-full">CLEAR</span>
                            )}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-zinc-400">Total Billed</span>
                            <span className="font-bold text-zinc-700 dark:text-zinc-300">{formatCurrency(erpLedger.total_billed)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-zinc-400">Total Paid</span>
                            <span className="font-bold text-emerald-600">{formatCurrency(erpLedger.total_paid)}</span>
                          </div>
                          {erpLedger.last_transaction_date && (
                            <div className="flex justify-between text-xs">
                              <span className="text-zinc-400">Last Transaction</span>
                              <span className="font-semibold text-zinc-600 dark:text-zinc-400">
                                {new Date(erpLedger.last_transaction_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="pt-2 border-t border-indigo-100/50 dark:border-indigo-900/20">
                          <p className="text-[9px] text-zinc-400">
                            Last synced: {new Date(erpLedger.synced_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                          </p>
                          {custDetails.erp_customer_id && (
                            <p className="text-[9px] font-mono text-zinc-400 mt-0.5">ERP ID: {custDetails.erp_customer_id}</p>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="py-4 text-center">
                        <RefreshCw size={18} className="text-indigo-300 mx-auto mb-1.5" />
                        <p className="text-[10px] text-zinc-400 italic">No ledger data yet. Run ERP sync in Settings.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Lead Status */}
                <div className="p-4 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Pipeline Status</h3>
                  
                  {custDetails.leads?.[0] ? (
                    <div className="space-y-3">
                      <div>
                        <span className="text-[10px] text-zinc-400">Current Stage</span>
                        <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-0.5">{custDetails.leads[0].stage}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-400 font-medium">Deal Value</span>
                        <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                          {formatCurrency(custDetails.leads[0].expected_deal_value)}
                        </p>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[10px] text-zinc-400">Priority:</span>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase",
                          custDetails.leads[0].priority === 'high' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-850 dark:text-zinc-400'
                        )}>
                          {custDetails.leads[0].priority}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="py-4 text-center">
                      <p className="text-xs text-zinc-400 italic">No active deal pipeline.</p>
                      <button 
                        onClick={async () => {
                          await supabase.from('leads').insert({
                            business_id: business?.id,
                            customer_id: custDetails.id,
                            stage: 'New Inquiry',
                            expected_deal_value: 0,
                            priority: 'medium'
                          });
                          fetchCustomerDetails(custDetails.id);
                        }}
                        className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 font-semibold mx-auto hover:underline cursor-pointer"
                      >
                        <Plus size={12} />
                        Initialize Lead
                      </button>
                    </div>
                  )}
                </div>

                {/* Store & Billing Card */}
                <div className="p-4 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
                      <Building size={13} className="text-emerald-600" />
                      Store & Billing
                    </h3>
                    <button onClick={() => {
                      setIsEditingBilling(!isEditingBilling);
                      setEditAddress(custDetails.address || '');
                      setEditGst(custDetails.gst_number || '');
                    }} className="text-xs text-emerald-600 hover:underline">
                      {isEditingBilling ? 'Cancel' : 'Edit'}
                    </button>
                  </div>
                  {isEditingBilling ? (
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      try {
                        const { error } = await supabase.from('customers').update({
                          address: editAddress || null,
                          gst_number: editGst || null,
                        }).eq('id', custDetails.id);
                        if (error) throw error;
                        setIsEditingBilling(false);
                        fetchCustomerDetails(custDetails.id);
                      } catch (e) {
                        console.error('Error updating billing:', e);
                      }
                    }} className="space-y-2">
                      <input type="text" placeholder="Billing Address" value={editAddress} onChange={e => setEditAddress(e.target.value)} className="w-full px-2 py-1 text-xs border rounded" />
                      <input type="text" placeholder="GSTIN" value={editGst} onChange={e => setEditGst(e.target.value)} className="w-full px-2 py-1 text-xs border rounded" />
                      <button type="submit" className="px-3 py-1 bg-emerald-600 text-white text-xs rounded">Save</button>
                    </form>
                  ) : (
                    <>
                      {custDetails.address && (
                        <div>
                          <span className="text-[10px] text-zinc-400 font-medium">Billing Address</span>
                          <p className="text-xs text-zinc-700 dark:text-zinc-300 mt-0.5 whitespace-pre-wrap">{custDetails.address}</p>
                        </div>
                      )}
                      {!custDetails.address && (
                        <div>
                          <span className="text-[10px] text-zinc-400 font-medium">Billing Address</span>
                          <p className="text-xs text-zinc-400 italic mt-0.5">Not Provided</p>
                        </div>
                      )}
                      {custDetails.gst_number && (
                        <div className="pt-1">
                          <span className="text-[10px] text-zinc-400 font-medium">GSTIN</span>
                          <p className="text-xs font-mono font-bold text-zinc-800 dark:text-zinc-200 mt-0.5">{custDetails.gst_number}</p>
                        </div>
                      )}
                      {!custDetails.gst_number && (
                        <div className="pt-1">
                          <span className="text-[10px] text-zinc-400 font-medium">GSTIN</span>
                          <p className="text-xs text-zinc-400 italic mt-0.5">Not Provided</p>
                        </div>
                      )}
                      {custDetails.notes && (
                        <div className="pt-1 border-t border-zinc-100 dark:border-zinc-800/50">
                          <span className="text-[10px] text-zinc-400 font-medium">ERP Notes</span>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 italic">{custDetails.notes}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Tags Card */}
                <div className="p-4 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Customer Tags</h3>
                  <div className="flex flex-wrap gap-1">
                    {custDetails.tags?.map((t: string, idx: number) => (
                      <span key={idx} className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                        {t}
                      </span>
                    ))}
                  </div>

                  <form onSubmit={handleAddTag} className="flex gap-2 pt-2 border-t border-zinc-50 dark:border-zinc-900/60">
                    <input
                      type="text"
                      required
                      placeholder="Add tag..."
                      value={newTagText}
                      onChange={e => setNewTagText(e.target.value)}
                      className="flex-1 px-2.5 py-1 text-[10px] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 focus:outline-none"
                    />
                    <button 
                      type="submit"
                      className="px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-semibold cursor-pointer"
                    >
                      Add
                    </button>
                  </form>
                </div>

                {/* Quick Task Scheduler */}
                <div className="p-4 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Quick Task</h3>
                  <form onSubmit={handleAddTask} className="space-y-3">
                    <select
                      value={newTaskType}
                      onChange={e => setNewTaskType(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200"
                    >
                      <option value="Call">Call</option>
                      <option value="Follow-up">Follow-up</option>
                      <option value="Meeting">Meeting</option>
                      <option value="Callback">Callback</option>
                    </select>
                    
                    <input
                      type="datetime-local"
                      required
                      value={newTaskDate}
                      onChange={e => setNewTaskDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200"
                    />

                    <button 
                      type="submit"
                      className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-sm"
                    >
                      Schedule Task
                    </button>
                  </form>
                </div>

              </div>

              {/* Feed & Timeline logs (Right col) */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Notes Input */}
                <div className="p-4 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 shadow-sm">
                  <form onSubmit={handleAddNote} className="flex gap-3">
                    <input
                      type="text"
                      required
                      placeholder="Write a timeline update or internal note..."
                      value={newNote}
                      onChange={e => setNewNote(e.target.value)}
                      className="flex-1 px-4 py-2.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-emerald-600 text-zinc-800 dark:text-zinc-200"
                    />
                    <button 
                      type="submit"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl cursor-pointer shadow-sm transition-colors"
                    >
                      Save Note
                    </button>
                  </form>
                </div>

                {/* Timeline */}
                <div className="p-6 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Activity & Notes Timeline</h3>
                  
                  {activityFeed.length === 0 ? (
                    <p className="text-xs text-zinc-400 italic py-8 text-center">No activities recorded yet.</p>
                  ) : (
                    <div className="relative border-l-2 border-zinc-100 dark:border-zinc-800/60 pl-6 ml-3 space-y-6">
                      {activityFeed.map((item) => {
                        
                        // Icon type selector
                        let dotBg = "bg-zinc-400";
                        if (item.type === 'note') dotBg = "bg-amber-500";
                        else if (item.type === 'task') dotBg = item.status === 'completed' ? "bg-emerald-500" : "bg-indigo-500";
                        else if (item.type === 'lead') dotBg = "bg-emerald-600";

                        return (
                          <div key={item.id} className="relative group">
                            
                            {/* Marker dot */}
                            <span className={cn("absolute -left-[31px] top-1.5 h-4 w-4 rounded-full border-4 border-white dark:border-zinc-900 shadow-sm", dotBg)}></span>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 capitalize">
                                  {item.type} entry
                                </span>
                                <span className="text-[9px] text-zinc-400 font-mono">
                                  {new Date(item.rawDate).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">{item.content}</p>
                              {item.author && (
                                <span className="text-[9px] text-zinc-400 mt-1 block">Logged by {item.author}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>

            </div>

          </div>
        ) : (
          <div className="flex-grow flex flex-col items-center justify-center text-center p-8 select-none">
            <Users size={32} className="text-zinc-300 mb-2" />
            <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Customer Profiles</h3>
            <p className="text-xs text-zinc-400 max-w-xs mt-1">Select a customer from the sidebar list to see notes timeline, tasks schedules, and pipeline stages details.</p>
          </div>
        )}
      </div>

    </div>
  );
};
