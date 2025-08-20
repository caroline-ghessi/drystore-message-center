-- Fix critical security vulnerability in seller_performance_metrics table
-- Currently allows all authenticated users to access sensitive business data
-- This could allow competitors to steal conversion rates, revenue data, etc.

-- Drop the insecure policy that allows all authenticated users access
DROP POLICY IF EXISTS "Enable all for authenticated users on seller_performance_metric" ON public.seller_performance_metrics;

-- Create secure policies that follow the principle of least privilege
-- 1. Admins and managers can view all performance metrics
CREATE POLICY "admins_managers_can_view_all_performance_metrics" 
ON public.seller_performance_metrics 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- 2. Admins and managers can manage all performance metrics
CREATE POLICY "admins_managers_can_manage_performance_metrics" 
ON public.seller_performance_metrics 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- 3. Sellers can only view their own performance metrics
CREATE POLICY "sellers_can_view_own_performance_metrics" 
ON public.seller_performance_metrics 
FOR SELECT 
USING (
  has_role(auth.uid(), 'seller'::app_role) AND 
  can_access_seller_data(auth.uid(), seller_id)
);

-- Note: Operators are intentionally excluded from accessing performance metrics
-- They should use the sellers_basic_info view for general seller information
-- Performance metrics contain sensitive business data that operators don't need

-- Log this security fix
INSERT INTO public.system_logs (type, source, message, details)
VALUES (
  'info',
  'security_fix',
  'Fixed critical security vulnerability in seller_performance_metrics table',
  jsonb_build_object(
    'issue', 'seller_performance_metrics accessible to all authenticated users',
    'fix', 'Implemented role-based access control',
    'impact', 'Restricted access to admins, managers, and individual sellers only',
    'timestamp', now()
  )
);