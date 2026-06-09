import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Business } from '../types';

interface TenantContextType {
  activeBusiness: Business | null;
  businesses: Business[];
  switchBusiness: (businessId: string) => Promise<void>;
  createBusiness: (name: string) => Promise<void>;
  loading: boolean;
}

export const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeBusiness, setActiveBusiness] = useState<Business | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // 1. Listen to Supabase auth state changes to detect the current user
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id || null;
      setUserId(uid);
      if (!uid) {
        setActiveBusiness(null);
        setBusinesses([]);
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id || null;
      setUserId(uid);
      if (!uid) {
        setActiveBusiness(null);
        setBusinesses([]);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 2. Fetch all user businesses when userId changes
  useEffect(() => {
    if (userId) {
      fetchUserBusinesses(userId);
    }
  }, [userId]);

  const fetchUserBusinesses = async (uid: string) => {
    try {
      setLoading(true);
      
      // Fetch all memberships/businesses for the user
      const { data: bizList, error: bizListError } = await supabase
        .rpc('get_user_businesses_safe');

      if (bizListError) throw bizListError;

      const formattedBusinesses: Business[] = (bizList || []).map((b: any) => ({
        id: b.business_id,
        name: b.name,
        created_at: b.created_at,
        erp_supabase_url: b.erp_supabase_url,
        erp_sync_schedule: b.erp_sync_schedule,
        erp_last_synced_at: b.erp_last_synced_at,
        erp_enabled: b.erp_enabled,
        has_erp_key: b.has_erp_key,
      }));

      setBusinesses(formattedBusinesses);

      // Fetch active business from profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('business_id')
        .eq('id', uid)
        .maybeSingle();

      if (profileError) throw profileError;

      if (profile?.business_id) {
        const active = formattedBusinesses.find(b => b.id === profile.business_id);
        if (active) {
          setActiveBusiness(active);
        } else if (formattedBusinesses.length > 0) {
          // Fallback if the profile's active business is no longer in their memberships
          await selectFirstBusiness(uid, formattedBusinesses);
        } else {
          setActiveBusiness(null);
        }
      } else if (formattedBusinesses.length > 0) {
        // Fallback if no business_id is set on profile
        await selectFirstBusiness(uid, formattedBusinesses);
      } else {
        setActiveBusiness(null);
      }
    } catch (err) {
      console.error('Error fetching user businesses:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectFirstBusiness = async (uid: string, list: Business[]) => {
    const firstBiz = list[0];
    // Set active in state
    setActiveBusiness(firstBiz);
    // Set active in profiles table
    await supabase
      .from('profiles')
      .update({ business_id: firstBiz.id })
      .eq('id', uid);
  };

  // 3. Switch business function
  const switchBusiness = async (businessId: string) => {
    if (!userId) return;
    try {
      setLoading(true);
      // Update the profiles table
      const { error } = await supabase
        .from('profiles')
        .update({ business_id: businessId })
        .eq('id', userId);

      if (error) throw error;

      // Update local state
      const nextActive = businesses.find(b => b.id === businessId);
      if (nextActive) {
        setActiveBusiness(nextActive);
      }
    } catch (err) {
      console.error('Error switching business:', err);
      alert('Failed to switch business: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // 4. Create new business function (limited to max 3)
  const createBusiness = async (name: string) => {
    if (!userId) return;
    if (businesses.length >= 3) {
      throw new Error('Workspace limit exceeded. You can belong to a maximum of 3 businesses.');
    }

    try {
      setLoading(true);

      // Create new business row
      const { data: newBiz, error: bizError } = await supabase
        .from('businesses')
        .insert({ name })
        .select()
        .single();

      if (bizError) throw bizError;

      // Create membership record as admin
      const { error: memError } = await supabase
        .from('memberships')
        .insert({
          profile_id: userId,
          business_id: newBiz.id,
          role: 'admin'
        });

      if (memError) throw memError;

      // Update the profiles active business_id
      const { error: profError } = await supabase
        .from('profiles')
        .update({ business_id: newBiz.id })
        .eq('id', userId);

      if (profError) throw profError;

      // Reload businesses list and switch
      await fetchUserBusinesses(userId);
    } catch (err) {
      console.error('Error creating business:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return (
    <TenantContext.Provider value={{ activeBusiness, businesses, switchBusiness, createBusiness, loading }}>
      {children}
    </TenantContext.Provider>
  );
};
