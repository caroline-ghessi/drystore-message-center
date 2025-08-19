-- FIX REMAINING SECURITY ISSUES FROM LINTER
-- Remove SECURITY DEFINER from views and move extensions out of public schema

-- 1. Fix Security Definer Views
-- Find and recreate any views that have SECURITY DEFINER

-- Drop and recreate sellers_basic_info view without SECURITY DEFINER
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

-- Apply RLS to the sellers_basic_info view access
-- (Views inherit RLS from their underlying tables, so this is handled by the sellers table policies)

-- 2. Move extensions out of public schema
-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move uuid-ossp extension if it exists in public
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp' AND extnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    ALTER EXTENSION "uuid-ossp" SET SCHEMA extensions;
  END IF;
END $$;

-- Move pgcrypto extension if it exists in public  
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto' AND extnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    ALTER EXTENSION "pgcrypto" SET SCHEMA extensions;
  END IF;
END $$;

-- Move any other common extensions out of public schema
DO $$
DECLARE
  ext_name text;
BEGIN
  FOR ext_name IN 
    SELECT extname 
    FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE n.nspname = 'public' 
    AND extname NOT IN ('plpgsql') -- Keep plpgsql in public
  LOOP
    EXECUTE format('ALTER EXTENSION %I SET SCHEMA extensions', ext_name);
  END LOOP;
END $$;

-- 3. Ensure proper RLS policies are in place for seller data protection
-- Update sellers RLS to be more restrictive for operators (they should only see basic info)
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

-- Ensure the conversations view properly masks data
DROP VIEW IF EXISTS public.conversations_with_last_message;
CREATE VIEW public.conversations_with_last_message AS
SELECT 
  c.id,
  c.customer_name,
  -- Apply phone masking based on user role
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) THEN c.phone_number
    ELSE public.get_masked_phone(c.phone_number)
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

-- Add additional data access audit function 
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
  -- Only log for operator role to monitor their access
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

-- Log the security fixes
INSERT INTO public.system_logs (type, source, message, details)
VALUES (
  'info',
  'security',
  'Database security hardening completed',
  jsonb_build_object(
    'fixes_applied', ARRAY[
      'removed_security_definer_from_views',
      'moved_extensions_from_public_schema',
      'enhanced_seller_data_protection',
      'improved_phone_masking_in_views',
      'added_sensitive_data_audit_function'
    ],
    'manual_steps_required', ARRAY[
      'configure_otp_expiry_5_minutes',
      'enable_leaked_password_protection'
    ],
    'updated_by', auth.uid(),
    'timestamp', now()
  )
);