import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Tables } from '@/integrations/supabase/types';

type UserRole = Tables<'user_roles'>;
type UserRegistration = Tables<'user_registrations'>;

interface AuthSecurityState {
  isApproved: boolean;
  roles: string[];
  isAdmin: boolean;
  isManager: boolean;
  hasAccess: boolean;
  loading: boolean;
  approvalStatus: 'pending' | 'approved' | 'rejected' | 'none';
}

export const useAuthSecurity = (): AuthSecurityState => {
  const { user, loading: authLoading } = useAuth();
  const [security, setSecurity] = useState<AuthSecurityState>({
    isApproved: false,
    roles: [],
    isAdmin: false,
    isManager: false,
    hasAccess: false,
    loading: true,
    approvalStatus: 'none',
  });

  useEffect(() => {
    const checkUserSecurity = async () => {
      if (authLoading || !user) {
        setSecurity(prev => ({ ...prev, loading: authLoading }));
        return;
      }

      try {
        // Check user registration approval status
        const { data: registration } = await supabase
          .from('user_registrations')
          .select('*')
          .eq('email', user.email)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Check user roles
        const { data: roles } = await supabase
          .from('user_roles')
          .select('*')
          .eq('user_id', user.id);

        const userRoles = roles?.map(r => r.role) || [];
        const isAdmin = userRoles.includes('admin');
        const isManager = userRoles.includes('manager');

        // Determine approval status
        let approvalStatus: 'pending' | 'approved' | 'rejected' | 'none' = 'none';
        let isApproved = false;

        if (registration) {
          approvalStatus = registration.status as 'pending' | 'approved' | 'rejected';
          isApproved = registration.status === 'approved';
        } else if (userRoles.length > 0) {
          // If user has roles but no registration, consider approved (legacy users)
          isApproved = true;
          approvalStatus = 'approved';
        }

        // Users with admin role are always approved
        if (isAdmin) {
          isApproved = true;
          approvalStatus = 'approved';
        }

        const hasAccess = isApproved && userRoles.length > 0;

        setSecurity({
          isApproved,
          roles: userRoles,
          isAdmin,
          isManager,
          hasAccess,
          loading: false,
          approvalStatus,
        });

        // Log access attempt for audit
        if (user) {
          await supabase.functions.invoke('audit-access-attempt', {
            body: {
              userId: user.id,
              email: user.email,
              hasAccess,
              approvalStatus,
              roles: userRoles,
              timestamp: new Date().toISOString(),
            }
          }).catch(console.error); // Don't block on audit failure
        }

      } catch (error) {
        console.error('Error checking user security:', error);
        setSecurity(prev => ({ ...prev, loading: false, hasAccess: false }));
      }
    };

    checkUserSecurity();
  }, [user, authLoading]);

  return security;
};

// Force logout and clear all auth data
export const forceLogout = async () => {
  try {
    // Clear Supabase session
    await supabase.auth.signOut();
    
    // Clear all local storage
    localStorage.clear();
    sessionStorage.clear();
    
    // Clear any cached data
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
    
    // Reload page to ensure clean state
    window.location.href = '/login';
  } catch (error) {
    console.error('Error during force logout:', error);
    // Force reload anyway
    window.location.href = '/login';
  }
};