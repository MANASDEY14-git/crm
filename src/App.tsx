import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { Dashboard } from './components/dashboard/Dashboard';
import { Inbox } from './components/inbox/Inbox';
import { KanbanBoard } from './components/leads/KanbanBoard';
import { Customers } from './components/customers/Customers';
import { TaskManager } from './components/tasks/TaskManager';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { QuickAddModal } from './components/shared/QuickAddModal';
import { SearchOverlay } from './components/shared/SearchOverlay';
import { 
  Building, 
  Mail, 
  Lock, 
  Sparkles, 
  Flame, 
  Users, 
  Calendar,
  MessageCircle
} from 'lucide-react';
import { supabase } from './lib/supabase';

// Interior App Content with Layout
const AppContent: React.FC = () => {
  const { user, loading, signInDemo } = useAuth();
  
  // App Navigation & Selections
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  
  // Layout states
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Auth Forms states (for manual logins)
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [bizName, setBizName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const handleManualAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      if (isSignUp) {
        // Sign Up
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        
        if (data.user) {
          // Create business
          const { data: newBiz, error: bizError } = await supabase
            .from('businesses')
            .insert({ name: bizName || 'New CRM Business' })
            .select()
            .single();

          if (bizError) throw bizError;

          // Create Profile
          const { error: profError } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              business_id: newBiz.id,
              email: email,
              full_name: fullName || 'User',
              role: 'admin'
            });

          if (profError) throw profError;
          alert('Sign up successful! Please check your email for confirmation or sign in.');
          setIsSignUp(false);
        }
      } else {
        // Sign In
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSearchResultSelect = (type: 'customer' | 'lead' | 'chat', id: string) => {
    if (type === 'customer') {
      setSelectedCustomerId(id);
      setCurrentTab('customers');
    } else if (type === 'lead') {
      setCurrentTab('leads');
    } else if (type === 'chat') {
      setSelectedCustomerId(id);
      setCurrentTab('inbox');
    }
  };

  // 1. Loading screen
  if (loading) {
    return (
      <div className="h-screen w-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent mb-4"></div>
        <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">Loading Krazey CRM...</p>
      </div>
    );
  }

  // 2. Auth view
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-zinc-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        
        {/* Animated backdrop glow shapes */}
        <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-emerald-500/10 blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none"></div>

        <div className="w-full max-w-md bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-800/50 rounded-3xl p-8 shadow-2xl relative z-10 flex flex-col items-center text-center">
          
          {/* Logo */}
          <div className="h-12 w-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white font-extrabold text-lg shadow-lg shadow-emerald-600/20 mb-3">
            K
          </div>
          <h1 className="text-2xl font-extrabold text-zinc-950 dark:text-zinc-50 tracking-tight leading-none">
            Krazey CRM
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 max-w-xs">
            The lightweight, WhatsApp-first CRM for growing Indian SMB stores & distributor channels.
          </p>

          {/* Quick Demo Mode Card */}
          <div className="w-full p-4.5 rounded-2xl border border-emerald-100 dark:border-emerald-950 bg-emerald-50/30 dark:bg-emerald-950/10 mt-6 text-left space-y-3">
            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
              <Sparkles size={14} className="text-amber-500" />
              <span>Developer Speedrun Seeding</span>
            </div>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
              One-click demo creation generates mock sales inquiries, follow-up timelines, and messages instantly.
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => signInDemo('admin')}
                className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-bold shadow transition-colors cursor-pointer text-center"
              >
                Login as Owner (Admin)
              </button>
              <button
                onClick={() => signInDemo('sales_staff')}
                className="py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-bold shadow transition-colors cursor-pointer text-center"
              >
                Login as Staff (Sales)
              </button>
            </div>
          </div>

          <div className="w-full flex items-center justify-center my-6 gap-2">
            <div className="h-px bg-zinc-200 dark:bg-zinc-800 flex-1"></div>
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Or Manual Access</span>
            <div className="h-px bg-zinc-200 dark:bg-zinc-800 flex-1"></div>
          </div>

          {/* Manual Login Form */}
          <form onSubmit={handleManualAuth} className="w-full space-y-3.5 text-left">
            {isSignUp && (
              <>
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-400 mb-1">Company / Store Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Balaji Distributing Co."
                    value={bizName}
                    onChange={e => setBizName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-850 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-400 mb-1">Your Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Manas"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-850 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 focus:outline-none"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 mb-1">Email Address *</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 text-zinc-400" size={14} />
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-850 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 mb-1">Password *</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 text-zinc-400" size={14} />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-850 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 rounded-xl text-xs font-bold transition-all shadow cursor-pointer text-center"
            >
              {authLoading ? 'Loading...' : isSignUp ? 'Create Owner Account' : 'Sign In'}
            </button>
          </form>

          {/* Toggle signup/login link */}
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold hover:underline mt-4 cursor-pointer"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have a workspace? Create Business"}
          </button>

        </div>
      </div>
    );
  }

  // 3. Authenticated CRM layout
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      
      {/* Collapsible Sidebar */}
      <Sidebar 
        currentTab={currentTab} 
        setCurrentTab={setCurrentTab} 
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* Global header */}
        <Header 
          onSearchClick={() => setIsSearchOpen(true)}
          onQuickAddClick={() => setIsQuickAddOpen(true)}
        />

        {/* Dynamic Main Workspace Tabs */}
        <main className="flex-1 overflow-hidden flex flex-col relative">
          {currentTab === 'dashboard' && (
            <Dashboard 
              setCurrentTab={setCurrentTab} 
              setSelectedCustomerId={setSelectedCustomerId} 
            />
          )}
          {currentTab === 'inbox' && (
            <Inbox 
              selectedCustomerId={selectedCustomerId}
              setSelectedCustomerId={setSelectedCustomerId}
            />
          )}
          {currentTab === 'leads' && (
            <KanbanBoard 
              setCurrentTab={setCurrentTab}
              setSelectedCustomerId={setSelectedCustomerId}
            />
          )}
          {currentTab === 'customers' && (
            <Customers 
              selectedCustomerId={selectedCustomerId}
              setSelectedCustomerId={setSelectedCustomerId}
              setCurrentTab={setCurrentTab}
            />
          )}
          {currentTab === 'tasks' && (
            <TaskManager 
              setCurrentTab={setCurrentTab}
              setSelectedCustomerId={setSelectedCustomerId}
            />
          )}
          {currentTab === 'settings' && <SettingsPanel />}
        </main>

        {/* Global Dialog Modals */}
        <QuickAddModal 
          isOpen={isQuickAddOpen}
          onClose={() => setIsQuickAddOpen(false)}
          onSuccess={() => {
            // Trigger refresh events where appropriate by forcing location reload or letting component timers pull updates
            // (realtime subscriptions take care of this cleanly in the Inbox/Conversations!)
          }}
        />

        <SearchOverlay 
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onSelectResult={handleSearchResultSelect}
        />

      </div>
    </div>
  );
};

// Root Assembly
function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App;
