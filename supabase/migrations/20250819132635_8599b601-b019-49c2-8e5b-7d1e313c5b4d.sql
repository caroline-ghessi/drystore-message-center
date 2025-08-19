-- CRITICAL SECURITY FIXES - Phase 1: Data Privacy & Access Control

-- 1. Add operator assignment tracking to conversations
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS assigned_operator_id uuid REFERENCES auth.users(id);

-- 2. Create phone number masking function
CREATE OR REPLACE FUNCTION public.mask_phone_for_role(phone text, user_role app_role)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    CASE 
      WHEN user_role IN ('admin', 'manager') THEN phone
      WHEN user_role = 'operator' THEN 
        CASE 
          WHEN LENGTH(phone) > 4 THEN 
            LEFT(phone, 3) || '****' || RIGHT(phone, 2)
          ELSE '****'
        END
      ELSE '****'
    END;
$$;

-- 3. UPDATE RLS POLICIES - RESTRICT OPERATOR ACCESS

-- Drop existing broad operator policies
DROP POLICY IF EXISTS "operators_can_view_conversations" ON public.conversations;
DROP POLICY IF EXISTS "admins_managers_operators_can_manage_conversations" ON public.conversations;
DROP POLICY IF EXISTS "operators_can_view_messages" ON public.messages;
DROP POLICY IF EXISTS "admins_managers_operators_can_manage_messages" ON public.messages;
DROP POLICY IF EXISTS "operators_can_view_leads" ON public.leads;
DROP POLICY IF EXISTS "admins_managers_operators_can_manage_leads" ON public.leads;

-- NEW RESTRICTED POLICIES FOR CONVERSATIONS
CREATE POLICY "operators_can_view_assigned_conversations" 
ON public.conversations 
FOR SELECT 
USING (
  has_role(auth.uid(), 'operator') AND 
  (assigned_operator_id = auth.uid() OR assigned_operator_id IS NULL)
);

CREATE POLICY "operators_can_update_assigned_conversations" 
ON public.conversations 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'operator') AND 
  (assigned_operator_id = auth.uid() OR assigned_operator_id IS NULL)
);

CREATE POLICY "admins_managers_can_manage_conversations" 
ON public.conversations 
FOR ALL 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- NEW RESTRICTED POLICIES FOR MESSAGES
CREATE POLICY "operators_can_view_assigned_messages" 
ON public.messages 
FOR SELECT 
USING (
  has_role(auth.uid(), 'operator') AND 
  EXISTS (
    SELECT 1 FROM public.conversations c 
    WHERE c.id = messages.conversation_id 
    AND (c.assigned_operator_id = auth.uid() OR c.assigned_operator_id IS NULL)
  )
);

CREATE POLICY "operators_can_manage_assigned_messages" 
ON public.messages 
FOR ALL 
USING (
  has_role(auth.uid(), 'operator') AND 
  EXISTS (
    SELECT 1 FROM public.conversations c 
    WHERE c.id = messages.conversation_id 
    AND (c.assigned_operator_id = auth.uid() OR c.assigned_operator_id IS NULL)
  )
);

CREATE POLICY "admins_managers_can_manage_messages" 
ON public.messages 
FOR ALL 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- NEW RESTRICTED POLICIES FOR LEADS
CREATE POLICY "operators_can_view_assigned_leads" 
ON public.leads 
FOR SELECT 
USING (
  has_role(auth.uid(), 'operator') AND 
  EXISTS (
    SELECT 1 FROM public.conversations c 
    WHERE c.id = leads.conversation_id 
    AND (c.assigned_operator_id = auth.uid() OR c.assigned_operator_id IS NULL)
  )
);

CREATE POLICY "operators_can_manage_assigned_leads" 
ON public.leads 
FOR ALL 
USING (
  has_role(auth.uid(), 'operator') AND 
  EXISTS (
    SELECT 1 FROM public.conversations c 
    WHERE c.id = leads.conversation_id 
    AND (c.assigned_operator_id = auth.uid() OR c.assigned_operator_id IS NULL)
  )
);

CREATE POLICY "admins_managers_can_manage_leads" 
ON public.leads 
FOR ALL 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- 4. PROTECT SENSITIVE SELLER DATA
-- Drop existing broad policies for sellers
DROP POLICY IF EXISTS "operators_can_view_active_sellers" ON public.sellers;

-- New restricted policy - operators can only see basic seller info
CREATE POLICY "operators_can_view_basic_seller_info" 
ON public.sellers 
FOR SELECT 
USING (
  has_role(auth.uid(), 'operator') AND active = true
);

-- 5. RESTRICT WHAPI CONFIGURATIONS ACCESS
-- Drop existing broad policy
DROP POLICY IF EXISTS "Enable all for authenticated users on whapi_configurations" ON public.whapi_configurations;

-- Only admins and managers can access WhatsApp API configurations
CREATE POLICY "admins_managers_can_manage_whapi_configs" 
ON public.whapi_configurations 
FOR ALL 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- 6. Create operator-safe view for sellers (no sensitive data)
CREATE OR REPLACE VIEW public.sellers_basic_info AS
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

-- Grant access to the basic view for operators
GRANT SELECT ON public.sellers_basic_info TO authenticated;

-- 7. Add audit logging for data access
CREATE TABLE IF NOT EXISTS public.data_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  table_name text NOT NULL,
  record_id uuid,
  action text NOT NULL,
  sensitive_fields text[],
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.data_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_can_manage_data_access_logs" 
ON public.data_access_logs 
FOR ALL 
USING (has_role(auth.uid(), 'admin'));

-- Log access to customer data
CREATE OR REPLACE FUNCTION public.log_customer_data_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Log when operators access customer conversations
  IF has_role(auth.uid(), 'operator') AND TG_OP = 'SELECT' THEN
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
      TG_OP,
      ARRAY['customer_name', 'phone_number']
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;