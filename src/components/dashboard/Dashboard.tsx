import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { 
  AlertCircle, 
  MessageCircle, 
  Clock, 
  TrendingUp, 
  Users, 
  CheckCircle2, 
  ArrowRight,
  Flame,
  CalendarCheck
} from 'lucide-react';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { Lead, Task, Conversation } from '../../types';

interface DashboardProps {
  setCurrentTab: (tab: string) => void;
  setSelectedCustomerId: (id: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ setCurrentTab, setSelectedCustomerId }) => {
  const { business } = useAuth();
  
  // States
  const [metrics, setMetrics] = useState({
    totalLeadsToday: 0,
    pendingFollowUps: 0,
    hotLeads: 0,
    tasksDueToday: 0,
    conversionValue: 0
  });

  const [attentionItems, setAttentionItems] = useState<{
    overdueTasks: any[];
    unreadChats: any[];
    overdueLeads: any[];
  }>({
    overdueTasks: [],
    unreadChats: [],
    overdueLeads: []
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (business) {
      fetchDashboardData();
    }
  }, [business]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const todayStart = new Date();
      todayStart.setHours(0,0,0,0);
      const now = new Date();

      // 1. Total leads created today
      const { count: leadsTodayCount } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', business?.id)
        .gte('created_at', todayStart.toISOString());

      // 2. Pending follow-ups (overdue leads)
      const { data: overdueLeads } = await supabase
        .from('leads')
        .select('*, customer:customers(*)')
        .eq('business_id', business?.id)
        .eq('stage', 'Follow-up Pending')
        .lte('follow_up_date', now.toISOString());

      // 3. Hot leads (priority = high)
      const { count: hotLeadsCount } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', business?.id)
        .eq('priority', 'high')
        .not('stage', 'in', '("Won","Lost")');

      // 4. Tasks due today/overdue
      const { data: pendingTasks } = await supabase
        .from('tasks')
        .select('*, customer:customers(*)')
        .eq('business_id', business?.id)
        .eq('status', 'pending')
        .lte('due_date', now.toISOString());

      // 5. Unread conversations
      const { data: unreadConversations } = await supabase
        .from('conversations')
        .select('*, customer:customers(*)')
        .eq('business_id', business?.id)
        .gt('unread_count', 0)
        .order('last_message_at', { ascending: false });

      // 6. Expected Deal Value Sum
      const { data: activeLeads } = await supabase
        .from('leads')
        .select('expected_deal_value')
        .eq('business_id', business?.id)
        .not('stage', 'in', '("Won","Lost")');

      const expectedValue = activeLeads?.reduce((sum, lead) => sum + Number(lead.expected_deal_value), 0) || 0;

      setMetrics({
        totalLeadsToday: leadsTodayCount || 0,
        pendingFollowUps: overdueLeads?.length || 0,
        hotLeads: hotLeadsCount || 0,
        tasksDueToday: pendingTasks?.length || 0,
        conversionValue: expectedValue
      });

      setAttentionItems({
        overdueTasks: pendingTasks || [],
        unreadChats: unreadConversations || [],
        overdueLeads: overdueLeads || []
      });

    } catch (e) {
      console.error('Error fetching dashboard data:', e);
    } finally {
      setLoading(false);
    }
  };

  const totalAttentionCount = 
    attentionItems.overdueTasks.length + 
    attentionItems.unreadChats.length + 
    attentionItems.overdueLeads.length;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-7xl mx-auto w-full">
      
      {/* Welcome Message */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-950 dark:text-zinc-50 tracking-tight">Today's Dashboard</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Here is a quick look at your business attention points for today.</p>
        </div>
        <button 
          onClick={fetchDashboardData}
          className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-1.5 rounded-lg border border-emerald-600/10 cursor-pointer self-start md:self-auto"
        >
          Refresh metrics
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Metric 1 */}
        <div className="p-4 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">Leads Added Today</span>
            <div className="h-7 w-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp size={14} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{metrics.totalLeadsToday}</h3>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">New inquiries</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="p-4 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">Overdue Leads</span>
            <div className="h-7 w-7 rounded-lg bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertCircle size={14} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{metrics.pendingFollowUps}</h3>
            <span className="text-[10px] text-rose-500 font-medium">Needs follow-up</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="p-4 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">Hot Inquiries</span>
            <div className="h-7 w-7 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-500 flex items-center justify-center">
              <Flame size={14} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{metrics.hotLeads}</h3>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">High priority</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="p-4 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">Overdue Tasks</span>
            <div className="h-7 w-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <CalendarCheck size={14} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{metrics.tasksDueToday}</h3>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">Action required</span>
          </div>
        </div>

        {/* Metric 5 */}
        <div className="p-4 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 shadow-sm flex flex-col justify-between col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">Active Pipeline Value</span>
            <div className="h-7 w-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
              <span className="text-xs font-bold">₹</span>
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 truncate">{formatCurrency(metrics.conversionValue)}</h3>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">Expected sales</span>
          </div>
        </div>

      </div>

      {/* Attention Center (Highly Priority Section) */}
      <div className="border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
        
        {/* Banner header */}
        <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="text-amber-500" size={18} />
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Today's Attention Center</h3>
          </div>
          {totalAttentionCount > 0 ? (
            <span className="text-xs bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-bold">
              {totalAttentionCount} items pending
            </span>
          ) : (
            <span className="text-xs bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold">
              All caught up!
            </span>
          )}
        </div>

        {/* Content columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-100 dark:divide-zinc-800 min-h-[220px]">
          
          {/* Column 1: Unread Chats */}
          <div className="p-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-3 flex items-center justify-between">
              <span>Unread WhatsApp Chats</span>
              <span className="h-5 w-5 rounded-full bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 flex items-center justify-center text-[10px] font-bold">
                {attentionItems.unreadChats.length}
              </span>
            </h4>
            
            {attentionItems.unreadChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center text-xs text-zinc-400">
                <p>No unread chats.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                {attentionItems.unreadChats.map(chat => (
                  <button 
                    key={chat.id}
                    onClick={() => {
                      setSelectedCustomerId(chat.customer_id);
                      setCurrentTab('inbox');
                    }}
                    className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200/20 text-left transition-all cursor-pointer group"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                        {chat.customer?.name}
                      </span>
                      <span className="text-[9px] text-zinc-400">{formatDateTime(chat.last_message_at)}</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-1">
                      {chat.last_message}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Column 2: Overdue Tasks */}
          <div className="p-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-3 flex items-center justify-between">
              <span>Overdue Follow-up Tasks</span>
              <span className="h-5 w-5 rounded-full bg-rose-100 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 flex items-center justify-center text-[10px] font-bold">
                {attentionItems.overdueTasks.length}
              </span>
            </h4>
            
            {attentionItems.overdueTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center text-xs text-zinc-400">
                <p>No overdue tasks.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                {attentionItems.overdueTasks.map(task => (
                  <button 
                    key={task.id}
                    onClick={() => {
                      setSelectedCustomerId(task.customer_id);
                      setCurrentTab('tasks');
                    }}
                    className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200/20 text-left transition-all cursor-pointer group"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 group-hover:text-rose-600 dark:group-hover:text-rose-400">
                        {task.customer?.name}
                      </span>
                      <span className="text-[9px] font-semibold text-rose-500">{task.type}</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-1">
                      <Clock size={10} />
                      Due: {new Date(task.due_date).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Column 3: Pending Lead Updates */}
          <div className="p-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-3 flex items-center justify-between">
              <span>Overdue Follow-up Leads</span>
              <span className="h-5 w-5 rounded-full bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-500 flex items-center justify-center text-[10px] font-bold">
                {attentionItems.overdueLeads.length}
              </span>
            </h4>
            
            {attentionItems.overdueLeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center text-xs text-zinc-400">
                <p>No overdue follow-up leads.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                {attentionItems.overdueLeads.map(lead => (
                  <button 
                    key={lead.id}
                    onClick={() => {
                      setCurrentTab('leads');
                    }}
                    className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200/20 text-left transition-all cursor-pointer group"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 group-hover:text-amber-600 dark:group-hover:text-amber-500">
                        {lead.customer?.name}
                      </span>
                      <span className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300">
                        ₹{lead.expected_deal_value.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-1">
                      Overdue follow-up since {lead.follow_up_date ? new Date(lead.follow_up_date).toLocaleDateString() : 'N/A'}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Bottom Layout Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Quick Tips / Empty Guides */}
        <div className="p-6 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 shadow-sm flex flex-col justify-between lg:col-span-2">
          <div>
            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">How Krazey CRM helps you today:</h3>
            <ul className="mt-4 space-y-3.5 text-xs text-zinc-500 dark:text-zinc-400">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Immediate Follow-ups:</strong> Always look at the Overdue tasks list. A client who gets called back exactly at the scheduled time has a <strong>4x higher conversion rate</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  <strong>WhatsApp Simulation:</strong> Simulate incoming client inquiries by checking Settings or using the inbox shortcut below to trigger customer messages.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Visual Pipeline:</strong> Drag leads across stages in the Leads Board to quickly see total deal values. Keep stages updated to see clean metrics.
                </span>
              </li>
            </ul>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button 
              onClick={() => setCurrentTab('inbox')}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-semibold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer border border-emerald-600/10"
            >
              Open Inbox <ArrowRight size={14} />
            </button>
            <button 
              onClick={() => setCurrentTab('leads')}
              className="flex-1 flex items-center justify-center gap-2 bg-indigo-50 dark:bg-indigo-950/20 hover:bg-indigo-100 dark:hover:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer border border-indigo-600/10"
            >
              Open Pipeline <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Hot Leads list */}
        <div className="p-6 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 shadow-sm flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
              <Flame size={16} className="text-amber-500" />
              Hot Deals Pipeline
            </h3>
            <button 
              onClick={() => setCurrentTab('leads')}
              className="text-[10px] text-emerald-600 hover:underline cursor-pointer"
            >
              View all
            </button>
          </div>

          {/* List */}
          <div className="mt-4 flex-1 space-y-4">
            {metrics.hotLeads === 0 ? (
              <div className="text-center py-12 text-xs text-zinc-400">
                No hot leads marked. Edit a lead to change its priority to high.
              </div>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {attentionItems.overdueLeads.slice(0, 4).map(lead => (
                  <div key={lead.id} className="flex justify-between items-center p-2 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <div>
                      <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{lead.customer?.name}</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">Stage: {lead.stage}</p>
                    </div>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      ₹{lead.expected_deal_value.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
