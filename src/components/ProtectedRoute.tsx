import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAuthSecurity, forceLogout } from '@/hooks/useAuthSecurity';
import { AccessDenied } from '@/components/AccessDenied';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireManager?: boolean;
}

export const ProtectedRoute = ({ 
  children, 
  requireAdmin = false, 
  requireManager = false 
}: ProtectedRouteProps) => {
  const { user, session, loading: authLoading } = useAuth();
  const { hasAccess, isAdmin, isManager, loading: securityLoading, approvalStatus } = useAuthSecurity();
  const navigate = useNavigate();

  // Overall loading state
  const loading = authLoading || securityLoading;

  useEffect(() => {
    const validateAccess = async () => {
      // If still loading, wait
      if (loading) return;

      // No user or session - redirect to login
      if (!user || !session) {
        navigate('/login');
        return;
      }

      // Check session validity
      const now = Math.floor(Date.now() / 1000);
      if (session.expires_at && session.expires_at < now) {
        console.warn('Session expired, forcing logout');
        await forceLogout();
        return;
      }

      // Check role-based access
      if (requireAdmin && !isAdmin) {
        console.warn('Admin access required but user is not admin');
        await forceLogout();
        return;
      }

      if (requireManager && !isManager && !isAdmin) {
        console.warn('Manager access required but user is neither manager nor admin');
        await forceLogout();
        return;
      }
    };

    validateAccess();
  }, [user, session, loading, hasAccess, isAdmin, isManager, navigate, requireAdmin, requireManager]);

  // Show loading spinner
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-drystore-gray-light to-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-drystore-orange mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  // No user or session - will redirect to login
  if (!user || !session) {
    return null;
  }

  // User exists but doesn't have access - show access denied
  if (!hasAccess) {
    return <AccessDenied approvalStatus={approvalStatus} userEmail={user.email} />;
  }

  // Role-based access control
  if (requireAdmin && !isAdmin) {
    return <AccessDenied approvalStatus="rejected" userEmail={user.email} />;
  }

  if (requireManager && !isManager && !isAdmin) {
    return <AccessDenied approvalStatus="rejected" userEmail={user.email} />;
  }

  // All checks passed - render children
  return <>{children}</>;
};