import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { 
  LayoutDashboard, 
  MessageSquare, 
  Kanban, 
  Users, 
  CheckSquare, 
  Settings, 
  LogOut, 
  Menu,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  TrendingUp
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentTab, 
  setCurrentTab, 
  collapsed, 
  setCollapsed 
}) => {
  const { profile, business, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inbox', label: 'Inbox', icon: MessageSquare, badge: true },
    { id: 'leads', label: 'Leads Pipeline', icon: Kanban },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'tasks', label: 'Tasks & Follow-ups', icon: CheckSquare },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside 
      className={cn(
        "h-screen glass border-r flex flex-col transition-all duration-300 relative z-30",
        collapsed ? "w-16 md:w-20" : "w-64"
      )}
    >
      {/* Sidebar Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-zinc-200/50 dark:border-zinc-800/50">
        {!collapsed && (
          <div className="flex items-center gap-2 animate-fade-in">
            <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold shadow-md shadow-emerald-600/20">
              K
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 leading-none">
                Krazey CRM
              </h1>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                WhatsApp First
              </span>
            </div>
          </div>
        )}
        
        {collapsed && (
          <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold mx-auto shadow-md">
            K
          </div>
        )}

        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-6 h-6 w-6 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 flex items-center justify-center text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-50 shadow-sm cursor-pointer z-50"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Profile Summary */}
      {!collapsed && (
        <div className="p-4 border-b border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/30">
          <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium uppercase tracking-wider">Business</p>
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate mt-0.5">
            {business?.name || 'Loading Biz...'}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-600 dark:text-zinc-400">
              {profile?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="truncate">
              <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">
                {profile?.full_name || 'User'}
              </p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 capitalize">
                {profile?.role === 'admin' ? 'Owner' : 'Sales Agent'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Menu Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {menuItems.map(item => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative",
                isActive 
                  ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 font-semibold" 
                  : "text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-zinc-100"
              )}
            >
              <Icon 
                size={20} 
                className={cn(
                  "transition-transform group-hover:scale-105", 
                  isActive ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400"
                )} 
              />
              {!collapsed && <span>{item.label}</span>}
              
              {/* Collapsed Tooltip */}
              {collapsed && (
                <div className="absolute left-full ml-4 px-2 py-1 rounded bg-zinc-900 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-md">
                  {item.label}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer */}
      <div className="p-2 border-t border-zinc-200/50 dark:border-zinc-800/50 space-y-1">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-center gap-3 px-3 py-2.5 rounded-xl text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-950 dark:hover:text-zinc-50 text-sm font-medium"
        >
          {theme === 'light' ? (
            <>
              <Moon size={20} className="text-zinc-400" />
              {!collapsed && <span className="flex-1 text-left">Dark Mode</span>}
            </>
          ) : (
            <>
              <Sun size={20} className="text-emerald-400" />
              {!collapsed && <span className="flex-1 text-left">Light Mode</span>}
            </>
          )}
        </button>

        {/* Sign Out */}
        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-3 px-3 py-2.5 rounded-xl text-zinc-500 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600 dark:hover:text-red-400 text-sm font-medium transition-colors"
        >
          <LogOut size={20} className="text-zinc-400 group-hover:text-red-500" />
          {!collapsed && <span className="flex-1 text-left">Log Out</span>}
        </button>
      </div>
    </aside>
  );
};
