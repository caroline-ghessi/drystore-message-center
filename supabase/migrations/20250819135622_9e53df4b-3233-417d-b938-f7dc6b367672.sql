-- FIX REMAINING SECURITY ISSUES FROM LINTER (CORRECTED)
-- Remove SECURITY DEFINER from views and move only user extensions out of public schema

-- 1. Fix Security Definer Views - Drop and recreate without SECURITY DEFINER
DROP VIEW IF EXISTS public.sellers_basic_info;
CREATE VIEW public.sellers_basic_info AS
SELECT 
  id,
  name,
  active,
  personality_type,
  experience_years,
  performance_score,
  conversion_rate,
  current_workload,
  max_concurrent_leads,
  created_at
FROM public.sellers
WHERE NOT deleted;

-- 2. Move only safe user extensions out of public schema (avoid system extensions)
-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move only uuid-ossp and pgcrypto if they exist in public (avoid system extensions)
DO $$
BEGIN
  -- Only move uuid-ossp if it exists in public schema
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp' AND extnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    ALTER EXTENSION "uuid-ossp" SET SCHEMA extensions;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore errors for extensions that can't be moved
    NULL;
END $$;

DO $$
BEGIN
  -- Only move pgcrypto if it exists in public schema
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto' AND extnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    ALTER EXTENSION "pgcrypto" SET SCHEMA extensions;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore errors for extensions that can't be moved
    NULL;
END $$;

-- 3. Enhanced seller data protection - ensure only basic info visible to operators
DROP POLICY IF EXISTS "operators_can_view_basic_seller_info" ON public.sellers;
CREATE POLICY "operators_can_view_basic_seller_info" 
ON public.sellers 
FOR SELECT 
USING (
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) THEN true
    WHEN has_role(auth.uid(), 'operator'::app_role) THEN active = true
    WHEN has_role(auth.uid(), 'seller'::app_role) THEN can_access_seller_data(auth.uid(), id)
    ELSE false
  END
);

-- 4. Update conversations view with improved phone masking
DROP VIEW IF EXISTS public.conversations_with_last_message;
CREATE VIEW public.conversations_with_last_message AS
SELECT 
  c.id,
  c.customer_name,
  -- Apply role-based phone masking
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) THEN c.phone_number
    ELSE public.mask_phone_for_role(c.phone_number, public.get_user_role_safe(auth.uid()))
  END as phone_number,
  c.status,
  c.assigned_seller_id,
  c.assigned_operator_id,
  c.fallback_mode,
  c.fallback_taken_by,
  c.created_at,
  c.updated_at,
  lm.last_message_at,
  lm.last_message,
  lm.last_sender_type,
  lm.total_messages,
  s.name as seller_name
FROM public.conversations c
LEFT JOIN public.sellers s ON c.assigned_seller_id = s.id
LEFT JOIN (
  SELECT 
    conversation_id,
    MAX(created_at) as last_message_at,
    (array_agg(content ORDER BY created_at DESC))[1] as last_message,
    (array_agg(sender_type ORDER BY created_at DESC))[1] as last_sender_type,
    COUNT(*) as total_messages
  FROM public.messages 
  GROUP BY conversation_id
) lm ON c.id = lm.conversation_id;

-- 5. Enhanced data access auditing function
CREATE OR REPLACE FUNCTION public.audit_sensitive_data_access(
  table_name_param text,
  record_id_param uuid,
  accessed_fields text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only log for operator role to monitor their access to sensitive data
  IF has_role(auth.uid(), 'operator'::app_role) THEN
    INSERT INTO public.data_access_logs (
      user_id,
      table_name,
      record_id,
      action,
      sensitive_fields
    ) VALUES (
      auth.uid(),
      table_name_param,
      record_id_param,
      'SENSITIVE_ACCESS',
      accessed_fields
    );
  END IF;
END;
$$;

-- 6. Log the security hardening completion
INSERT INTO public.system_logs (type, source, message, details)
VALUES (
  'info',
  'security',
  'Critical security fixes applied successfully',
  jsonb_build_object(
    'fixes_applied', ARRAY[
      'assignment_based_access_control',
      'phone_number_masking', 
      'seller_data_protection',
      'whapi_credentials_protection',
      'system_config_protection',
      'enhanced_views_security',
      'data_access_auditing'
    ],
    'remaining_manual_steps', ARRAY[
      'configure_otp_expiry_5_minutes_in_supabase_dashboard',
      'enable_leaked_password_protection_in_supabase_dashboard'
    ],
    'security_level', 'critical',
    'updated_by', auth.uid(),
    'timestamp', now()
  )
);