-- Fix remaining Security Definer Views and other security issues

-- 1. Fix any remaining Security Definer Views
-- The sellers_basic_info view should not have SECURITY DEFINER
DROP VIEW IF EXISTS public.sellers_basic_info CASCADE;

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
WHERE active = true;

-- Enable RLS on the sellers_basic_info view (it inherits from sellers table)
-- Views inherit RLS from underlying tables, no need for SECURITY DEFINER

-- 2. Fix extension schema issues by moving extensions out of public schema
-- Create a dedicated schema for extensions
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move commonly problematic extensions (if they exist in public)
-- This is a safe operation that won't break existing functionality
DO $$
BEGIN
  -- Only attempt to move extensions if they exist in public schema
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp' AND extnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    ALTER EXTENSION "uuid-ossp" SET SCHEMA extensions;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto' AND extnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    ALTER EXTENSION "pgcrypto" SET SCHEMA extensions;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements' AND extnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    ALTER EXTENSION "pg_stat_statements" SET SCHEMA extensions;
  END IF;
END $$;

-- 3. Create additional security monitoring functions
CREATE OR REPLACE FUNCTION public.audit_sensitive_data_access(
  table_name_param text,
  record_id_param uuid,
  accessed_fields text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only log for operator role to monitor their access
  IF has_role(auth.uid(), 'operator') THEN
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

-- 4. Create function to get masked phone numbers based on user role
CREATE OR REPLACE FUNCTION public.get_masked_phone(phone_number text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.mask_phone_for_role(phone_number, public.get_user_role_safe(auth.uid()));
$$;

-- 5. Update conversations view to use phone masking
DROP VIEW IF EXISTS public.conversations_with_last_message CASCADE;

CREATE VIEW public.conversations_with_last_message AS
SELECT 
    c.id,
    c.customer_name,
    public.get_masked_phone(c.phone_number) as phone_number,
    c.status,
    c.assigned_seller_id,
    c.assigned_operator_id,
    c.fallback_mode,
    c.fallback_taken_by,
    c.created_at,
    c.updated_at,
    COALESCE(m.last_message_at, c.created_at) as last_message_at,
    COALESCE(m.total_messages, 0) as total_messages,
    m.last_message,
    m.last_sender_type,
    s.name as seller_name
FROM public.conversations c
LEFT JOIN (
    SELECT 
        conversation_id,
        MAX(created_at) AS last_message_at,
        COUNT(*) AS total_messages,
        (array_agg(content ORDER BY created_at DESC))[1] AS last_message,
        (array_agg(sender_type ORDER BY created_at DESC))[1] AS last_sender_type
    FROM public.messages 
    GROUP BY conversation_id
) m ON c.id = m.conversation_id
LEFT JOIN public.sellers s ON c.assigned_seller_id = s.id;

-- 6. Grant proper permissions
GRANT SELECT ON public.sellers_basic_info TO authenticated;
GRANT SELECT ON public.conversations_with_last_message TO authenticated;
GRANT SELECT ON public.seller_dashboard TO authenticated;

-- 7. Add comments for clarity
COMMENT ON VIEW public.sellers_basic_info IS 'Operator-safe view of seller information without sensitive data like phone numbers or API tokens';
COMMENT ON VIEW public.conversations_with_last_message IS 'Enhanced conversation view with automatic phone number masking based on user role';
COMMENT ON FUNCTION public.get_masked_phone(text) IS 'Returns phone number masked according to current user role permissions';
COMMENT ON TABLE public.data_access_logs IS 'Audit trail for tracking access to sensitive customer data by operators';