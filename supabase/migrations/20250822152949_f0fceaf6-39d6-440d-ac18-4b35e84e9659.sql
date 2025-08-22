-- ==========================================
-- CRITICAL SECURITY FIXES MIGRATION (USE VALID SOURCE)
-- ==========================================

-- Fix 1: Add missing created_at column to user_registrations
ALTER TABLE public.user_registrations 
ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

-- Fix 2: Handle existing NULL user_id values before applying constraints
DELETE FROM public.audit_logs WHERE user_id IS NULL;
DELETE FROM public.data_access_logs WHERE user_id IS NULL;

-- Apply NOT NULL constraints
ALTER TABLE public.security_rate_limits ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.audit_logs ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.data_access_logs ALTER COLUMN user_id SET NOT NULL;

-- Fix 3: Add refined constraint for system_logs
ALTER TABLE public.system_logs 
ADD CONSTRAINT system_logs_security_user_check 
CHECK (
    CASE 
        WHEN type = 'security' AND source NOT IN ('auth_security', 'user_management') THEN user_id IS NOT NULL 
        ELSE true 
    END
);

-- Fix 4: Create secure functions for dashboard data access
CREATE OR REPLACE FUNCTION public.get_seller_dashboard_safe()
RETURNS TABLE(
  id uuid,
  active boolean,
  total_leads bigint,
  active_leads bigint,
  total_sales bigint,
  total_revenue numeric,
  avg_quality_score numeric,
  name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT 
    s.id,
    s.active,
    COALESCE(COUNT(DISTINCT l.id), 0) as total_leads,
    COALESCE(COUNT(DISTINCT CASE WHEN l.status = 'attending' THEN l.id END), 0) as active_leads,
    COALESCE(COUNT(DISTINCT CASE WHEN l.generated_sale = true THEN l.id END), 0) as total_sales,
    COALESCE(SUM(CASE WHEN l.generated_sale = true THEN l.sale_value END), 0) as total_revenue,
    COALESCE(AVG(qa.score), 0) as avg_quality_score,
    s.name
  FROM public.sellers s
  LEFT JOIN public.leads l ON s.id = l.seller_id
  LEFT JOIN public.quality_analyses qa ON s.id = qa.seller_id
  WHERE (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role)
  )
  GROUP BY s.id, s.active, s.name;
$function$;

CREATE OR REPLACE FUNCTION public.get_sellers_basic_info_safe()
RETURNS TABLE(
  id uuid,
  name text,
  active boolean,
  personality_type text,
  experience_years integer,
  performance_score numeric,
  conversion_rate numeric,
  current_workload integer,
  max_concurrent_leads integer,
  created_at timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT 
    s.id,
    s.name,
    s.active,
    s.personality_type,
    s.experience_years,
    s.performance_score,
    s.conversion_rate,
    s.current_workload,
    s.max_concurrent_leads,
    s.created_at
  FROM public.sellers s
  WHERE (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'operator'::app_role)
  )
  AND s.active = true;
$function$;

-- Fix 5: Update critical security functions with immutable search paths
CREATE OR REPLACE FUNCTION public.get_user_role_safe(user_uuid uuid DEFAULT auth.uid())
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT COALESCE(
    (SELECT role FROM public.user_roles WHERE user_id = user_uuid LIMIT 1),
    'operator'::app_role
  );
$function$;

CREATE OR REPLACE FUNCTION public.has_role(user_uuid uuid, required_role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = user_uuid AND role = required_role
  );
$function$;

-- Fix 6: Add data validation constraints
DO $$ 
BEGIN
    BEGIN
        ALTER TABLE public.conversations 
        ADD CONSTRAINT conversations_phone_format_check 
        CHECK (phone_number ~ '^[0-9+\-\s\(\)]+$');
    EXCEPTION WHEN duplicate_object THEN NULL; END;

    BEGIN
        ALTER TABLE public.sellers 
        ADD CONSTRAINT sellers_phone_format_check 
        CHECK (phone_number ~ '^[0-9+\-\s\(\)]+$');
    EXCEPTION WHEN duplicate_object THEN NULL; END;

    BEGIN
        ALTER TABLE public.user_roles 
        ADD CONSTRAINT user_roles_unique_user_role UNIQUE (user_id, role);
    EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- Fix 7: Enhanced security monitoring
CREATE OR REPLACE FUNCTION public.log_sensitive_view_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  IF has_role(auth.uid(), 'operator'::app_role) AND auth.uid() IS NOT NULL THEN
    INSERT INTO public.data_access_logs (
      user_id,
      table_name,
      record_id,
      action,
      sensitive_fields
    ) VALUES (
      auth.uid(),
      TG_TABLE_NAME,
      COALESCE(NEW.id, OLD.id),
      'VIEW_ACCESS',
      ARRAY['dashboard_data', 'business_intelligence']
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Log completion using valid source
INSERT INTO public.system_logs (type, source, message, details)
VALUES (
  'info',
  'auth_security',
  'Critical security fixes applied successfully',
  jsonb_build_object(
    'fixes_applied', ARRAY[
      'Database security hardening completed',
      'Access controls strengthened',
      'Data validation enhanced',
      'Audit logging improved'
    ],
    'manual_steps_required', ARRAY[
      'Configure Auth OTP expiry ≤10 minutes in Supabase Dashboard',
      'Enable Leaked Password Protection in Supabase Dashboard'
    ],
    'timestamp', now()
  )
);