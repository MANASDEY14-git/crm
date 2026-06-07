import React, { useState, useEffect } from 'react';
import { X, UserPlus, FilePlus, CalendarPlus, MessageSquarePlus, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Customer } from '../../types';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const QuickAddModal: React.FC<QuickAddModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { business, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'customer' | 'lead' | 'task' | 'chat'>('customer');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  // Form States
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custTags, setCustTags] = useState('');

  const [leadCustomer, setLeadCustomer] = useState('');
  const [leadStage, setLeadStage] = useState<'New Inquiry' | 'Contacted' | 'Interested' | 'Follow-up Pending' | 'Quotation Sent' | 'Won' | 'Lost'>('New Inquiry');
  const [leadValue, setLeadValue] = useState('');
  const [leadPriority, setLeadPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [leadFollowUp, setLeadFollowUp] = useState('');

  const [taskCustomer, setTaskCustomer] = useState('');
  const [taskType, setTaskType] = useState<'Call' | 'WhatsApp Follow-up' | 'Meeting' | 'Callback'>('Call');
  const [taskDueDate, setTaskDueDate] = useState('');

  const [chatCustomer, setChatCustomer] = useState('');
  const [chatFirstMsg, setChatFirstMsg] = useState('');

  useEffect(() => {
    if (isOpen && business) {
      fetchCustomers();
    }
  }, [isOpen, business]);

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('business_id', business?.id)
        .order('name');
      
      if (error) throw error;
      setCustomers(data || []);
    } catch (e) {
      console.error('Error fetching customers:', e);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business) return;
    setLoading(true);
    try {
      const tagsArray = custTags ? custTags.split(',').map(t => t.trim()) : [];
      const { error } = await supabase.from('customers').insert({
        business_id: business.id,
        name: custName,
        phone: custPhone,
        email: custEmail || null,
        tags: tagsArray,
        assigned_staff_id: profile?.id || null
      });

      if (error) throw error;
      
      // Reset
      setCustName('');
      setCustPhone('');
      setCustEmail('');
      setCustTags('');
      
      if (onSuccess) onSuccess();
      onClose();
    } catch (e) {
      console.error('Error creating customer:', e);
      alert('Failed to create customer: ' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business || !leadCustomer) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('leads').insert({
        business_id: business.id,
        customer_id: leadCustomer,
        stage: leadStage,
        expected_deal_value: Number(leadValue) || 0,
        priority: leadPriority,
        follow_up_date: leadFollowUp ? new Date(leadFollowUp).toISOString() : null
      });

      if (error) throw error;
      
      setLeadCustomer('');
      setLeadValue('');
      setLeadFollowUp('');
      
      if (onSuccess) onSuccess();
      onClose();
    } catch (e) {
      console.error('Error creating lead:', e);
      alert('Failed to create lead: ' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business || !taskCustomer || !taskDueDate) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('tasks').insert({
        business_id: business.id,
        customer_id: taskCustomer,
        type: taskType,
        due_date: new Date(taskDueDate).toISOString(),
        assigned_staff_id: profile?.id || null,
        status: 'pending'
      });

      if (error) throw error;
      
      setTaskCustomer('');
      setTaskDueDate('');
      
      if (onSuccess) onSuccess();
      onClose();
    } catch (e) {
      console.error('Error creating task:', e);
      alert('Failed to create task: ' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChat = async (e: React.FormEvent) => {
    if (!business || !chatCustomer || !chatFirstMsg) return;
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Create conversation
      const { data: conv, error: convError } = await supabase
        .from('conversations')
        .insert({
          business_id: business.id,
          customer_id: chatCustomer,
          last_message: chatFirstMsg,
          last_message_at: new Date().toISOString(),
          unread_count: 0
        })
        .select()
        .single();

      if (convError) throw convError;

      // 2. Insert first message
      const { error: msgError } = await supabase.from('messages').insert({
        conversation_id: conv.id,
        sender_type: 'staff',
        sender_id: profile?.id || null,
        content: chatFirstMsg
      });

      if (msgError) throw msgError;

      // 3. Send via YCloud WhatsApp API if credentials are configured
      if (business?.ycloud_api_key && business?.ycloud_sender_phone) {
        const recipientPhone = customers.find(c => c.id === chatCustomer)?.phone;
        if (recipientPhone) {
          const { data: callData, error: callError } = await supabase.functions.invoke('send-whatsapp', {
            body: {
              recipientPhone,
              text: chatFirstMsg
            }
          });
          
          if (callError) {
            console.error('YCloud Edge Function error:', callError);
            alert(`Warning: Chat created locally but failed to send via YCloud WhatsApp: ${callError.message}`);
          } else if (callData?.error) {
            console.error('YCloud API error details:', callData);
            alert(`Warning: Chat created locally but YCloud API failed: ${callData.error}`);
          }
        }
      }

      setChatCustomer('');
      setChatFirstMsg('');
      
      if (onSuccess) onSuccess();
      onClose();
    } catch (e) {
      console.error('Error starting conversation:', e);
      alert('Failed to start conversation: ' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-950 p-6 shadow-2xl relative overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Quick Add Item</h2>
          <button 
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Headers */}
        <div className="flex border-b border-zinc-100 dark:border-zinc-800 mt-4 overflow-x-auto gap-2">
          <button
            onClick={() => setActiveTab('customer')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'customer'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <UserPlus size={14} />
            Customer
          </button>
          <button
            onClick={() => setActiveTab('lead')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'lead'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <FilePlus size={14} />
            Lead Pipeline
          </button>
          <button
            onClick={() => setActiveTab('task')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'task'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <CalendarPlus size={14} />
            Follow-up Task
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'chat'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <MessageSquarePlus size={14} />
            WhatsApp Chat
          </button>
        </div>

        {/* Tab Forms */}
        <div className="mt-4">
          
          {/* Create Customer */}
          {activeTab === 'customer' && (
            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Customer Name *</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Vikram Singh"
                  value={custName} 
                  onChange={e => setCustName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-transparent text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Phone Number (with +91) *</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. +91 98765 43210"
                  value={custPhone} 
                  onChange={e => setCustPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-transparent text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Email Address</label>
                <input 
                  type="email" 
                  placeholder="e.g. customer@domain.com"
                  value={custEmail} 
                  onChange={e => setCustEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-transparent text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Tags (comma separated)</label>
                <input 
                  type="text" 
                  placeholder="e.g. High Value, Teak Wood, Office Order"
                  value={custTags} 
                  onChange={e => setCustTags(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-transparent text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-500 text-white rounded-xl text-sm font-semibold shadow-md cursor-pointer transition-colors"
              >
                {loading ? 'Creating...' : 'Create Customer'}
              </button>
            </form>
          )}

          {/* Create Lead */}
          {activeTab === 'lead' && (
            <form onSubmit={handleCreateLead} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Select Customer *</label>
                <select
                  required
                  value={leadCustomer}
                  onChange={e => setLeadCustomer(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:outline-none text-zinc-900 dark:text-zinc-100"
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Deal Stage *</label>
                  <select
                    value={leadStage}
                    onChange={e => setLeadStage(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:outline-none text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="New Inquiry">New Inquiry</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Interested">Interested</option>
                    <option value="Follow-up Pending">Follow-up Pending</option>
                    <option value="Quotation Sent">Quotation Sent</option>
                    <option value="Won">Won</option>
                    <option value="Lost">Lost</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Expected Value (₹)</label>
                  <input 
                    type="number" 
                    placeholder="e.g. 50000"
                    value={leadValue} 
                    onChange={e => setLeadValue(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-emerald-600 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Priority *</label>
                  <select
                    value={leadPriority}
                    onChange={e => setLeadPriority(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:outline-none text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Follow-up Date</label>
                  <input 
                    type="datetime-local" 
                    value={leadFollowUp} 
                    onChange={e => setLeadFollowUp(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-emerald-600 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-500 text-white rounded-xl text-sm font-semibold shadow-md cursor-pointer transition-colors"
              >
                {loading ? 'Creating...' : 'Create Lead'}
              </button>
            </form>
          )}

          {/* Create Task */}
          {activeTab === 'task' && (
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Select Customer *</label>
                <select
                  required
                  value={taskCustomer}
                  onChange={e => setTaskCustomer(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:outline-none text-zinc-900 dark:text-zinc-100"
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Task Type *</label>
                  <select
                    value={taskType}
                    onChange={e => setTaskType(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:outline-none text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="Call">Call</option>
                    <option value="WhatsApp Follow-up">WhatsApp Follow-up</option>
                    <option value="Meeting">Meeting</option>
                    <option value="Callback">Callback</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Due Date *</label>
                  <input 
                    type="datetime-local" 
                    required
                    value={taskDueDate} 
                    onChange={e => setTaskDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-emerald-600 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-500 text-white rounded-xl text-sm font-semibold shadow-md cursor-pointer transition-colors"
              >
                {loading ? 'Creating...' : 'Create Task'}
              </button>
            </form>
          )}

          {/* Start Conversation */}
          {activeTab === 'chat' && (
            <form onSubmit={handleCreateChat} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Select Customer *</label>
                <select
                  required
                  value={chatCustomer}
                  onChange={e => setChatCustomer(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:outline-none text-zinc-900 dark:text-zinc-100"
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">First Message Content *</label>
                <textarea 
                  required
                  rows={3}
                  placeholder="Type the initial WhatsApp message..."
                  value={chatFirstMsg} 
                  onChange={e => setChatFirstMsg(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-emerald-600 text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-500 text-white rounded-xl text-sm font-semibold shadow-md cursor-pointer transition-colors"
              >
                {loading ? 'Starting...' : 'Start Conversation'}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};
