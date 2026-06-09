import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Task, Customer } from '../../types';
import { 
  CheckSquare, 
  Square, 
  Trash2, 
  Clock, 
  CalendarCheck,
  Plus,
  Phone,
  MessageSquare,
  Users,
  AlertTriangle
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface TaskManagerProps {
  setCurrentTab: (tab: string) => void;
  setSelectedCustomerId: (id: string | null) => void;
}

export const TaskManager: React.FC<TaskManagerProps> = ({ setCurrentTab, setSelectedCustomerId }) => {
  const { business, profile } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // New task form states
  const [newCustId, setNewCustId] = useState('');
  const [newType, setNewType] = useState<'Call' | 'WhatsApp Follow-up' | 'Meeting' | 'Callback'>('Call');
  const [newDate, setNewDate] = useState('');
  const [showFormMobile, setShowFormMobile] = useState(false);
  
  // Filter states
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('pending');

  useEffect(() => {
    if (business) {
      fetchTasks();
      fetchCustomers();
    }
  }, [business]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, customer:customers(*)')
        .eq('business_id', business?.id)
        .order('due_date', { ascending: true });

      if (error) throw error;
      setTasks(data || []);
    } catch (e) {
      console.error('Error fetching tasks:', e);
    } finally {
      setLoading(false);
    }
  };

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
      console.error('Error fetching customers for tasks:', e);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustId || !newDate || !business) return;

    try {
      const { error } = await supabase.from('tasks').insert({
        business_id: business.id,
        customer_id: newCustId,
        type: newType,
        due_date: new Date(newDate).toISOString(),
        assigned_staff_id: profile?.id || null,
        status: 'pending'
      });

      if (error) throw error;
      
      setNewCustId('');
      setNewDate('');
      setShowFormMobile(false);
      fetchTasks();
    } catch (e) {
      console.error('Error creating task:', e);
    }
  };

  const toggleTaskStatus = async (taskId: string, currentStatus: 'pending' | 'completed') => {
    const nextStatus = currentStatus === 'pending' ? 'completed' : 'pending';
    
    // Optimistic Update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: nextStatus } : t));

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: nextStatus })
        .eq('id', taskId);

      if (error) throw error;
      fetchTasks();
    } catch (e) {
      console.error('Error updating task status:', e);
      fetchTasks();
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;
      fetchTasks();
    } catch (e) {
      console.error('Error deleting task:', e);
    }
  };

  // Split tasks into Overdue and Upcoming
  const now = new Date();
  
  const filteredTasks = tasks.filter(t => {
    const matchesType = typeFilter === 'all' || t.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesType && matchesStatus;
  });

  const overdueTasks = filteredTasks.filter(t => 
    t.status === 'pending' && new Date(t.due_date) < now
  );

  const upcomingTasks = filteredTasks.filter(t => 
    t.status === 'completed' || new Date(t.due_date) >= now
  );

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-6xl mx-auto w-full space-y-6">
      
      {/* Mobile Add Task Modal */}
      {showFormMobile && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-5 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-150 dark:border-zinc-800 mb-4">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-1.5">
                <CalendarCheck size={14} className="text-emerald-600" />
                Schedule Follow-up
              </h3>
              <button 
                onClick={() => setShowFormMobile(false)}
                className="h-8 w-8 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer font-bold text-sm"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mb-1">Select Customer *</label>
                <select
                  required
                  value={newCustId}
                  onChange={e => setNewCustId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-none"
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mb-1">Task Type *</label>
                <select
                  value={newType}
                  onChange={e => setNewType(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-none"
                >
                  <option value="Call">📞 Call</option>
                  <option value="WhatsApp Follow-up">💬 WhatsApp Follow-up</option>
                  <option value="Meeting">🤝 Meeting</option>
                  <option value="Callback">🔄 Callback</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mb-1">Due Date & Time *</label>
                <input
                  type="datetime-local"
                  required
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-md transition-colors"
              >
                Add Task
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-200/50 dark:border-zinc-800/50">
        <div className="flex justify-between items-center w-full md:w-auto">
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Task & Follow-up Center</h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">Stay on top of calls, messages, and meetings schedules.</p>
          </div>
          <button
            onClick={() => setShowFormMobile(true)}
            className="lg:hidden bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3.5 py-2 rounded-xl shadow-md cursor-pointer transition-all shrink-0"
          >
            + Schedule Task
          </button>
        </div>

        {/* Task Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="px-2.5 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
          >
            <option value="pending">Pending Tasks</option>
            <option value="completed">Completed Tasks</option>
            <option value="all">All Statuses</option>
          </select>

          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
          >
            <option value="all">All Types</option>
            <option value="Call">Calls Only</option>
            <option value="WhatsApp Follow-up">WhatsApp Only</option>
            <option value="Meeting">Meetings Only</option>
            <option value="Callback">Callbacks Only</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left col: Add Task Form (Desktop only) */}
        <div className="hidden lg:block p-4 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 shadow-sm h-fit">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-4 flex items-center gap-1.5">
            <CalendarCheck size={14} className="text-emerald-600" />
            Schedule Follow-up
          </h3>
          
          <form onSubmit={handleCreateTask} className="space-y-4">
            <div>
              <label className="block text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mb-1">Select Customer *</label>
              <select
                required
                value={newCustId}
                onChange={e => setNewCustId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-none"
              >
                <option value="">-- Choose Customer --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mb-1">Task Type *</label>
              <select
                value={newType}
                onChange={e => setNewType(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-none"
              >
                <option value="Call">📞 Call</option>
                <option value="WhatsApp Follow-up">💬 WhatsApp Follow-up</option>
                <option value="Meeting">🤝 Meeting</option>
                <option value="Callback">🔄 Callback</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mb-1">Due Date & Time *</label>
              <input
                type="datetime-local"
                required
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-md transition-colors"
            >
              Add Task
            </button>
          </form>
        </div>

        {/* Right col: Lists (Overdue & Upcoming) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Overdue Tasks Section */}
          {overdueTasks.length > 0 && (
            <div className="p-4 rounded-2xl border border-rose-200/50 dark:border-rose-950/20 bg-rose-50/10 dark:bg-rose-950/5 space-y-3 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-rose-500 flex items-center gap-1.5 animate-pulse">
                <AlertTriangle size={14} />
                Attention Required: Overdue Follow-ups ({overdueTasks.length})
              </h3>
              
              <div className="space-y-2.5">
                {overdueTasks.map(task => (
                  <div 
                    key={task.id} 
                    className="p-3.5 rounded-xl border border-rose-200/50 dark:border-rose-900/20 bg-white dark:bg-zinc-900 flex justify-between items-center shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <button 
                        onClick={() => toggleTaskStatus(task.id, task.status)}
                        className="text-rose-400 hover:text-emerald-600 shrink-0 mt-0.5"
                      >
                        <Square size={16} />
                      </button>
                      <div>
                        <button
                          onClick={() => {
                            setSelectedCustomerId(task.customer_id);
                            setCurrentTab('inbox');
                          }}
                          className="text-xs font-bold text-zinc-850 dark:text-zinc-100 hover:underline hover:text-rose-500 text-left"
                        >
                          {task.customer?.name}
                        </button>
                        <p className="text-[10px] text-zinc-400 mt-0.5">{task.customer?.phone} • <span className="font-semibold text-rose-500 capitalize">{task.type}</span></p>
                        
                        <span className="text-[9px] font-semibold text-rose-500 flex items-center gap-1 mt-1.5">
                          <Clock size={10} />
                          Overdue since: {new Date(task.due_date).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    <button 
                      onClick={() => handleDeleteTask(task.id)}
                      className="text-zinc-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming / Completed Section */}
          <div className="p-4 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              {statusFilter === 'completed' ? 'Completed Tasks' : 'Upcoming & Completed Tasks'}
            </h3>
            
            {loading ? (
              <div className="py-8 text-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent mx-auto"></div>
              </div>
            ) : upcomingTasks.length === 0 && overdueTasks.length === 0 ? (
              <div className="text-center py-12 text-xs text-zinc-400 italic">
                No scheduled tasks found. Use the sidebar scheduler to add tasks.
              </div>
            ) : upcomingTasks.length === 0 ? (
              <div className="text-center py-4 text-xs text-zinc-400">
                No upcoming follow-ups. Check the Overdue list!
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-0.5">
                {upcomingTasks.map(task => {
                  const isCompleted = task.status === 'completed';
                  
                  return (
                    <div 
                      key={task.id} 
                      className={cn(
                        "p-3 rounded-xl border flex justify-between items-center transition-opacity shadow-sm",
                        isCompleted 
                          ? "bg-zinc-50 dark:bg-zinc-900/30 border-zinc-200/30 dark:border-zinc-800/30 opacity-60" 
                          : "bg-white dark:bg-zinc-950 border-zinc-200/60 dark:border-zinc-850"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <button 
                          onClick={() => toggleTaskStatus(task.id, task.status)}
                          className={cn(
                            "shrink-0 mt-0.5",
                            isCompleted ? "text-emerald-500" : "text-zinc-400 hover:text-emerald-600"
                          )}
                        >
                          {isCompleted ? <CheckSquare size={16} /> : <Square size={16} />}
                        </button>
                        <div>
                          <button
                            onClick={() => {
                              setSelectedCustomerId(task.customer_id);
                              setCurrentTab('inbox');
                            }}
                            className={cn(
                              "text-xs font-bold hover:underline",
                              isCompleted 
                                ? "line-through text-zinc-500" 
                                : "text-zinc-850 dark:text-zinc-150 hover:text-emerald-600"
                            )}
                          >
                            {task.customer?.name}
                          </button>
                          <p className="text-[10px] text-zinc-400 mt-0.5">{task.customer?.phone} • <span className="font-semibold capitalize">{task.type}</span></p>
                          
                          <span className={cn(
                            "text-[9px] flex items-center gap-1 mt-1.5",
                            isCompleted ? "text-emerald-600" : "text-zinc-400"
                          )}>
                            <Clock size={10} />
                            {isCompleted 
                              ? 'Completed' 
                              : `Scheduled: ${new Date(task.due_date).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                            }
                          </span>
                        </div>
                      </div>

                      <button 
                        onClick={() => handleDeleteTask(task.id)}
                        className="text-zinc-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};
