import React, { useState, useEffect, useRef } from 'react';
import { supabase, simulateIncomingWhatsAppMessage } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { 
  Search, 
  Send, 
  Phone, 
  Mail, 
  Tag, 
  User, 
  Calendar, 
  FileText, 
  Paperclip, 
  Smile, 
  Sparkles,
  Play,
  Check,
  Clock,
  MoreVertical,
  ChevronRight,
  Filter,
  MessageSquare
} from 'lucide-react';
import { formatDateTime } from '../../lib/utils';
import { Conversation, Message, Customer, Lead, Task, Note } from '../../types';
import { cn } from '../../lib/utils';

interface InboxProps {
  selectedCustomerId: string | null;
  setSelectedCustomerId: (id: string | null) => void;
}

export const Inbox: React.FC<InboxProps> = ({ selectedCustomerId, setSelectedCustomerId }) => {
  const { business, profile } = useAuth();
  
  // Lists
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConv, setActiveConv] = useState<any | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [customerDetails, setCustomerDetails] = useState<any | null>(null);
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'assigned' | 'hot'>('all');
  
  // Form Inputs
  const [replyText, setReplyText] = useState('');
  const [showSimulator, setShowSimulator] = useState(false);
  const [simMessage, setSimMessage] = useState('');

  // Right Panel Adding States
  const [noteContent, setNoteContent] = useState('');
  const [taskType, setTaskType] = useState<'Call' | 'WhatsApp Follow-up' | 'Meeting' | 'Callback'>('Call');
  const [taskDueDate, setTaskDueDate] = useState('');
  // Billing edit states
  const [isEditingBilling, setIsEditingBilling] = useState(false);
  const [editAddress, setEditAddress] = useState('');
  const [editGst, setEditGst] = useState('');

  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Predefined Quick Replies
  const quickReplies = [
    { text: 'Share Catalog', reply: 'Here is our premium collection catalog: https://royal-furniture.com/catalog.pdf. Let us know what designs you like!' },
    { text: 'Location details', reply: 'We are located at: Royal Furniture Plaza, Main Ring Road, Kirti Nagar, New Delhi. Opening hours: 10 AM to 8 PM.' },
    { text: 'Quote Sent follow-up', reply: 'Hi! Just wanted to follow up on the quotation we sent yesterday. Did you get a chance to review it?' },
  ];

  // 1. Fetch conversations list
  useEffect(() => {
    if (business) {
      fetchConversations();
      
      // Realtime subscription for conversation changes
      const convSubscription = supabase
        .channel('conversations_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'conversations', filter: `business_id=eq.${business.id}` },
          () => {
            fetchConversations();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(convSubscription);
      };
    }
  }, [business]);

  // 2. Load Active Conversation details
  useEffect(() => {
    if (selectedCustomerId && business) {
      const conv = conversations.find(c => c.customer_id === selectedCustomerId);
      if (conv) {
        setActiveConv(conv);
        fetchMessages(conv.id);
        fetchCustomerContext(selectedCustomerId);
        
        // Reset unread count when reading
        if (conv.unread_count > 0) {
          supabase
            .from('conversations')
            .update({ unread_count: 0 })
            .eq('id', conv.id)
            .then(() => fetchConversations());
        }
      } else {
        // If we don't have this conversation in our list (e.g. from search), try to fetch it or create it
        handleMissingConversation(selectedCustomerId);
      }
    } else {
      setActiveConv(null);
      setMessages([]);
      setCustomerDetails(null);
    }
  }, [selectedCustomerId, conversations]);

  // 3. Realtime message listener for active conversation
  useEffect(() => {
    if (activeConv) {
      const msgSubscription = supabase
        .channel(`messages_realtime_${activeConv.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConv.id}` },
          (payload) => {
            setMessages(prev => [...prev, payload.new as Message]);
            scrollToBottom();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(msgSubscription);
      };
    }
  }, [activeConv]);

  // Scroll to chat bottom
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*, customer:customers(*, leads(*))')
        .eq('business_id', business?.id)
        .order('last_message_at', { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (e) {
      console.error('Error fetching conversations:', e);
    }
  };

  const fetchMessages = async (convId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (e) {
      console.error('Error fetching messages:', e);
    }
  };

  const fetchCustomerContext = async (custId: string) => {
    try {
      // Fetch customer details, lead details, notes, and tasks
      const { data: customer, error: custError } = await supabase
        .from('customers')
        .select('*, leads(*), tasks(*), notes(*, author:profiles(*))')
        .eq('id', custId)
        .single();

      if (custError) throw custError;

      // Sort notes and tasks by date
      if (customer) {
        customer.notes = customer.notes?.sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ) || [];
        customer.tasks = customer.tasks?.filter((t: any) => t.status === 'pending').sort((a: any, b: any) => 
          new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
        ) || [];
      }

      setCustomerDetails(customer);
    } catch (e) {
      console.error('Error fetching customer context:', e);
    }
  };

  const handleMissingConversation = async (custId: string) => {
    try {
      // Query database for conversation
      let { data, error } = await supabase
        .from('conversations')
        .select('*, customer:customers(*, leads(*))')
        .eq('customer_id', custId)
        .eq('business_id', business?.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setActiveConv(data);
      } else {
        // Create new conversation
        const { data: newConv, error: createError } = await supabase
          .from('conversations')
          .insert({
            business_id: business?.id,
            customer_id: custId,
            last_message: 'Conversation started',
            last_message_at: new Date().toISOString()
          })
          .select('*, customer:customers(*, leads(*))')
          .single();

        if (createError) throw createError;
        setActiveConv(newConv);
      }
    } catch (e) {
      console.error('Error handling missing conversation:', e);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, contentText?: string) => {
    if (e) e.preventDefault();
    
    const textToSend = contentText || replyText;
    if (!textToSend.trim() || !activeConv) return;

    if (!contentText) setReplyText('');

    try {
      // Optimistic update of local conversation list last message
      setConversations(prev => 
        prev.map(c => 
          c.id === activeConv.id 
            ? { ...c, last_message: textToSend, last_message_at: new Date().toISOString() } 
            : c
        )
      );

      // 1. Insert message
      const { error: msgError } = await supabase.from('messages').insert({
        conversation_id: activeConv.id,
        sender_type: 'staff',
        sender_id: profile?.id || null,
        content: textToSend
      });

      if (msgError) throw msgError;

      // 2. Update conversation last message
      await supabase
        .from('conversations')
        .update({
          last_message: textToSend,
          last_message_at: new Date().toISOString()
        })
        .eq('id', activeConv.id);

      // 3. Send via YCloud WhatsApp API if credentials are configured
      if (business?.ycloud_api_key && business?.ycloud_sender_phone) {
        const { data: callData, error: callError } = await supabase.functions.invoke('send-whatsapp', {
          body: {
            recipientPhone: activeConv.customer?.phone,
            text: textToSend
          }
        });
        
        if (callError) {
          console.error('YCloud Edge Function error:', callError);
          alert(`Warning: Message saved locally but failed to dispatch via YCloud WhatsApp: ${callError.message}`);
        } else if (callData?.error) {
          console.error('YCloud API error details:', callData);
          alert(`Warning: Message saved locally but YCloud API failed: ${callData.error}`);
        }
      }

      fetchConversations();
    } catch (e) {
      console.error('Error sending message:', e);
    }
  };

  // Local WhatsApp simulator
  const handleSimulateIncoming = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simMessage.trim() || !customerDetails || !business) return;

    setShowSimulator(false);
    const msg = simMessage;
    setSimMessage('');

    try {
      await simulateIncomingWhatsAppMessage(
        business.id,
        customerDetails.name,
        customerDetails.phone,
        msg
      );
      
      // Refresh
      fetchConversations();
      if (selectedCustomerId) {
        fetchCustomerContext(selectedCustomerId);
      }
    } catch (e) {
      console.error('Error simulating incoming message:', e);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim() || !customerDetails || !business) return;

    const content = noteContent;
    setNoteContent('');

    try {
      const { error } = await supabase.from('notes').insert({
        business_id: business.id,
        customer_id: customerDetails.id,
        content: content,
        author_id: profile?.id || null
      });

      if (error) throw error;
      fetchCustomerContext(customerDetails.id);
    } catch (e) {
      console.error('Error adding note:', e);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskDueDate || !customerDetails || !business) return;

    const date = taskDueDate;
    const type = taskType;
    setTaskDueDate('');

    try {
      const { error } = await supabase.from('tasks').insert({
        business_id: business.id,
        customer_id: customerDetails.id,
        type: type,
        due_date: new Date(date).toISOString(),
        assigned_staff_id: profile?.id || null,
        status: 'pending'
      });

      if (error) throw error;
      fetchCustomerContext(customerDetails.id);
    } catch (e) {
      console.error('Error adding task:', e);
    }
  };

  const handleUpdateLeadStage = async (newStage: string) => {
    if (!customerDetails || !customerDetails.leads?.[0]) return;
    try {
      const leadId = customerDetails.leads[0].id;
      const { error } = await supabase
        .from('leads')
        .update({ stage: newStage })
        .eq('id', leadId);

      if (error) throw error;
      fetchCustomerContext(customerDetails.id);
      fetchConversations();
    } catch (e) {
      console.error('Error updating lead stage:', e);
    }
  };

  // Filters logic
  const filteredConversations = conversations.filter(c => {
    // 1. Search Query
    const nameMatch = c.customer?.name.toLowerCase().includes(searchQuery.toLowerCase());
    const phoneMatch = c.customer?.phone.includes(searchQuery);
    const msgMatch = c.last_message?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchSearch = nameMatch || phoneMatch || msgMatch;

    if (!matchSearch) return false;

    // 2. Active Tab Filters
    if (activeFilter === 'unread') return c.unread_count > 0;
    if (activeFilter === 'assigned') return c.customer?.assigned_staff_id === profile?.id;
    if (activeFilter === 'hot') {
      const lead = c.customer?.leads?.[0];
      return lead && lead.priority === 'high' && lead.stage !== 'Won' && lead.stage !== 'Lost';
    }

    return true;
  });

  return (
    <div className="flex-1 flex overflow-hidden h-[calc(100vh-4rem)]">
      
      {/* 1. LEFT PANEL: Conversations list */}
      <div className={cn(
        "w-full md:w-80 lg:w-96 border-r border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-950 flex flex-col shrink-0 z-10",
        selectedCustomerId ? "hidden md:flex" : "flex"
      )}>
        
        {/* Search */}
        <div className="p-4 border-b border-zinc-200/50 dark:border-zinc-800/50 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-zinc-400" size={16} />
            <input
              type="text"
              placeholder="Search chat or phone..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/20 focus:outline-none focus:ring-1 focus:ring-emerald-600 text-zinc-900 dark:text-zinc-50"
            />
          </div>
          
          {/* Quick Filters */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveFilter('all')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer whitespace-nowrap",
                activeFilter === 'all' 
                  ? "bg-emerald-600 text-white" 
                  : "bg-zinc-100 dark:bg-zinc-900 text-zinc-500 hover:bg-zinc-200/50 dark:hover:bg-zinc-800"
              )}
            >
              All Chats
            </button>
            <button
              onClick={() => setActiveFilter('unread')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer whitespace-nowrap",
                activeFilter === 'unread' 
                  ? "bg-emerald-600 text-white" 
                  : "bg-zinc-100 dark:bg-zinc-900 text-zinc-500 hover:bg-zinc-200/50 dark:hover:bg-zinc-800"
              )}
            >
              Unread ({conversations.filter(c => c.unread_count > 0).length})
            </button>
            <button
              onClick={() => setActiveFilter('assigned')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer whitespace-nowrap",
                activeFilter === 'assigned' 
                  ? "bg-emerald-600 text-white" 
                  : "bg-zinc-100 dark:bg-zinc-900 text-zinc-500 hover:bg-zinc-200/50 dark:hover:bg-zinc-800"
              )}
            >
              Assigned to me
            </button>
            <button
              onClick={() => setActiveFilter('hot')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer whitespace-nowrap",
                activeFilter === 'hot' 
                  ? "bg-amber-600 text-white" 
                  : "bg-zinc-100 dark:bg-zinc-900 text-zinc-500 hover:bg-zinc-200/50 dark:hover:bg-zinc-800"
              )}
            >
              🔥 Hot
            </button>
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-900">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-400">
              No conversations found.
            </div>
          ) : (
            filteredConversations.map(conv => {
              const isSelected = selectedCustomerId === conv.customer_id;
              const hasUnread = conv.unread_count > 0;
              const lead = conv.customer?.leads?.[0];
              
              // Define lead color helper
              let stageColor = "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400";
              if (lead?.stage === 'Interested') stageColor = "bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400";
              else if (lead?.stage === 'Follow-up Pending') stageColor = "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-500";
              else if (lead?.stage === 'Quotation Sent') stageColor = "bg-sky-50 dark:bg-sky-950/20 text-sky-600 dark:text-sky-400";
              else if (lead?.stage === 'Won') stageColor = "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400";
              else if (lead?.stage === 'Lost') stageColor = "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400";

              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedCustomerId(conv.customer_id)}
                  className={cn(
                    "w-full flex items-start gap-3 p-4 text-left transition-colors cursor-pointer relative",
                    isSelected 
                      ? "bg-zinc-50 dark:bg-zinc-900/50" 
                      : "hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20"
                  )}
                >
                  {/* Left indicator strip for selected */}
                  {isSelected && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-600"></div>
                  )}

                  {/* Avatar */}
                  <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0 relative">
                    {conv.customer?.name.charAt(0)}
                    
                    {/* Hot Lead Badge */}
                    {lead?.priority === 'high' && (
                      <span className="absolute -top-1 -right-1 h-4 w-4 bg-amber-500 rounded-full flex items-center justify-center text-white text-[8px]">🔥</span>
                    )}
                  </div>

                  {/* Info details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <h4 className={cn(
                        "text-xs truncate",
                        hasUnread ? "font-bold text-zinc-950 dark:text-zinc-50" : "font-semibold text-zinc-800 dark:text-zinc-200"
                      )}>
                        {conv.customer?.name}
                      </h4>
                      <span className="text-[9px] text-zinc-400 dark:text-zinc-500 shrink-0">
                        {formatDateTime(conv.last_message_at)}
                      </span>
                    </div>

                    <p className={cn(
                      "text-[11px] truncate mt-1",
                      hasUnread ? "font-semibold text-zinc-900 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"
                    )}>
                      {conv.last_message}
                    </p>

                    {/* Stage badge and unread circle */}
                    <div className="flex justify-between items-center mt-2">
                      {lead ? (
                        <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded", stageColor)}>
                          {lead.stage}
                        </span>
                      ) : (
                        <span></span>
                      )}

                      {hasUnread && (
                        <span className="h-4 w-4 bg-emerald-600 text-white rounded-full flex items-center justify-center text-[9px] font-bold font-mono">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 2. MIDDLE CHAT PANEL: Message list and input bubble screen */}
      <div className={cn(
        "flex-1 flex flex-col bg-whatsapp-chatBg dark:bg-whatsapp-chatBgDark relative",
        selectedCustomerId ? "flex" : "hidden md:flex"
      )}>
        
        {activeConv ? (
          <>
            {/* Active Chat Header */}
            <div className="h-16 border-b border-zinc-200/50 dark:border-zinc-800/50 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md px-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setSelectedCustomerId(null)}
                  className="md:hidden text-zinc-500 hover:text-zinc-950 mr-1 cursor-pointer"
                >
                  <ChevronRight size={20} className="rotate-180" />
                </button>
                <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-sm">
                  {activeConv.customer?.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-100">{activeConv.customer?.name}</h3>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 flex items-center gap-1 mt-0.5">
                    <span className="h-1.5 w-1.5 bg-emerald-600 rounded-full inline-block"></span>
                    WhatsApp Connected (Via Backend)
                  </span>
                </div>
              </div>

              {/* Chat simulator trigger action */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSimulator(!showSimulator)}
                  className="flex items-center gap-1.5 text-[10px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400 px-3 py-1.5 rounded-lg border border-amber-600/10 cursor-pointer shadow-sm transition-all"
                >
                  <Play size={10} fill="currentColor" />
                  Simulate Client Message
                </button>
                <button className="h-9 w-9 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-500">
                  <MoreVertical size={18} />
                </button>
              </div>
            </div>

            {/* Chat Simulator overlay popup */}
            {showSimulator && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200/50 dark:border-amber-900/20 flex flex-col md:flex-row items-center gap-2 animate-fade-in shrink-0 relative z-20">
                <p className="text-[10px] font-bold text-amber-800 dark:text-amber-400 shrink-0">
                  ⚡ Simulator: Send a message from "{activeConv.customer?.name}"
                </p>
                <form onSubmit={handleSimulateIncoming} className="flex-1 w-full flex items-center gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Type client reply content..."
                    value={simMessage}
                    onChange={e => setSimMessage(e.target.value)}
                    className="flex-1 px-3 py-1 text-xs rounded-lg border border-amber-200 dark:border-amber-900 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                  />
                  <button 
                    type="submit"
                    className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-[10px] px-3 py-1 rounded-lg cursor-pointer"
                  >
                    Simulate
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setShowSimulator(false)}
                    className="text-[10px] text-zinc-500 hover:underline px-2"
                  >
                    Cancel
                  </button>
                </form>
              </div>
            )}

            {/* Message Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 relative">
              {messages.map((msg, index) => {
                const isStaff = msg.sender_type === 'staff';
                
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex w-full animate-fade-in",
                      isStaff ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[70%] rounded-2xl px-3.5 py-2 text-xs shadow-sm flex flex-col",
                        isStaff 
                          ? "bg-whatsapp-bubbleOut dark:bg-whatsapp-bubbleOutDark text-zinc-900 dark:text-zinc-100 rounded-tr-none" 
                          : "bg-whatsapp-bubbleIn dark:bg-whatsapp-bubbleInDark text-zinc-900 dark:text-zinc-100 rounded-tl-none"
                      )}
                    >
                      <p className="whitespace-pre-line leading-relaxed">{msg.content}</p>
                      <span className="text-[8px] text-zinc-400 self-end mt-1 font-mono">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Replies Panel */}
            <div className="px-4 py-2 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md border-t border-zinc-200/50 dark:border-zinc-800/50 flex gap-2 overflow-x-auto shrink-0 z-10">
              <span className="text-[10px] text-zinc-400 flex items-center font-bold uppercase tracking-wider gap-1 shrink-0 select-none mr-2">
                <Sparkles size={12} className="text-amber-500" />
                Quick Replies:
              </span>
              {quickReplies.map((qr, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(undefined, qr.reply)}
                  className="px-2.5 py-1 text-[10px] bg-zinc-100 hover:bg-emerald-50 dark:bg-zinc-800 dark:hover:bg-emerald-950/20 text-zinc-600 hover:text-emerald-700 dark:text-zinc-400 dark:hover:text-emerald-400 rounded-full border border-zinc-200/20 hover:border-emerald-600/20 font-medium transition-all shrink-0 cursor-pointer"
                >
                  {qr.text}
                </button>
              ))}
            </div>

            {/* Input message Bar */}
            <form 
              onSubmit={handleSendMessage}
              className="h-16 bg-white/95 dark:bg-zinc-900/95 border-t border-zinc-200/50 dark:border-zinc-800/50 px-4 flex items-center gap-3 shrink-0 relative z-10"
            >
              <button 
                type="button"
                className="h-9 w-9 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <Smile size={20} />
              </button>
              <button 
                type="button"
                className="h-9 w-9 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <Paperclip size={20} />
              </button>
              
              <input
                type="text"
                required
                placeholder="Type a message..."
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-emerald-600 text-xs text-zinc-900 dark:text-zinc-50"
              />

              <button
                type="submit"
                className="h-10 w-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-md shadow-emerald-600/10 cursor-pointer active:scale-95 transition-transform"
              >
                <Send size={16} />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 select-none">
            <div className="h-16 w-16 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center shadow-inner mb-4">
              <MessageSquare size={28} />
            </div>
            <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300">WhatsApp Inbox</h3>
            <p className="text-xs text-zinc-400 max-w-xs mt-1">Select a customer from the left conversation list or start a new chat using Quick Add to begin messaging.</p>
          </div>
        )}
      </div>

      {/* 3. RIGHT PANEL: Customer Context Details */}
      {selectedCustomerId && customerDetails && (
        <div className="hidden lg:flex w-80 xl:w-96 border-l border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-950 flex-col shrink-0 overflow-y-auto p-4 space-y-6">
          
          {/* Section 1: Customer details */}
          <div className="text-center pb-4 border-b border-zinc-100 dark:border-zinc-900">
            <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-lg mx-auto shadow-sm">
              {customerDetails.name.charAt(0)}
            </div>
            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-3">{customerDetails.name}</h3>
            
            {/* Quick phone/email info */}
            <div className="mt-3 space-y-1.5 flex flex-col items-center">
              <a 
                href={`tel:${customerDetails.phone}`}
                className="text-[10px] text-zinc-500 hover:text-emerald-600 flex items-center gap-1.5"
              >
                <Phone size={11} />
                {customerDetails.phone}
              </a>
              {customerDetails.email && (
                <a 
                  href={`mailto:${customerDetails.email}`}
                  className="text-[10px] text-zinc-500 hover:text-emerald-600 flex items-center gap-1.5"
                >
                  <Mail size={11} />
                  {customerDetails.email}
                </a>
              )}
            </div>

            {/* Tags display */}
            {customerDetails.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 justify-center mt-3.5">
                {customerDetails.tags.map((t: string, idx: number) => (
                  <span key={idx} className="text-[9px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                    <Tag size={8} />
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Lead Status Edit */}
          {customerDetails.leads?.[0] && (
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Lead Pipeline Stage
              </h4>
              <select
                value={customerDetails.leads[0].stage}
                onChange={e => handleUpdateLeadStage(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              >
                <option value="New Inquiry">New Inquiry</option>
                <option value="Contacted">Contacted</option>
                <option value="Interested">Interested</option>
                <option value="Follow-up Pending">Follow-up Pending</option>
                <option value="Quotation Sent">Quotation Sent</option>
                <option value="Won">Won</option>
                <option value="Lost">Lost</option>
              </select>
              <div className="flex justify-between items-center text-[10px] text-zinc-400 mt-1">
                <span>Value: <strong>₹{customerDetails.leads[0].expected_deal_value.toLocaleString('en-IN')}</strong></span>
                <span className="capitalize">Priority: <strong>{customerDetails.leads[0].priority}</strong></span>
              </div>
            </div>
          )}

          {/* Store & Billing Card */}
          <div className="p-4 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
                <Building size={13} className="text-emerald-600" />
                Store & Billing
              </h3>
              <button onClick={() => {
                setIsEditingBilling(!isEditingBilling);
                setEditAddress(customerDetails?.address || '');
                setEditGst(customerDetails?.gst_number || '');
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
                  }).eq('id', customerDetails.id);
                  if (error) throw error;
                  setIsEditingBilling(false);
                  fetchCustomerContext(customerDetails.id);
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
                {customerDetails?.address && (
                  <div>
                    <span className="text-[10px] text-zinc-400 font-medium">Billing Address</span>
                    <p className="text-xs text-zinc-700 dark:text-zinc-300 mt-0.5 whitespace-pre-wrap">{customerDetails.address}</p>
                  </div>
                )}
                {(!customerDetails?.address) && (
                  <div>
                    <span className="text-[10px] text-zinc-400 font-medium">Billing Address</span>
                    <p className="text-xs text-zinc-400 italic mt-0.5">Not Provided</p>
                  </div>
                )}
                {customerDetails?.gst_number && (
                  <div className="pt-1">
                    <span className="text-[10px] text-zinc-400 font-medium">GSTIN</span>
                    <p className="text-xs font-mono font-bold text-zinc-800 dark:text-zinc-200 mt-0.5">{customerDetails.gst_number}</p>
                  </div>
                )}
                {(!customerDetails?.gst_number) && (
                  <div className="pt-1">
                    <span className="text-[10px] text-zinc-400 font-medium">GSTIN</span>
                    <p className="text-xs text-zinc-400 italic mt-0.5">Not Provided</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Section 3: Add Note */}
          <div className="space-y-2 border-t border-zinc-100 dark:border-zinc-900 pt-4">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Add Customer Note
            </h4>
            <form onSubmit={handleAddNote} className="flex gap-2">
              <input
                type="text"
                required
                placeholder="Write a note..."
                value={noteContent}
                onChange={e => setNoteContent(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none text-xs"
              />
              <button 
                type="submit"
                className="px-3 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 cursor-pointer"
              >
                Add
              </button>
            </form>
          </div>

          {/* Section 4: Schedule Task */}
          <div className="space-y-2 border-t border-zinc-100 dark:border-zinc-900 pt-4">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Schedule Follow-up Task
            </h4>
            <form onSubmit={handleAddTask} className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={taskType}
                  onChange={e => setTaskType(e.target.value as any)}
                  className="px-2 py-1 text-[11px] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200"
                >
                  <option value="Call">Call</option>
                  <option value="WhatsApp Follow-up">WhatsApp Follow-up</option>
                  <option value="Meeting">Meeting</option>
                  <option value="Callback">Callback</option>
                </select>
                <input
                  type="datetime-local"
                  required
                  value={taskDueDate}
                  onChange={e => setTaskDueDate(e.target.value)}
                  className="px-2 py-1 text-[11px] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200"
                />
              </div>
              <button 
                type="submit"
                className="w-full py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 cursor-pointer shadow-sm"
              >
                Schedule Task
              </button>
            </form>
          </div>

          {/* Section 5: Activity Feed timeline (Notes & Tasks) */}
          <div className="border-t border-zinc-100 dark:border-zinc-900 pt-4 space-y-4">
            
            {/* Notes Timeline */}
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2">
                Notes Timeline
              </h4>
              
              {customerDetails.notes?.length === 0 ? (
                <p className="text-[10px] text-zinc-400 italic">No notes added yet.</p>
              ) : (
                <div className="space-y-2.5 max-h-40 overflow-y-auto pr-1">
                  {customerDetails.notes.map((note: any) => (
                    <div key={note.id} className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 text-[10px]">
                      <p className="text-zinc-700 dark:text-zinc-300 font-medium">{note.content}</p>
                      <div className="flex justify-between items-center text-[8px] text-zinc-400 mt-1">
                        <span>By {note.author?.full_name || 'Staff'}</span>
                        <span>{new Date(note.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pending Tasks */}
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2">
                Scheduled Tasks
              </h4>
              
              {customerDetails.tasks?.length === 0 ? (
                <p className="text-[10px] text-zinc-400 italic">No pending tasks.</p>
              ) : (
                <div className="space-y-2.5 max-h-40 overflow-y-auto pr-1">
                  {customerDetails.tasks.map((task: any) => (
                    <div key={task.id} className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 text-[10px] border-l-2 border-indigo-500 flex justify-between items-start">
                      <div>
                        <p className="text-zinc-700 dark:text-zinc-300 font-bold">{task.type}</p>
                        <p className="text-zinc-400 text-[8px] mt-0.5">
                          Due: {new Date(task.due_date).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <button 
                        onClick={async () => {
                          await supabase.from('tasks').update({ status: 'completed' }).eq('id', task.id);
                          fetchCustomerContext(customerDetails.id);
                        }}
                        className="h-4 w-4 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded border border-emerald-600/20 flex items-center justify-center text-[8px] font-bold cursor-pointer"
                      >
                        ✓
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      )}

    </div>
  );
};
