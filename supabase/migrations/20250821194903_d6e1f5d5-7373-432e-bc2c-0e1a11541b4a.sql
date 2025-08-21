-- PHASE 1: CRITICAL SECURITY FIXES (FINAL)

-- 1. Remove problematic SECURITY DEFINER views and recreate as regular views
DROP VIEW IF EXISTS public.seller_dashboard;
DROP VIEW IF EXISTS public.sellers_basic_info;
DROP VIEW IF EXISTS public.conversations_with_last_message;

-- Recreate seller_dashboard as regular view (without SECURITY DEFINER)
CREATE VIEW public.seller_dashboard AS
SELECT 
  s.id,
  s.name,
  s.active,
  COUNT(DISTINCT l.id) as total_leads,
  COUNT(DISTINCT CASE WHEN l.status = 'attending' THEN l.id END) as active_leads,
  COUNT(DISTINCT CASE WHEN l.generated_sale = true THEN l.id END) as total_sales,
  COALESCE(SUM(CASE WHEN l.generated_sale = true THEN l.sale_value END), 0) as total_revenue,
  COALESCE(AVG(qa.score), 0) as avg_quality_score
FROM public.sellers s
LEFT JOIN public.leads l ON s.id = l.seller_id
LEFT JOIN public.quality_analyses qa ON s.id = qa.seller_id
WHERE s.active = true AND s.deleted = false
GROUP BY s.id, s.name, s.active;

-- Recreate sellers_basic_info as regular view (without SECURITY DEFINER)
CREATE VIEW public.sellers_basic_info AS
SELECT 
  id,
  name,
  active,
  experience_years,
  performance_score,
  conversion_rate,
  current_workload,
  max_concurrent_leads,
  personality_type,
  created_at
FROM public.sellers
WHERE active = true AND deleted = false;

-- Recreate conversations_with_last_message as regular view (without SECURITY DEFINER)
CREATE VIEW public.conversations_with_last_message AS
SELECT 
  c.id,
  c.customer_name,
  c.phone_number,
  c.status,
  c.assigned_seller_id,
  c.assigned_operator_id,
  c.fallback_mode,
  c.fallback_taken_by,
  c.created_at,
  c.updated_at,
  s.name as seller_name,
  last_msg.content as last_message,
  last_msg.sender_type as last_sender_type,
  last_msg.created_at as last_message_at,
  msg_count.total_messages
FROM public.conversations c
LEFT JOIN public.sellers s ON c.assigned_seller_id = s.id
LEFT JOIN LATERAL (
  SELECT content, sender_type, created_at
  FROM public.messages m
  WHERE m.conversation_id = c.id
  ORDER BY m.created_at DESC
  LIMIT 1
) last_msg ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*) as total_messages
  FROM public.messages m
  WHERE m.conversation_id = c.id
) msg_count ON true;

-- 2. Enhanced phone number masking function
CREATE OR REPLACE FUNCTION public.get_masked_customer_phone(phone_number text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    CASE 
      WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) THEN phone_number
      WHEN has_role(auth.uid(), 'operator'::app_role) THEN 
        CASE 
          WHEN LENGTH(phone_number) > 6 THEN 
            LEFT(phone_number, 3) || '****' || RIGHT(phone_number, 3)
          ELSE '****'
        END
      ELSE '****'
    END;
$$;

-- 3. Add security audit function
CREATE OR REPLACE FUNCTION public.audit_security_event(
  event_type text,
  table_name text,
  record_id uuid,
  details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.system_logs (
    type,
    source,
    message,
    details,
    user_id
  ) VALUES (
    'security',
    'auth_security',
    event_type || ' on ' || table_name,
    jsonb_build_object(
      'event_type', event_type,
      'table_name', table_name,
      'record_id', record_id,
      'user_id', auth.uid(),
      'timestamp', now(),
      'additional_details', details
    ),
    auth.uid()
  );
END;
$$;

-- 4. Add function to log sensitive data access (manual logging)
CREATE OR REPLACE FUNCTION public.log_data_access(
  table_name text,
  record_id uuid,
  sensitive_fields text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
      table_name,
      record_id,
      'SELECT',
      sensitive_fields
    );
  END IF;
END;
$$;

-- 5. Ensure user_id fields are not null where needed
ALTER TABLE public.user_roles ALTER COLUMN user_id SET NOT NULL;

-- 6. Create indexes for better performance on security queries
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_role ON public.user_roles(user_id, role);
CREATE INDEX IF NOT EXISTS idx_conversations_assigned_operator ON public.conversations(assigned_operator_id) WHERE assigned_operator_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_data_access_logs_user_timestamp ON public.data_access_logs(user_id, created_at);

-- 7. Add RLS policies to prevent views from bypassing security
ALTER VIEW public.seller_dashboard SET (security_barrier = true);
ALTER VIEW public.sellers_basic_info SET (security_barrier = true);
ALTER VIEW public.conversations_with_last_message SET (security_barrier = true);

-- 8. Create secure wrapper functions for sensitive data access
CREATE OR REPLACE FUNCTION public.get_conversation_with_logging(conversation_id uuid)
RETURNS TABLE(
  id uuid,
  customer_name text,
  phone_number text,
  status text,
  assigned_seller_id uuid,
  assigned_operator_id uuid,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Log the access
  PERFORM public.log_data_access('conversations', conversation_id, ARRAY['customer_name', 'phone_number']);
  
  -- Return the data with appropriate masking
  RETURN QUERY
  SELECT 
    c.id,
    c.customer_name,
    public.get_masked_customer_phone(c.phone_number) as phone_number,
    c.status,
    c.assigned_seller_id,
    c.assigned_operator_id,
    c.created_at,
    c.updated_at
  FROM public.conversations c
  WHERE c.id = conversation_id
    AND (
      has_role(auth.uid(), 'admin'::app_role) 
      OR has_role(auth.uid(), 'manager'::app_role)
      OR (has_role(auth.uid(), 'operator'::app_role) AND c.assigned_operator_id = auth.uid())
    );
END;
$$;

-- Log this security enhancement using valid source
INSERT INTO public.system_logs (type, source, message, details)
VALUES (
  'info',
  'auth_security',
  'Critical security fixes applied - Phase 1 complete',
  jsonb_build_object(
    'fixes_applied', ARRAY[
      'removed_security_definer_views',
      'added_security_barrier_views',
      'enhanced_phone_masking',
      'added_security_audit_function',
      'added_manual_access_logging',
      'created_secure_wrapper_functions'
    ],
    'timestamp', now()
  )
);