import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Profile, Business } from '../types';
import { TenantContext } from './TenantProvider';

interface AuthContextType {
  user: any | null;
  profile: Profile | null;
  business: Business | null;
  loading: boolean;
  signInDemo: (role: 'admin' | 'sales_staff') => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        fetchProfileAndBusiness(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user);
        fetchProfileAndBusiness(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
        setBusiness(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfileAndBusiness = async (userId: string) => {
    try {
      setLoading(true);
      // Fetch profile
      let { data: prof, error: profError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profError) throw profError;

      if (prof) {
        setProfile(prof);
        if (prof.business_id) {
          // SECURITY: Use a SECURITY DEFINER Postgres RPC function.
          // It computes has_ycloud_key / has_openwa_key / has_erp_key AS BOOLEANS
          // entirely on the database server. Raw key strings never leave the DB.
          // The secret columns are also REVOKED from the authenticated role.
          const { data: biz, error: bizError } = await supabase
            .rpc('get_business_safe', { p_business_id: prof.business_id });
          if (bizError) throw bizError;
          setBusiness(biz as any);
        }
      }
    } catch (e) {
      console.error('Error fetching profile/business:', e);
    } finally {
      setLoading(false);
    }
  };

  const signInDemo = async (role: 'admin' | 'sales_staff') => {
    setLoading(true);
    try {
      // For demo, we sign in using a dedicated demo account.
      // If the signup doesn't exist, we sign them up.
      const demoEmail = role === 'admin' ? 'demo_admin_krazeycrm@gmail.com' : 'demo_staff_krazeycrm@gmail.com';
      // SECURITY NOTE: This is an intentionally public throwaway demo account.
      // It has NO access to production data. Never reuse this pattern for real user accounts.
      const demoPassword = 'demoPassword123!';

      let authUser: any = null;
      let { data: signInData, error } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: demoPassword,
      });

      if (error && error.message.includes('Invalid login credentials')) {
        // Sign up if demo user doesn't exist yet
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: demoEmail,
          password: demoPassword,
        });

        if (signUpError) throw signUpError;
        authUser = signUpData.user;
      } else if (error) {
        throw error;
      } else {
        authUser = signInData.user;
      }

