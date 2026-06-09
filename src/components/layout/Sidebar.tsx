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
  TrendingUp,
  X
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentTab, 
  setCurrentTab, 
  collapsed, 
  setCollapsed,
  isOpenMobile = false,
  onCloseMobile
}) => {
  const { profile, business, businesses, switchBusiness, createBusiness, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showSwitcher, setShowSwitcher] = React.useState(false);
  const [newBizName, setNewBizName] = React.useState('');
  const [creating, setCreating] = React.useState(false);

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
        "h-screen glass border-r flex flex-col transition-all duration-300 fixed md:relative z-40 inset-y-0 left-0 w-64 md:w-auto",
        collapsed ? "md:w-20" : "md:w-64",
        isOpenMobile ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}
    >
      {/* Sidebar Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-zinc-200/50 dark:border-zinc-800/50 shrink-0">
        {(!collapsed || isOpenMobile) && (
          <div className="flex items-center gap-2 animate-fade-in">
            <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold shadow-md shadow-emerald-600/20">
              K
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 leading-none">
                Krazey CRM
              </h1>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                Lightweight CRM
              </span>
            </div>
          </div>
        )}
        
        {collapsed && !isOpenMobile && (
          <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold mx-auto shadow-md">
            K
          </div>
        )}

        {/* Mobile Close Button */}
        {isOpenMobile && (
          <button 
            onClick={onCloseMobile}
            className="md:hidden h-8 w-8 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-50 cursor-pointer"
          >
            <X size={16} />
          </button>
        )}

        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex absolute -right-3 top-6 h-6 w-6 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 items-center justify-center text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-50 shadow-sm cursor-pointer z-50"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Profile Summary / Tenant Switcher */}
      {!collapsed && (
        <div className="p-4 border-b border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/30">
          <div className="flex justify-between items-center cursor-pointer group" onClick={() => setShowSwitcher(!showSwitcher)}>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Workspace</p>
              <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate mt-0.5 flex items-center gap-1 hover:text-emerald-650 dark:hover:text-emerald-400 transition-colors">
                {business?.name || 'Loading Biz...'}
                <span className="text-[8px] text-zinc-400 group-hover:text-emerald-600 transition-transform duration-200 inline-block shrink-0" style={{ transform: showSwitcher ? 'rotate(180deg)' : 'none' }}>
                  ▼
                </span>
              </p>
            </div>
          </div>

          {showSwitcher ? (
            <div className="mt-3 space-y-2 animate-fade-in">
              {/* Business list */}
              <div className="max-h-36 overflow-y-auto space-y-0.5 pr-1">
                {businesses.map((biz) => {
                  const isActive = biz.id === business?.id;
                  return (
                    <button
                      key={biz.id}
                      onClick={() => {
                        if (switchBusiness) switchBusiness(biz.id);
                        setShowSwitcher(false);
                      }}
                      className={cn(
                        "w-full text-left px-2 py-1.5 rounded-lg text-[11px] flex items-center justify-between font-medium transition-all cursor-pointer",
                        isActive
                          ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 font-semibold"
                          : "text-zinc-650 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900/40"
                      )}
                    >
                      <span className="truncate">{biz.name}</span>
                      {isActive && <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">✓</span>}
                    </button>
                  );
                })}
              </div>

              {/* Business creation inline form */}
              <div className="pt-2 border-t border-zinc-200/40 dark:border-zinc-800/40">
                {businesses.length >= 3 ? (
                  <p className="text-[9px] text-zinc-500 italic text-center font-medium">
                    Limit of 3 workspaces reached.
                  </p>
                ) : (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!newBizName.trim() || creating) return;
                      try {
                        setCreating(true);
                        if (createBusiness) await createBusiness(newBizName.trim());
                        setNewBizName('');
                        setShowSwitcher(false);
                      } catch (err) {
                        alert((err as Error).message);
                      } finally {
                        setCreating(false);
                      }
                    }}
                    className="space-y-1.5"
                  >
                    <input
                      type="text"
                      required
                      placeholder="New workspace name..."
                      value={newBizName}
                      onChange={(e) => setNewBizName(e.target.value)}
                      className="w-full px-2 py-1 text-[11px] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-850 dark:text-zinc-100 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={creating}
                      className="w-full py-1 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 rounded-lg text-[9px] font-bold transition-all shadow cursor-pointer text-center"
                    >
                      {creating ? 'Creating...' : '+ Create Workspace'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-650 dark:text-zinc-400 shrink-0">
                {profile?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="truncate">
                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">
                  {profile?.full_name || 'User'}
                </p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-450 capitalize">
                  {profile?.role === 'admin' ? 'Owner' : profile?.role === 'sales_staff' ? 'Sales staff' : profile?.role}
                </p>
              </div>
            </div>
          )}
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
              onClick={() => {
                setCurrentTab(item.id);
                if (onCloseMobile) onCloseMobile();
              }}
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
