-- Phase 1: Critical Data Protection Security Fixes

-- 1. Fix system_logs table - add missing user_id column
ALTER TABLE public.system_logs ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Create index for performance
CREATE INDEX idx_system_logs_user_id ON public.system_logs(user_id);

-- Phase 2: Database Security Hardening

-- 2. Fix database functions security - set proper search_path (they were missing it)
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid uuid DEFAULT auth.uid())
 RETURNS app_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT role FROM public.user_roles WHERE user_id = user_uuid LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.has_role(user_uuid uuid, required_role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = user_uuid AND role = required_role
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_access_seller_data(user_uuid uuid, target_seller_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    -- Admins and managers can access all seller data
    public.has_role(user_uuid, 'admin') OR 
    public.has_role(user_uuid, 'manager') OR
    -- Sellers can only access their own data
    (public.has_role(user_uuid, 'seller') AND EXISTS (
      SELECT 1 FROM public.sellers WHERE id = target_seller_id AND phone_number IN (
        SELECT phone_number FROM public.sellers s2 
        WHERE EXISTS (
          SELECT 1 FROM public.user_roles ur 
          WHERE ur.user_id = user_uuid AND ur.role = 'seller'
        )
      )
    ));
$function$;

CREATE OR REPLACE FUNCTION public.get_user_role_safe(user_uuid uuid DEFAULT auth.uid())
 RETURNS app_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT role FROM public.user_roles WHERE user_id = user_uuid LIMIT 1),
    'operator'::app_role
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_access_customer_data(user_uuid uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    public.has_role(user_uuid, 'admin') OR 
    public.has_role(user_uuid, 'manager') OR
    public.has_role(user_uuid, 'operator');
$function$;

-- 3. Fix audit_access_attempt function to use new user_id column
CREATE OR REPLACE FUNCTION public.audit_access_attempt(
  user_id_param uuid, 
  email_param text, 
  has_access_param boolean, 
  approval_status_param text, 
  roles_param text[], 
  timestamp_param timestamp with time zone
) RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.system_logs (
    type,
    source,
    message,
    details,
    user_id,
    created_at
  ) VALUES (
    CASE 
      WHEN has_access_param THEN 'info'
      ELSE 'warning'
    END,
    'auth_security',
    CASE 
      WHEN has_access_param THEN 'User access granted'
      ELSE 'User access denied'
    END,
    jsonb_build_object(
      'user_id', user_id_param,
      'email', email_param,
      'has_access', has_access_param,
      'approval_status', approval_status_param,
      'roles', roles_param,
      'timestamp', timestamp_param
    ),
    user_id_param,
    timestamp_param
  );
END;
$function$;

-- 4. Add enhanced phone number masking function
CREATE OR REPLACE FUNCTION public.mask_phone_number(phone text, user_role app_role)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    CASE 
      WHEN user_role IN ('admin', 'manager') THEN phone
      WHEN user_role = 'operator' THEN 
        CASE 
          WHEN LENGTH(phone) > 4 THEN 
            LEFT(phone, 2) || '****' || RIGHT(phone, 2)
          ELSE '****'
        END
      ELSE '****'
    END;
$function$;

-- Add system log for security fixes applied
INSERT INTO public.system_logs (type, source, message, details, user_id)
VALUES (
  'info',
  'security_hardening', 
  'Critical security fixes applied',
  jsonb_build_object(
    'fixes_applied', ARRAY[
      'Fixed system_logs schema with user_id column',
      'Secured database functions with search_path',
      'Fixed audit_access_attempt function',
      'Enhanced phone number masking function'
    ],
    'applied_at', now()
  ),
  null
);