      if (authUser) {
        setUser(authUser);
        // Setup default business and profile if not done
        await setupDemoBusinessAndProfile(authUser.id, authUser.email || demoEmail, role);
      }
    } catch (e) {
      console.error('Demo Sign-in failed:', e);
      alert('Demo Sign-in failed. Please try again. Detailed error: ' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const setupDemoBusinessAndProfile = async (userId: string, email: string, role: 'admin' | 'sales_staff') => {
    try {
      // 1. Check if memberships exist for this user
      let { data: existingMems } = await supabase
        .from('memberships')
        .select('*')
        .eq('profile_id', userId);

      if (existingMems && existingMems.length > 0) {
        await fetchProfileAndBusiness(userId);
        return;
      }

      // 2. Create business
      const { data: newBiz, error: bizError } = await supabase
        .from('businesses')
        .insert({ name: 'Royal Furniture Plaza' })
        .select()
        .single();

      if (bizError) throw bizError;

      // 2.5 Create membership
      const { error: memError } = await supabase
        .from('memberships')
        .insert({
          profile_id: userId,
          business_id: newBiz.id,
          role: role
        });

      if (memError) throw memError;

      // 3. Create profile
      const fullName = role === 'admin' ? 'Manas (Owner)' : 'Rajesh (Sales)';
      const { data: newProf, error: profError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          business_id: newBiz.id,
          email: email,
          full_name: fullName,
          role: role
        })
        .select()
        .single();

      if (profError) throw profError;

      // 4. Seed initial demo data for this business!
      await seedDemoData(newBiz.id, userId);

      setProfile(newProf);
      setBusiness(newBiz);
    } catch (e) {
      console.error('Error setting up demo business:', e);
    }
  };

  const seedDemoData = async (businessId: string, userId: string) => {
    try {
      console.log('Seeding demo data...');

      // A. Create customers
      const customersToInsert = [
        { business_id: businessId, name: 'Ananya Rao', phone: '+91 98765 43210', email: 'ananya@gmail.com', tags: ['High Value', 'Custom Sofa'], assigned_staff_id: userId },
        { business_id: businessId, name: 'Vikram Singh', phone: '+91 87654 32109', email: 'vikram.s@outlook.com', tags: ['Office Order'], assigned_staff_id: userId },
        { business_id: businessId, name: 'Priya Sharma', phone: '+91 76543 21098', email: 'priya@gmail.com', tags: ['Dining Table'], assigned_staff_id: userId },
        { business_id: businessId, name: 'Kabir Mehta', phone: '+91 91234 56789', email: null, tags: ['New Inquiry'], assigned_staff_id: userId }
      ];

      const { data: insertedCustomers, error: custError } = await supabase
        .from('customers')
        .insert(customersToInsert)
        .select();

      if (custError) throw custError;

      const custMap = insertedCustomers.reduce((acc: any, c: any) => {
        acc[c.name] = c.id;
        return acc;
      }, {});

      // B. Create leads
      const leadsToInsert = [
        { business_id: businessId, customer_id: custMap['Ananya Rao'], stage: 'Interested', expected_deal_value: 85000, priority: 'high', follow_up_date: new Date(Date.now() + 86400000).toISOString() }, // tomorrow
        { business_id: businessId, customer_id: custMap['Vikram Singh'], stage: 'Quotation Sent', expected_deal_value: 145000, priority: 'high', follow_up_date: new Date(Date.now() - 3600000 * 2).toISOString() }, // overdue today
        { business_id: businessId, customer_id: custMap['Priya Sharma'], stage: 'Follow-up Pending', expected_deal_value: 42000, priority: 'medium', follow_up_date: new Date(Date.now() - 86400000 * 2).toISOString() }, // overdue 2 days ago
        { business_id: businessId, customer_id: custMap['Kabir Mehta'], stage: 'New Inquiry', expected_deal_value: 25000, priority: 'low', follow_up_date: null }
      ];

      const { error: leadError } = await supabase.from('leads').insert(leadsToInsert);
      if (leadError) throw leadError;

      // C. Create notes
      const notesToInsert = [
        { business_id: businessId, customer_id: custMap['Ananya Rao'], content: 'Requested premium teak wood finishing instead of oak. Budget is flexible if polish is premium.', author_id: userId },
        { business_id: businessId, customer_id: custMap['Vikram Singh'], content: 'Sent quotation for 12 executive mesh chairs and 4 solid wood conference desks.', author_id: userId }
      ];
      await supabase.from('notes').insert(notesToInsert);

      // D. Create tasks
      const tasksToInsert = [
        { business_id: businessId, customer_id: custMap['Vikram Singh'], type: 'Call', due_date: new Date(Date.now() - 3600000 * 2).toISOString(), assigned_staff_id: userId, status: 'pending' },
        { business_id: businessId, customer_id: custMap['Priya Sharma'], type: 'Follow-up', due_date: new Date(Date.now() - 86400000).toISOString(), assigned_staff_id: userId, status: 'pending' },
        { business_id: businessId, customer_id: custMap['Ananya Rao'], type: 'Meeting', due_date: new Date(Date.now() + 86400000 * 2).toISOString(), assigned_staff_id: userId, status: 'pending' }
      ];
      await supabase.from('tasks').insert(tasksToInsert);

      // E. Create conversations & messages
      // Ananya chat
      const convAnanya = await supabase.from('conversations').insert({
        business_id: businessId,
        customer_id: custMap['Ananya Rao'],
        last_message: 'Can you share the catalog for luxury sofas?',
        last_message_at: new Date(Date.now() - 3600000 * 3).toISOString(),
        unread_count: 1
      }).select().single();

      if (convAnanya.data) {
        await supabase.from('messages').insert([
          { conversation_id: convAnanya.data.id, business_id: businessId, sender_type: 'staff', content: 'Hi Ananya! Welcome to Royal Furniture. How can I help you today?', sender_id: userId, created_at: new Date(Date.now() - 3600000 * 4).toISOString() },
          { conversation_id: convAnanya.data.id, business_id: businessId, sender_type: 'customer', content: 'Can you share the catalog for luxury sofas?', created_at: new Date(Date.now() - 3600000 * 3).toISOString() }
        ]);
      }

      // Vikram chat
      const convVikram = await supabase.from('conversations').insert({
        business_id: businessId,
        customer_id: custMap['Vikram Singh'],
        last_message: 'Please send the commercial quotation.',
        last_message_at: new Date(Date.now() - 3600000 * 12).toISOString(),
        unread_count: 0
      }).select().single();

      if (convVikram.data) {
        await supabase.from('messages').insert([
          { conversation_id: convVikram.data.id, business_id: businessId, sender_type: 'customer', content: 'Looking for conference room setups.', created_at: new Date(Date.now() - 3600000 * 24).toISOString() },
          { conversation_id: convVikram.data.id, business_id: businessId, sender_type: 'staff', content: 'Sure. We have standard solid wood and modular options. I will prepare a plan.', sender_id: userId, created_at: new Date(Date.now() - 3600000 * 18).toISOString() },
          { conversation_id: convVikram.data.id, business_id: businessId, sender_type: 'customer', content: 'Please send the commercial quotation.', created_at: new Date(Date.now() - 3600000 * 12).toISOString() }
        ]);
      }

      console.log('Seed completed successfully!');
    } catch (e) {
      console.error('Error seeding data:', e);
    }
  };

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setBusiness(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, profile, business, loading, signInDemo, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  const tenant = useContext(TenantContext);
  
  return {
    ...context,
    business: tenant ? tenant.activeBusiness : context.business,
    businesses: tenant ? tenant.businesses : [],
    switchBusiness: tenant ? tenant.switchBusiness : async () => {},
    createBusiness: tenant ? tenant.createBusiness : async () => {},
    tenantLoading: tenant ? tenant.loading : false
  };
};
