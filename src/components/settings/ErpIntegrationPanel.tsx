import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { ErpSyncLog } from '../../types';
import {
  Database,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Save,
  Eye,
  EyeOff,
  Zap,
  Calendar,
  Users,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export const ErpIntegrationPanel: React.FC = () => {
  const { business } = useAuth();

  // Config state
  const [erpUrl, setErpUrl] = useState('');
  const [newErpAnonKey, setNewErpAnonKey] = useState(''); // write-only: never pre-populated
  const [erpEnabled, setErpEnabled] = useState(false);
  const [syncSchedule, setSyncSchedule] = useState<'manual' | 'daily'>('manual');
  const [showKey, setShowKey] = useState(false);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string; customers_created?: number; customers_updated?: number; leads_created?: number } | null>(null);

  // Logs state
  const [syncLogs, setSyncLogs] = useState<ErpSyncLog[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchSyncLogs = useCallback(async () => {
    if (!business) return;
    const { data } = await supabase
      .from('erp_sync_logs')
      .select('*')
      .eq('business_id', business.id)
      .order('started_at', { ascending: false })
      .limit(5);
    setSyncLogs((data as ErpSyncLog[]) || []);
  }, [business]);

  useEffect(() => {
    if (business) {
      setErpUrl(business.erp_supabase_url || '');
      // SECURITY: Never load raw anon key into state. It stays server-side.
      // newErpAnonKey starts empty — user must enter a new key to update it.
      setNewErpAnonKey('');
      setErpEnabled(business.erp_enabled ?? false);
      setSyncSchedule((business.erp_sync_schedule as 'manual' | 'daily') || 'manual');
      fetchSyncLogs();
    }
  }, [business, fetchSyncLogs]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business) return;
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      // Build payload — only include anon key if a new one was typed
      const updatePayload: Record<string, any> = {
        erp_supabase_url: erpUrl.trim() || null,
        erp_enabled: erpEnabled,
        erp_sync_schedule: syncSchedule,
      };
      if (newErpAnonKey.trim()) {
        updatePayload.erp_supabase_anon_key = newErpAnonKey.trim();
      }

      const { error } = await supabase
        .from('businesses')
        .update(updatePayload)
        .eq('id', business.id);
      if (error) throw error;

      // Clear write-only field after save
      setNewErpAnonKey('');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      alert('Failed to save ERP config: ' + (err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncNow = async () => {
    if (!business || isSyncing) return;
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
      const res = await fetch(`${supabaseUrl}/functions/v1/erp-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ business_id: business.id }),
      });

      const json = await res.json();

      if (json.error) {
        setSyncResult({ success: false, message: json.error });
      } else {
        setSyncResult({
          success: true,
          message: `Sync complete!`,
          customers_created: json.customers_created,
          customers_updated: json.customers_updated,
          leads_created: json.leads_created,
        });
      }
      fetchSyncLogs();
    } catch (err) {
      setSyncResult({ success: false, message: (err as Error).message });
    } finally {
      setIsSyncing(false);
    }
  };

  const lastSyncedAt = business?.erp_last_synced_at;
  const lastLog = syncLogs[0];

  return (
    <div className="p-5 rounded-2xl border border-indigo-200/40 dark:border-indigo-900/30 bg-white dark:bg-zinc-900 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
          <Database size={14} className="text-indigo-500" />
          ERP Integration — Krazey ERP
        </h3>
        {/* Status pill */}
        {erpEnabled ? (
          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-full">
            <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
            Connected
          </span>
        ) : (
          <span className="text-[10px] font-bold text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
            Disabled
          </span>
        )}
      </div>

      {/* Last sync summary */}
      {lastSyncedAt && (
        <div className="flex flex-wrap gap-3 p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100/50 dark:border-indigo-900/20">
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
            <Clock size={11} className="text-indigo-400" />
            Last synced: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{new Date(lastSyncedAt).toLocaleString('en-IN')}</span>
          </div>
          {lastLog && lastLog.status === 'success' && (
            <>
              <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                <Users size={11} className="text-emerald-500" />
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">{lastLog.customers_created}</span> new customers
              </div>
              <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                <TrendingUp size={11} className="text-emerald-500" />
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">{lastLog.leads_created}</span> Won leads created
              </div>
            </>
          )}
        </div>
      )}

      {/* Config form */}
      <form onSubmit={handleSaveConfig} className="space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/30 dark:border-zinc-700/30">
          <div className="flex-1">
            <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Enable ERP Sync</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">Pull customers & ledger data from Krazey ERP automatically</p>
          </div>
          <button
            type="button"
            onClick={() => setErpEnabled(!erpEnabled)}
            className={cn(
              'relative h-5 w-9 rounded-full transition-colors shrink-0 cursor-pointer',
              erpEnabled ? 'bg-indigo-500' : 'bg-zinc-300 dark:bg-zinc-600'
            )}
          >
            <span className={cn(
              'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
              erpEnabled ? 'translate-x-4' : 'translate-x-0.5'
            )} />
          </button>
        </div>

        <div>
          <label className="block text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mb-1">
            ERP Supabase Project URL
          </label>
          <input
            type="url"
            placeholder="https://xxxxxx.supabase.co"
            value={erpUrl}
            onChange={e => setErpUrl(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
          />
        </div>

        <div>
          <label className="block text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mb-1">
            ERP Supabase Anon Key {business?.has_erp_key && <span className="text-emerald-600 ml-1">(✓ already set — enter new value to replace)</span>}
          </label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              placeholder={business?.has_erp_key ? "Leave blank to keep existing key" : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}
              value={newErpAnonKey}
              onChange={e => setNewErpAnonKey(e.target.value)}
              autoComplete="new-password"
              className="w-full pl-3 pr-9 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2.5 top-2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
            >
              {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mb-1">
            Sync Schedule
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['manual', 'daily'] as const).map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => setSyncSchedule(opt)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer',
                  syncSchedule === opt
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300'
                    : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-300'
                )}
              >
                {opt === 'manual' ? <Zap size={12} /> : <Calendar size={12} />}
                {opt === 'manual' ? 'Manual Only' : 'Daily at Midnight'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-400 text-white font-semibold text-xs px-4 py-2 rounded-xl cursor-pointer shadow-sm transition-colors"
          >
            <Save size={12} />
            {isSaving ? 'Saving…' : 'Save Config'}
          </button>
          {saveSuccess && (
            <span className="text-[10px] text-emerald-600 flex items-center gap-1">
              <CheckCircle size={12} /> Saved!
            </span>
          )}
        </div>
      </form>

      {/* Divider */}
      <div className="border-t border-zinc-100 dark:border-zinc-800" />

      {/* Sync Now */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Pull from ERP Now</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">
              Fetches all customers + ledger balances from Krazey ERP. New customers get a <span className="font-bold text-emerald-600">Won</span> lead automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSyncNow}
            disabled={isSyncing || !erpEnabled}
            className={cn(
              'flex items-center gap-1.5 font-semibold text-xs px-4 py-2 rounded-xl shadow-sm transition-all cursor-pointer shrink-0',
              !erpEnabled
                ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed dark:bg-zinc-800'
                : 'bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-400 text-white'
            )}
          >
            <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
            {isSyncing ? 'Syncing…' : 'Sync Now'}
          </button>
        </div>

        {/* Sync result toast */}
        {syncResult && (
          <div className={cn(
            'p-3 rounded-xl border text-xs space-y-1',
            syncResult.success
              ? 'bg-emerald-50 dark:bg-emerald-950/10 border-emerald-200/50 dark:border-emerald-900/30'
              : 'bg-rose-50 dark:bg-rose-950/10 border-rose-200/50 dark:border-rose-900/30'
          )}>
            <div className="flex items-center gap-1.5 font-semibold">
              {syncResult.success
                ? <CheckCircle size={13} className="text-emerald-600" />
                : <XCircle size={13} className="text-rose-600" />}
              <span className={syncResult.success ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}>
                {syncResult.message}
              </span>
            </div>
            {syncResult.success && (
              <div className="flex gap-4 text-[10px] text-zinc-500 pl-5">
                <span><strong className="text-zinc-700 dark:text-zinc-300">{syncResult.customers_created}</strong> new customers</span>
                <span><strong className="text-zinc-700 dark:text-zinc-300">{syncResult.customers_updated}</strong> updated</span>
                <span><strong className="text-emerald-600">{syncResult.leads_created}</strong> Won leads created</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sync History */}
      {syncLogs.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1 text-[10px] font-semibold text-zinc-400 hover:text-zinc-600 cursor-pointer"
          >
            {showHistory ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            Sync History (last {syncLogs.length} runs)
          </button>

          {showHistory && (
            <div className="rounded-xl overflow-hidden border border-zinc-100 dark:border-zinc-800">
              {syncLogs.map((log, i) => (
                <div
                  key={log.id}
                  className={cn(
                    'flex items-center justify-between px-3 py-2 text-[10px]',
                    i % 2 === 0 ? 'bg-zinc-50/50 dark:bg-zinc-900/20' : 'bg-white dark:bg-zinc-900'
                  )}
                >
                  <div className="flex items-center gap-2">
                    {log.status === 'success' && <CheckCircle size={11} className="text-emerald-500 shrink-0" />}
                    {log.status === 'failed' && <XCircle size={11} className="text-rose-500 shrink-0" />}
                    {log.status === 'running' && <RefreshCw size={11} className="text-indigo-500 animate-spin shrink-0" />}
                    <span className="text-zinc-600 dark:text-zinc-400 font-mono">
                      {new Date(log.started_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-zinc-500">
                    {log.status === 'success' ? (
                      <>
                        <span className="text-emerald-600 font-semibold">+{log.customers_created} customers</span>
                        <span className="text-indigo-500 font-semibold">+{log.leads_created} Won leads</span>
                      </>
                    ) : log.status === 'failed' ? (
                      <span className="text-rose-500 flex items-center gap-1">
                        <AlertCircle size={10} />
                        Failed
                      </span>
                    ) : (
                      <span className="text-zinc-400">Running…</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
