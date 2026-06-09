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
  HelpCircle,
  Copy,
  Database
} from 'lucide-react';
import { Profile } from '../../types';
import { ErpIntegrationPanel } from './ErpIntegrationPanel';

export const SettingsPanel: React.FC = () => {
  const { business, profile, signOut } = useAuth();
  
  // States
  const [bizName, setBizName] = useState('');
  const [team, setTeam] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Provider State
  const [whatsappProvider, setWhatsappProvider] = useState<'ycloud' | 'openwa'>('ycloud');

  // YCloud States — write-only form fields (never pre-populated with existing key value)
  const [newYcloudApiKey, setNewYcloudApiKey] = useState('');
  const [ycloudSenderPhone, setYcloudSenderPhone] = useState('');

  // OpenWA States — write-only form fields
  const [newOpenwaApiKey, setNewOpenwaApiKey] = useState('');
  const [openwaApiUrl, setOpenwaApiUrl] = useState('');
  const [openwaSessionId, setOpenwaSessionId] = useState('my-bot');

  const [saveWhatsappSuccess, setSaveWhatsappSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`;

  const activeWebhookUrl = whatsappProvider === 'openwa' && business
    ? `${webhookUrl}?business_id=${business.id}&provider=openwa`
    : webhookUrl;

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(activeWebhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUpdateWhatsAppSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business) return;

    setLoading(true);
    setSaveWhatsappSuccess(false);

    try {
      // Build update payload — only include key if a new one was entered
      const updatePayload: Record<string, any> = {
        whatsapp_provider: whatsappProvider,
        ycloud_sender_phone: ycloudSenderPhone.trim() || null,
        openwa_api_url: openwaApiUrl.trim() || null,
        openwa_session_id: openwaSessionId.trim() || 'my-bot',
      };

      // Only overwrite stored keys if the user typed a new value
      if (newYcloudApiKey.trim()) {
        updatePayload.ycloud_api_key = newYcloudApiKey.trim();
      }
      if (newOpenwaApiKey.trim()) {
        updatePayload.openwa_api_key = newOpenwaApiKey.trim();
      }

      const { error } = await supabase
        .from('businesses')
        .update(updatePayload)
        .eq('id', business.id);

      if (error) throw error;

      // Clear the write-only key inputs after save
      setNewYcloudApiKey('');
      setNewOpenwaApiKey('');

      setSaveWhatsappSuccess(true);
      setTimeout(() => {
        setSaveWhatsappSuccess(false);
        window.location.reload();
      }, 1500);
    } catch (e) {
      console.error('Error updating WhatsApp settings:', e);
      alert('Failed to update WhatsApp settings: ' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const [notificationSettings, setNotificationSettings] = useState({
    newChat: true,
    overdueTask: true,
    emailDailyReport: false
  });

  useEffect(() => {
    if (business) {
      setBizName(business.name);
      setWhatsappProvider((business.whatsapp_provider as 'ycloud' | 'openwa') || 'ycloud');
      // SECURITY: Never load raw API keys into state. Load safe fields only.
      setYcloudSenderPhone(business.ycloud_sender_phone || '');
      setOpenwaApiUrl(business.openwa_api_url || '');
      setOpenwaSessionId(business.openwa_session_id || 'my-bot');
      // Key inputs start empty — user must re-enter to update
      setNewYcloudApiKey('');
      setNewOpenwaApiKey('');
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
            <button className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 flex items-center gap-2">
              <Database size={14} /> ERP Integration
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

          {/* Section 2: WhatsApp Integration */}
          <div className="p-5 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
                <MessageSquare size={14} className="text-emerald-600" />
                WhatsApp Integration ({whatsappProvider === 'openwa' ? 'OpenWA' : 'YCloud'})
              </h3>
            </div>

            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200/20 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-500">Connection State:</span>
                {whatsappProvider === 'openwa' ? (
                  business?.has_openwa_key ? (
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                      <span className="h-2 w-2 bg-emerald-600 rounded-full animate-ping"></span>
                      Active (Connected via OpenWA)
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-amber-600 flex items-center gap-1.5">
                      <span className="h-2 w-2 bg-amber-500 rounded-full"></span>
                      Demo Mode (Simulated)
                    </span>
                  )
                ) : (
                  business?.has_ycloud_key && ycloudSenderPhone ? (
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                      <span className="h-2 w-2 bg-emerald-600 rounded-full animate-ping"></span>
                      Active (Connected via YCloud)
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-amber-600 flex items-center gap-1.5">
                      <span className="h-2 w-2 bg-amber-500 rounded-full"></span>
                      Demo Mode (Simulated)
                    </span>
                  )
                )}
              </div>
              
              {whatsappProvider === 'openwa' ? (
                openwaSessionId && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-500">Session ID:</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">{openwaSessionId}</span>
                  </div>
                )
              ) : (
                ycloudSenderPhone && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-500">Sender Number:</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">{ycloudSenderPhone}</span>
                  </div>
                )
              )}

              {/* Key status indicators — boolean only, never display the actual key */}
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500">API Key:</span>
                {whatsappProvider === 'ycloud' ? (
                  business?.has_ycloud_key
                    ? <span className="text-emerald-600 font-semibold text-[10px] flex items-center gap-1">✓ Configured</span>
                    : <span className="text-amber-500 font-semibold text-[10px]">Not set</span>
                ) : (
                  business?.has_openwa_key
                    ? <span className="text-emerald-600 font-semibold text-[10px] flex items-center gap-1">✓ Configured</span>
                    : <span className="text-amber-500 font-semibold text-[10px]">Not set</span>
                )}
              </div>
              
              <div className="flex justify-between items-center text-xs gap-4">
                <span className="text-zinc-500 shrink-0">Webhook Sync URL:</span>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-mono text-[9px] bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded text-zinc-600 dark:text-zinc-400 select-all truncate">
                    {activeWebhookUrl}
                  </span>
                  <button
                    onClick={handleCopyWebhook}
                    className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 cursor-pointer shrink-0 transition-colors"
                    title="Copy Webhook URL"
                  >
                    {copied ? (
                      <span className="text-[8px] font-bold text-emerald-600">Copied!</span>
                    ) : (
                      <Copy size={11} />
                    )}
                  </button>
                </div>
              </div>
              <div className="text-[9px] text-zinc-400 border-t border-zinc-200/20 pt-2 flex items-center gap-1">
                <Smartphone size={10} />
                <span>
                  {whatsappProvider === 'openwa' 
                    ? "Configure this webhook URL in your OpenWA dashboard or API settings for message.received events."
                    : "Configure this webhook URL in your YCloud dashboard for whatsapp.inbound_message.received events."
                  }
                </span>
              </div>
            </div>

            {/* Credentials Form */}
            <form onSubmit={handleUpdateWhatsAppSettings} className="space-y-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Configure WhatsApp Integration
              </h4>

              <div>
                <label className="block text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mb-1">
                  WhatsApp Integration Provider
                </label>
                <select
                  value={whatsappProvider}
                  onChange={e => setWhatsappProvider(e.target.value as 'ycloud' | 'openwa')}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                >
                  <option value="ycloud">YCloud WhatsApp Business API</option>
                  <option value="openwa">OpenWA (Self-hosted WhatsApp API Gateway)</option>
                </select>
              </div>
              
              {whatsappProvider === 'ycloud' ? (
                <>
                  <div>
                    <label className="block text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mb-1">
                      YCloud API Key {business?.has_ycloud_key && <span className="text-emerald-600 ml-1">(✓ already set — enter new value to replace)</span>}
                    </label>
                    <input
                      type="password"
                      placeholder={business?.has_ycloud_key ? "Leave blank to keep existing key" : "Paste your YCloud API Key..."}
                      value={newYcloudApiKey}
                      onChange={e => setNewYcloudApiKey(e.target.value)}
                      autoComplete="new-password"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mb-1">
                      WhatsApp Sender Phone Number (E.164 format)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. +919999988888"
                      value={ycloudSenderPhone}
                      onChange={e => setYcloudSenderPhone(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-none"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mb-1">
                      OpenWA API Base URL
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. http://localhost:2785/api"
                      value={openwaApiUrl}
                      onChange={e => setOpenwaApiUrl(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mb-1">
                      OpenWA API Key (X-API-Key) {business?.has_openwa_key && <span className="text-emerald-600 ml-1">(✓ already set — enter new value to replace)</span>}
                    </label>
                    <input
                      type="password"
                      placeholder={business?.has_openwa_key ? "Leave blank to keep existing key" : "Paste your OpenWA API Key..."}
                      value={newOpenwaApiKey}
                      onChange={e => setNewOpenwaApiKey(e.target.value)}
                      autoComplete="new-password"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mb-1">
                      OpenWA Session ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. my-bot"
                      value={openwaSessionId}
                      onChange={e => setOpenwaSessionId(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-none"
                    />
                  </div>
                </>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-500 text-white font-semibold text-xs px-4 py-2 rounded-xl cursor-pointer shadow-sm transition-colors"
                >
                  <Save size={13} />
                  Save WhatsApp Settings
                </button>

                {saveWhatsappSuccess && (
                  <span className="text-[10px] text-emerald-600 flex items-center gap-1 animate-fade-in">
                    <CheckCircle size={12} /> Saved & Refreshing...
                  </span>
                )}
              </div>
            </form>
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

          {/* Section ERP Integration */}
          <ErpIntegrationPanel />

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
