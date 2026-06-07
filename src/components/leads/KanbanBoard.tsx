import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Lead, Customer } from '../../types';
import { 
  Flame, 
  Calendar, 
  Plus, 
  ChevronRight,
  TrendingUp,
  Edit2,
  Check,
  X
} from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';

interface KanbanBoardProps {
  setCurrentTab: (tab: string) => void;
  setSelectedCustomerId: (id: string | null) => void;
}

type Stage = 'New Inquiry' | 'Contacted' | 'Interested' | 'Follow-up Pending' | 'Quotation Sent' | 'Won' | 'Lost';

const STAGES: Stage[] = [
  'New Inquiry',
  'Contacted',
  'Interested',
  'Follow-up Pending',
  'Quotation Sent',
  'Won',
  'Lost'
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ setCurrentTab, setSelectedCustomerId }) => {
  const { business } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
// State-backed drag-and-drop fallback (for environments where dataTransfer may be unreliable)
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  
  // Card Edit Modal/Popovers
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editPriority, setEditPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [editFollowUp, setEditFollowUp] = useState('');

  useEffect(() => {
    if (business) {
      fetchLeads();
    }
  }, [business]);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*, customer:customers(*)')
        .eq('business_id', business?.id);

      if (error) throw error;
      setLeads(data || []);
    } catch (e) {
      console.error('Error fetching leads:', e);
    } finally {
      setLoading(false);
    }
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    // Store lead ID via native dataTransfer (desktop browsers) and also in React state for fallback (e.g., mobile or browsers with restricted dataTransfer)
    e.dataTransfer.setData('text/plain', leadId);
    setDraggedLeadId(leadId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetStage: Stage) => {
    e.preventDefault();
    // Prefer native dataTransfer; fallback to state if empty (e.g., some mobile browsers)
    const leadIdFromDt = e.dataTransfer.getData('text/plain');
    const leadId = leadIdFromDt || draggedLeadId;
    // Clear fallback after drop
    setDraggedLeadId(null);

    if (!leadId) return;

    // Optimistic Update
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: targetStage } : l));

    try {
      const { error } = await supabase
        .from('leads')
        .update({ stage: targetStage })
        .eq('id', leadId);

      if (error) throw error;
      fetchLeads();
    } catch (e) {
      console.error('Error updating lead stage on drop:', e);
      fetchLeads(); // rollback on error
    }
  };

  const startEditing = (lead: any) => {
    setEditingLeadId(lead.id);
    setEditValue(lead.expected_deal_value.toString());
    setEditPriority(lead.priority);
    setEditFollowUp(lead.follow_up_date ? lead.follow_up_date.slice(0, 16) : '');
  };

  const saveEdit = async (leadId: string) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({
          expected_deal_value: Number(editValue) || 0,
          priority: editPriority,
          follow_up_date: editFollowUp ? new Date(editFollowUp).toISOString() : null
        })
        .eq('id', leadId);

      if (error) throw error;
      setEditingLeadId(null);
      fetchLeads();
    } catch (e) {
      console.error('Error updating lead:', e);
    }
  };

  // Calculations for Column Headers
  const getStageStats = (stage: Stage) => {
    const stageLeads = leads.filter(l => l.stage === stage);
    const totalValue = stageLeads.reduce((sum, l) => sum + Number(l.expected_deal_value), 0);
    return {
      count: stageLeads.length,
      value: totalValue
    };
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
      
      {/* Kanban Header */}
      <div className="h-16 border-b border-zinc-200/50 dark:border-zinc-800/50 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Sales Pipeline Board</h2>
          <p className="text-[11px] text-zinc-500 mt-0.5">Drag cards to update stages. Keep values updated for clean sales predictions.</p>
        </div>
        
        <div className="flex items-center gap-4 text-xs font-semibold">
          <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-200/20">
            <TrendingUp size={14} className="text-emerald-600" />
            <span>Total Active Pipeline: </span>
            <span className="font-bold text-zinc-900 dark:text-zinc-100">
              {formatCurrency(leads.filter(l => l.stage !== 'Won' && l.stage !== 'Lost').reduce((sum, l) => sum + Number(l.expected_deal_value), 0))}
            </span>
          </div>
        </div>
      </div>

      {/* Board Scroll Container */}
      <div className="flex-1 overflow-x-auto p-6 flex gap-4 items-start select-none bg-zinc-50/50 dark:bg-zinc-900/10">
        {STAGES.map(stage => {
          const stageLeads = leads.filter(l => l.stage === stage);
          const { count, value } = getStageStats(stage);

          // Header border colors based on stage
          let headerBorder = "border-zinc-300 dark:border-zinc-800";
          if (stage === 'Interested') headerBorder = "border-indigo-500/50";
          else if (stage === 'Follow-up Pending') headerBorder = "border-amber-500/50";
          else if (stage === 'Quotation Sent') headerBorder = "border-sky-500/50";
          else if (stage === 'Won') headerBorder = "border-emerald-500/50";
          else if (stage === 'Lost') headerBorder = "border-rose-500/50";

          return (
            <div
              key={stage}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stage)}
              className="w-72 max-h-full flex flex-col bg-zinc-100/60 dark:bg-zinc-900/40 border border-zinc-200/40 dark:border-zinc-800/40 rounded-2xl p-3 shrink-0"
            >
              
              {/* Column Title */}
              <div className={cn("pb-2 mb-3 border-b-2 flex flex-col gap-1", headerBorder)}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate pr-2">
                    {stage}
                  </span>
                  <span className="text-[10px] bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-2 py-0.5 rounded-full font-bold">
                    {count}
                  </span>
                </div>
                <span className="text-[10px] text-zinc-400 font-semibold">
                  {formatCurrency(value)}
                </span>
              </div>

              {/* Column Lead Cards list */}
              <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[calc(100vh-16rem)] pr-0.5">
                {stageLeads.length === 0 ? (
                  <div className="py-8 text-center text-[10px] text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                    No leads here.
                  </div>
                ) : (
                  stageLeads.map(lead => {
                    const isEditing = editingLeadId === lead.id;
                    
                    // Priority border indicators
                    let priorityBorder = "border-l-2 border-l-zinc-300";
                    if (lead.priority === 'high') priorityBorder = "border-l-2 border-l-rose-500";
                    else if (lead.priority === 'medium') priorityBorder = "border-l-2 border-l-amber-500";
                    
                    return (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, lead.id)}
                        onDragEnd={() => setDraggedLeadId(null)}
                        className={cn(
                          "p-3 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200/50 dark:border-zinc-800/50 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing",
                          priorityBorder
                        )}
                      >
                        
                        {/* Card View */}
                        {!isEditing ? (
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <button 
                                onClick={() => {
                                  setSelectedCustomerId(lead.customer_id);
                                  setCurrentTab('inbox');
                                }}
                                className="text-xs font-bold text-zinc-800 dark:text-zinc-200 hover:text-emerald-600 text-left truncate hover:underline"
                              >
                                {lead.customer?.name}
                              </button>
                              
                              <button 
                                onClick={() => startEditing(lead)}
                                className="h-5 w-5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-zinc-600 cursor-pointer shrink-0"
                              >
                                <Edit2 size={10} />
                              </button>
                            </div>

                            <p className="text-[10px] text-zinc-400">{lead.customer?.phone}</p>

                            <div className="flex justify-between items-center pt-1 border-t border-zinc-50 dark:border-zinc-900/60">
                              <span className="text-[10px] font-bold text-zinc-800 dark:text-zinc-200">
                                {formatCurrency(lead.expected_deal_value)}
                              </span>
                              
                              {lead.priority === 'high' && (
                                <span className="text-[8px] bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-0.5">
                                  <Flame size={8} fill="currentColor" />
                                  Hot
                                </span>
                              )}
                            </div>

                            {/* Overdue Indicator */}
                            {lead.follow_up_date && (
                              <div className={cn(
                                "flex items-center gap-1 text-[9px] font-medium mt-1",
                                new Date(lead.follow_up_date) < new Date() ? "text-rose-500" : "text-zinc-400"
                              )}>
                                <Calendar size={8} />
                                <span>
                                  Follow-up: {new Date(lead.follow_up_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          
                          /* Card Edit Inline Form */
                          <div className="space-y-2 animate-fade-in">
                            <div>
                              <label className="text-[9px] text-zinc-400 font-bold block mb-0.5">Value (₹)</label>
                              <input
                                type="number"
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                className="w-full px-2 py-1 text-[11px] rounded bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
                              />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-1.5">
                              <div>
                                <label className="text-[9px] text-zinc-400 font-bold block mb-0.5">Priority</label>
                                <select
                                  value={editPriority}
                                  onChange={e => setEditPriority(e.target.value as any)}
                                  className="w-full px-1 py-0.5 text-[10px] rounded bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
                                >
                                  <option value="low">Low</option>
                                  <option value="medium">Medium</option>
                                  <option value="high">High</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-[9px] text-zinc-400 font-bold block mb-0.5">Follow-up</label>
                                <input
                                  type="datetime-local"
                                  value={editFollowUp}
                                  onChange={e => setEditFollowUp(e.target.value)}
                                  className="w-full px-1 py-0.5 text-[10px] rounded bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
                                />
                              </div>
                            </div>

                            <div className="flex gap-2 justify-end mt-2">
                              <button
                                onClick={() => setEditingLeadId(null)}
                                className="p-1 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                              >
                                <X size={12} />
                              </button>
                              <button
                                onClick={() => saveEdit(lead.id)}
                                className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded cursor-pointer"
                              >
                                <Check size={12} />
                              </button>
                            </div>
                          </div>
                        )}

                      </div>
                    );
                  })
                )}
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
};
