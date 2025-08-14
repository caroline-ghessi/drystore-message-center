-- Phase 1: Fix Critical Database Security Issues (Corrected)

-- Drop existing problematic views
DROP VIEW IF EXISTS public.conversations_with_last_message CASCADE;
DROP VIEW IF EXISTS public.seller_dashboard CASCADE;

-- Create secure replacement views without SECURITY DEFINER
CREATE VIEW public.conversations_with_last_message AS
SELECT 
  c.id,
  c.customer_name,
  c.phone_number,
  c.status,
  c.assigned_seller_id,
  c.fallback_mode,
  c.fallback_taken_by,
  c.created_at,
  c.updated_at,
  s.name as seller_name,
  lm.last_message_at,
  lm.total_messages,
  lm.last_message,
  lm.last_sender_type
FROM public.conversations c
LEFT JOIN public.sellers s ON c.assigned_seller_id = s.id
LEFT JOIN (
  SELECT 
    conversation_id,
    MAX(created_at) as last_message_at,
    COUNT(*) as total_messages,
    (SELECT content FROM public.messages m2 
     WHERE m2.conversation_id = m1.conversation_id 
     ORDER BY m2.created_at DESC LIMIT 1) as last_message,
    (SELECT sender_type FROM public.messages m3 
     WHERE m3.conversation_id = m1.conversation_id 
     ORDER BY m3.created_at DESC LIMIT 1) as last_sender_type
  FROM public.messages m1
  GROUP BY conversation_id
) lm ON c.id = lm.conversation_id;

-- Create secure seller_dashboard view
CREATE VIEW public.seller_dashboard AS
SELECT 
  s.id,
  s.name,
  s.active,
  COALESCE(lead_stats.total_leads, 0) as total_leads,
  COALESCE(lead_stats.active_leads, 0) as active_leads,
  COALESCE(lead_stats.total_sales, 0) as total_sales,
  COALESCE(lead_stats.total_revenue, 0) as total_revenue,
  COALESCE(quality_stats.avg_quality_score, 0) as avg_quality_score
FROM public.sellers s
LEFT JOIN (
  SELECT 
    seller_id,
    COUNT(*) as total_leads,
    COUNT(CASE WHEN status = 'attending' THEN 1 END) as active_leads,
    COUNT(CASE WHEN generated_sale = true THEN 1 END) as total_sales,
    COALESCE(SUM(CASE WHEN generated_sale = true THEN sale_value END), 0) as total_revenue
  FROM public.leads
  GROUP BY seller_id
) lead_stats ON s.id = lead_stats.seller_id
LEFT JOIN (
  SELECT 
    seller_id,
    AVG(score) as avg_quality_score
  FROM public.quality_analyses
  GROUP BY seller_id
) quality_stats ON s.id = quality_stats.seller_id;

-- Create role-based access control functions for enhanced security
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

-- Create function to check if user can access customer data
CREATE OR REPLACE FUNCTION public.can_access_customer_data(user_uuid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT 
    public.has_role(user_uuid, 'admin') OR 
    public.has_role(user_uuid, 'manager') OR
    public.has_role(user_uuid, 'operator');
$function$;

-- Add data masking function for phone numbers
CREATE OR REPLACE FUNCTION public.mask_phone_number(phone text, user_role app_role)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
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

-- Create audit log table for sensitive operations
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  table_name text,
  record_id uuid,
  old_values jsonb,
  new_values jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on audit logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can manage audit logs
CREATE POLICY "admins_can_manage_audit_logs" 
ON public.audit_logs 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create audit trigger function
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_values)
    VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_values, new_values)
    VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_values)
    VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$;

-- Add audit triggers to sensitive tables
CREATE TRIGGER leads_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER conversations_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER sellers_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.sellers
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();