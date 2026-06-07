import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Users, Kanban, Phone, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Customer, Lead } from '../../types';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectResult: (type: 'customer' | 'lead' | 'chat', id: string) => void;
}

export const SearchOverlay: React.FC<SearchOverlayProps> = ({ isOpen, onClose, onSelectResult }) => {
  const { business } = useAuth();
  const [query, setQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [leadResults, setLeadResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setCustomerResults([]);
      setLeadResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim() || !business) {
      setCustomerResults([]);
      setLeadResults([]);
      return;
    }

    const timer = setTimeout(() => {
      performSearch();
    }, 250);

    return () => clearTimeout(timer);
  }, [query, business]);

  const performSearch = async () => {
    setSearching(true);
    try {
      const trimmedQuery = query.trim();
      
      // Search customers by name, phone, or email
      const { data: customers, error: custError } = await supabase
        .from('customers')
        .select('*')
        .eq('business_id', business?.id)
        .or(`name.ilike.%${trimmedQuery}%,phone.ilike.%${trimmedQuery}%,email.ilike.%${trimmedQuery}%`)
        .limit(5);

      if (custError) throw custError;
      setCustomerResults(customers || []);

      // Search leads by stage or expected value (joining customer)
      const { data: leads, error: leadError } = await supabase
        .from('leads')
        .select('*, customer:customers(*)')
        .eq('business_id', business?.id)
        .or(`stage.ilike.%${trimmedQuery}%,priority.ilike.%${trimmedQuery}%`)
        .limit(5);

      if (leadError) throw leadError;
      
      // Also filter leads manually if the customer name matches
      const { data: allLeads, error: allLeadsError } = await supabase
        .from('leads')
        .select('*, customer:customers(*)')
        .eq('business_id', business?.id);
      
      if (allLeadsError) throw allLeadsError;

      const filteredLeadsByCustomer = allLeads?.filter(l => 
        l.customer?.name.toLowerCase().includes(trimmedQuery.toLowerCase())
      ).slice(0, 5) || [];

      // Combine and deduplicate leads
      const combinedLeads = [...(leads || [])];
      filteredLeadsByCustomer.forEach(l => {
        if (!combinedLeads.some(cl => cl.id === l.id)) {
          combinedLeads.push(l);
        }
      });

      setLeadResults(combinedLeads.slice(0, 5));
    } catch (e) {
      console.error('Error during search:', e);
    } finally {
      setSearching(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-zinc-950/50 backdrop-blur-md pt-20 animate-fade-in">
      <div 
        className="fixed inset-0" 
        onClick={onClose}
      />
      
      <div className="w-full max-w-2xl h-fit max-h-[70vh] rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-950 shadow-2xl relative flex flex-col overflow-hidden mx-4 animate-slide-in">
        
        {/* Search input line */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
          <Search className="text-zinc-400" size={20} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type to search customers, phone numbers, or leads..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-zinc-50 border-none outline-none focus:ring-0 focus:border-none"
          />
          {searching ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent"></div>
          ) : (
            <button 
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Search Results list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {query.trim() === '' && (
            <div className="py-8 text-center text-xs text-zinc-400 dark:text-zinc-500">
              Type something above to search the CRM workspace.
            </div>
          )}

          {query.trim() !== '' && customerResults.length === 0 && leadResults.length === 0 && !searching && (
            <div className="py-8 text-center text-xs text-zinc-400 dark:text-zinc-500">
              No matching records found for "{query}".
            </div>
          )}

          {/* Customers Results */}
          {customerResults.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2 pl-2">
                Customers ({customerResults.length})
              </h3>
              <div className="space-y-1">
                {customerResults.map(c => (
                  <button
                    key={c.id}
                    onClick={() => {
                      onSelectResult('customer', c.id);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900/50 text-left transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                        <Users size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                          {c.name}
                        </p>
                        <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5">
                          <Phone size={10} />
                          {c.phone}
                          {c.email && ` • ${c.email}`}
                        </p>
                      </div>
                    </div>
                    {c.tags.length > 0 && (
                      <div className="flex gap-1">
                        {c.tags.slice(0, 2).map((t, idx) => (
                          <span key={idx} className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded-full font-medium">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Leads Results */}
          {leadResults.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2 pl-2">
                Leads Pipeline ({leadResults.length})
              </h3>
              <div className="space-y-1">
                {leadResults.map(l => (
                  <button
                    key={l.id}
                    onClick={() => {
                      onSelectResult('lead', l.id);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900/50 text-left transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                        <Kanban size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                          {l.customer?.name}
                        </p>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          Stage: <span className="font-medium text-zinc-600 dark:text-zinc-300">{l.stage}</span> • Priority: <span className="capitalize">{l.priority}</span>
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                      ₹{l.expected_deal_value.toLocaleString('en-IN')}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
