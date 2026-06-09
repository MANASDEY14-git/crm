import React, { useState } from 'react';
import { Search, Bell, Plus, User, HelpCircle, Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  onSearchClick: () => void;
  onQuickAddClick: () => void;
  onMenuClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onSearchClick, onQuickAddClick, onMenuClick }) => {
  const { profile } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);

  // Mock Notifications for UX experience
  const notifications = [
    { id: 1, title: 'Follow-up Overdue', description: 'Vikram Singh call was due 2 hours ago.', time: '2h ago' },
    { id: 2, title: 'New Message', description: 'Ananya Rao: "Can you share the catalog..."', time: '3h ago' },
  ];

  return (
    <header className="h-16 border-b border-zinc-200/50 dark:border-zinc-800/50 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-md px-4 md:px-6 flex items-center justify-between sticky top-0 z-20">
      
      {/* Mobile Hamburger Menu Trigger */}
      {onMenuClick && (
        <button 
          onClick={onMenuClick}
          className="md:hidden mr-2 p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200/60 dark:bg-zinc-900 dark:hover:bg-zinc-800/60 text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-550 cursor-pointer shrink-0"
        >
          <Menu size={18} />
        </button>
      )}

      {/* Search Trigger Input */}
      <div className="flex-1 max-w-xs sm:max-w-md">
        <button 
          onClick={onSearchClick}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/20 text-zinc-400 hover:text-zinc-500 text-sm hover:bg-zinc-200/30 dark:hover:bg-zinc-800/60 transition-all cursor-pointer text-left"
        >
          <Search size={16} className="shrink-0" />
          <span className="truncate text-xs sm:text-sm">
            <span className="hidden sm:inline">Search customers, phone numbers, leads...</span>
            <span className="sm:hidden">Search...</span>
          </span>
          <span className="hidden sm:inline-block ml-auto text-[10px] bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-500 font-mono">
            ⌘K
          </span>
        </button>
      </div>

      {/* Header Actions */}
      <div className="flex items-center gap-4">
        
        {/* Quick Add Button */}
        <button
          onClick={onQuickAddClick}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-sm font-semibold shadow-md shadow-emerald-600/10 hover:shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
        >
          <Plus size={16} />
          <span className="hidden md:inline">Quick Add</span>
        </button>

        {/* Notifications Dropdown */}
        <div className="relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="h-10 w-10 rounded-xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 transition-colors relative cursor-pointer"
          >
            <Bell size={18} />
            <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-rose-500"></span>
          </button>

          {showNotifications && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowNotifications(false)}
              />
              <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 p-4 shadow-xl z-50 animate-fade-in">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                  <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Alerts</h3>
                  <button className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline">
                    Mark all read
                  </button>
                </div>
                <div className="mt-2 space-y-3">
                  {notifications.map(n => (
                    <div key={n.id} className="text-xs p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">{n.title}</span>
                        <span className="text-[10px] text-zinc-400">{n.time}</span>
                      </div>
                      <p className="text-zinc-500 dark:text-zinc-400 mt-1">{n.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Avatar Status info */}
        <div className="flex items-center gap-2.5 border-l border-zinc-200 dark:border-zinc-800 pl-4">
          <div className="h-9 w-9 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-sm">
            {profile?.full_name?.charAt(0) || 'U'}
          </div>
          <div className="hidden lg:block text-left">
            <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 leading-tight">
              {profile?.full_name || 'User Name'}
            </p>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-none mt-0.5">
              {profile?.role === 'admin' ? 'Administrator' : 'Sales Representative'}
            </p>
          </div>
        </div>

      </div>
    </header>
  );
};
