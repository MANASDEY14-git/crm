import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { 
  Settings, 
  Building, 
  Users, 
  MessageSquare, 
  Bell, 
  RefreshCw,
  Smartphone,
  ShieldAlert,
  Save,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import { Profile } from '../../types';

export const SettingsPanel: React.FC = () => {
  const { business, profile, signOut } = useAuth();
  
  // States
  const [bizName, setBizName] = useState('');
  const [team, setTeam] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Mocks
  const [whatsappStatus, setWhatsappStatus] = useState({
    connected: true,
    phoneNumber: '+91 99999 88888',
    webhookUrl: 'https://yursqmhzwhjnjesmbjua.supabase.co/functions/v1/whatsapp-webhook',
    battery: '88%'
  });

  const [notificationSettings, setNotificationSettings] = useState({
    newChat: true,
    overdueTask: true,
    emailDailyReport: false
  });

  useEffect(() => {
    if (business) {
      setBizName(business.name);
      fetchTeamMembers();
    }
  }, [business]);

  const fetchTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('business_id', business?.id);
      
      if (error) throw error;
      setTeam(data || []);
    } catch (e) {
      console.error('Error fetching team members:', e);
    }
  };

  const handleUpdateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business || !bizName.trim()) return;

    setLoading(true);
    setSaveSuccess(false);

    try {
      const { error } = await supabase
        .from('businesses')
        .update({ name: bizName })
        .eq('id', business.id);

      if (error) throw error;
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error('Error updating business:', e);
      alert('Failed to update business: ' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetData = async () => {
    if (!confirm('WARNING: This will delete all customers, leads, tasks, and conversations for this business to start testing clean. Continue?')) return;
    
    setLoading(true);
    try {
      if (!business) return;

      // 1. Delete notes
      await supabase.from('notes').delete().eq('business_id', business.id);
      
      // 2. Delete tasks
      await supabase.from('tasks').delete().eq('business_id', business.id);

      // 3. Delete messages
      const { data: convs } = await supabase.from('conversations').select('id').eq('business_id', business.id);
      if (convs && convs.length > 0) {
        const convIds = convs.map(c => c.id);
        await supabase.from('messages').delete().in('conversation_id', convIds);
      }

      // 4. Delete conversations
      await supabase.from('conversations').delete().eq('business_id', business.id);

      // 5. Delete leads
      await supabase.from('leads').delete().eq('business_id', business.id);

      // 6. Delete customers
      await supabase.from('customers').delete().eq('business_id', business.id);

      alert('Database cleared successfully! Go to Dashboard to click refresh or Quick Add to add clean data.');
      window.location.reload();
    } catch (e) {
      console.error('Error clearing data:', e);
      alert('Failed to clear data: ' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full space-y-6">
      
      {/* Title */}
      <div className="pb-4 border-b border-zinc-200/50 dark:border-zinc-800/50">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">CRM Settings</h2>
        <p className="text-[11px] text-zinc-500 mt-0.5">Manage your team members, WhatsApp integrations, and workspace parameters.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left: Settings Index (Navigation highlights) */}
        <div className="space-y-4 sticky top-4">
          <div className="p-3 bg-zinc-50/50 dark:bg-zinc-900/30 rounded-2xl border border-zinc-200/30 dark:border-zinc-800/30 space-y-1">
            <button className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 flex items-center gap-2">
              <Building size={14} /> Business & Workspace
            </button>
            <button className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 flex items-center gap-2">
              <MessageSquare size={14} /> WhatsApp Status
            </button>
            <button className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 flex items-center gap-2">
              <Users size={14} /> Team Management
            </button>
          </div>
        </div>

        {/* Right: Panels Container (Col span 2) */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Section 1: Business profile */}
          <div className="p-5 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
              <Building size={14} className="text-emerald-600" />
              Business Profile
            </h3>
            
            <form onSubmit={handleUpdateBusiness} className="space-y-4">
              <div>
                <label className="block text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mb-1">Company / Store Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Royal Furniture Plaza"
                  value={bizName}
                  onChange={e => setBizName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-none"
                />
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-500 text-white font-semibold text-xs px-4 py-2 rounded-xl cursor-pointer shadow-sm transition-colors"
                >
                  <Save size={13} />
                  Save Changes
                </button>

                {saveSuccess && (
                  <span className="text-[10px] text-emerald-600 flex items-center gap-1 animate-fade-in">
                    <CheckCircle size={12} /> Saved!
                  </span>
                )}
              </div>
            </form>
          </div>

          {/* Section 2: WhatsApp Webhook/Connection Status */}
          <div className="p-5 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
              <MessageSquare size={14} className="text-emerald-600" />
              WhatsApp Integration Status
            </h3>

            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200/20 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-500">Connection State:</span>
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                  <span className="h-2 w-2 bg-emerald-600 rounded-full animate-ping"></span>
                  Active / Connected
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500">Sender Number:</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{whatsappStatus.phoneNumber}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500">Webhook Sync endpoint:</span>
                <span className="font-mono text-[9px] bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded text-zinc-600 dark:text-zinc-400 select-all truncate max-w-[180px]">
                  {whatsappStatus.webhookUrl}
                </span>
              </div>
              <div className="text-[9px] text-zinc-400 border-t border-zinc-200/20 pt-2 flex items-center gap-1">
                <Smartphone size={10} />
                <span>Simulated status: All messages trigger backend updates only. Front-end is secured.</span>
              </div>
            </div>
          </div>

          {/* Section 3: Team list */}
          <div className="p-5 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
              <Users size={14} className="text-emerald-600" />
              Team Members ({team.length})
            </h3>

            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {team.map(member => (
                <div key={member.id} className="py-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full flex items-center justify-center font-bold">
                      {member.full_name?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-800 dark:text-zinc-200">{member.full_name}</p>
                      <p className="text-[10px] text-zinc-400">{member.email}</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 capitalize">
                    {member.role === 'admin' ? 'Owner' : 'Sales staff'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Testing & Danger Zone */}
          <div className="p-5 rounded-2xl border border-rose-200/40 dark:border-rose-950/20 bg-rose-50/5 dark:bg-rose-950/5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-rose-500 flex items-center gap-1.5">
              <ShieldAlert size={14} />
              Developer Actions / Danger Zone
            </h3>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Reset Workspace Data</p>
                <p className="text-[10px] text-zinc-400 mt-0.5">Delete all chats, customers, leads, and tasks to reset the workspace to a clean state.</p>
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={handleResetData}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-zinc-500 text-white font-semibold text-xs rounded-xl cursor-pointer shadow-sm transition-colors shrink-0"
              >
                Clear All Data
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
