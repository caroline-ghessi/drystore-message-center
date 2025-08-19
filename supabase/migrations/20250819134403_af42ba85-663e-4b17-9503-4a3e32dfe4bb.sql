-- CRITICAL SECURITY FIXES IMPLEMENTATION
-- Phase 1: Assignment-Based Access Control & Data Protection

-- Fix the system_logs constraint issue that's causing audit function failures
ALTER TABLE public.system_logs DROP CONSTRAINT IF EXISTS system_logs_source_check;

-- Add proper check constraint for system_logs source field
ALTER TABLE public.system_logs ADD CONSTRAINT system_logs_source_check 
CHECK (source IN ('auth', 'auth_security', 'user_management', 'data_retention', 'whapi', 'meta', 'dify', 'webhook', 'system', 'security', 'database', 'application'));

-- Update RLS policies for STRICT assignment-based access control
-- Operators can ONLY access conversations explicitly assigned to them (remove NULL access)

DROP POLICY IF EXISTS "operators_can_view_assigned_conversations" ON public.conversations;
CREATE POLICY "operators_can_view_assigned_conversations" 
ON public.conversations 
FOR SELECT 
USING (
  has_role(auth.uid(), 'operator'::app_role) AND 
  assigned_operator_id = auth.uid()
);

DROP POLICY IF EXISTS "operators_can_update_assigned_conversations" ON public.conversations;
CREATE POLICY "operators_can_update_assigned_conversations" 
ON public.conversations 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'operator'::app_role) AND 
  assigned_operator_id = auth.uid()
);

-- Messages: Operators can only access messages from their assigned conversations
DROP POLICY IF EXISTS "operators_can_view_assigned_messages" ON public.messages;
CREATE POLICY "operators_can_view_assigned_messages" 
ON public.messages 
FOR SELECT 
USING (
  has_role(auth.uid(), 'operator'::app_role) AND 
  EXISTS (
    SELECT 1 FROM public.conversations c 
    WHERE c.id = messages.conversation_id 
    AND c.assigned_operator_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "operators_can_manage_assigned_messages" ON public.messages;
CREATE POLICY "operators_can_manage_assigned_messages" 
ON public.messages 
FOR ALL 
USING (
  has_role(auth.uid(), 'operator'::app_role) AND 
  EXISTS (
    SELECT 1 FROM public.conversations c 
    WHERE c.id = messages.conversation_id 
    AND c.assigned_operator_id = auth.uid()
  )
);

-- Leads: Operators can only access leads for their assigned conversations
DROP POLICY IF EXISTS "operators_can_view_assigned_leads" ON public.leads;
CREATE POLICY "operators_can_view_assigned_leads" 
ON public.leads 
FOR SELECT 
USING (
  has_role(auth.uid(), 'operator'::app_role) AND 
  EXISTS (
    SELECT 1 FROM public.conversations c 
    WHERE c.id = leads.conversation_id 
    AND c.assigned_operator_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "operators_can_manage_assigned_leads" ON public.leads;
CREATE POLICY "operators_can_manage_assigned_leads" 
ON public.leads 
FOR ALL 
USING (
  has_role(auth.uid(), 'operator'::app_role) AND 
  EXISTS (
    SELECT 1 FROM public.conversations c 
    WHERE c.id = leads.conversation_id 
    AND c.assigned_operator_id = auth.uid()
  )
);

-- Restrict seller data access - operators can only see basic info
DROP POLICY IF EXISTS "operators_can_view_basic_seller_info" ON public.sellers;
CREATE POLICY "operators_can_view_basic_seller_info" 
ON public.sellers 
FOR SELECT 
USING (
  has_role(auth.uid(), 'operator'::app_role) AND 
  active = true
);

-- Protect WhatsApp API credentials - only admins/managers can access whapi_configurations
DROP POLICY IF EXISTS "operators_cannot_view_whapi_configs" ON public.whapi_configurations;
CREATE POLICY "operators_cannot_view_whapi_configs" 
ON public.whapi_configurations 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- System Configuration Protection - restrict modification access
DROP POLICY IF EXISTS "Enable all for authenticated users on product_categories" ON public.product_categories;
CREATE POLICY "admins_managers_can_manage_product_categories" 
ON public.product_categories 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "operators_can_view_product_categories" 
ON public.product_categories 
FOR SELECT 
USING (
  has_role(auth.uid(), 'operator'::app_role) AND active = true
);

DROP POLICY IF EXISTS "Enable all for authenticated users on seller_specialties" ON public.seller_specialties;
CREATE POLICY "admins_managers_can_manage_seller_specialties" 
ON public.seller_specialties 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "operators_can_view_seller_specialties" 
ON public.seller_specialties 
FOR SELECT 
USING (has_role(auth.uid(), 'operator'::app_role));

DROP POLICY IF EXISTS "Enable all for authenticated users on seller_skills" ON public.seller_skills;
CREATE POLICY "admins_managers_can_manage_seller_skills" 
ON public.seller_skills 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "operators_can_view_seller_skills" 
ON public.seller_skills 
FOR SELECT 
USING (has_role(auth.uid(), 'operator'::app_role));

-- Update conversations_with_last_message view to use phone masking
DROP VIEW IF EXISTS public.conversations_with_last_message;
CREATE VIEW public.conversations_with_last_message AS
SELECT 
  c.id,
  c.customer_name,
  -- Apply phone masking based on user role
  public.get_masked_phone(c.phone_number) as phone_number,
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

-- Create data access logging for sensitive field access
CREATE OR REPLACE FUNCTION public.log_customer_data_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Log when operators access customer conversations
  IF has_role(auth.uid(), 'operator'::app_role) THEN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply data access logging trigger to conversations
DROP TRIGGER IF EXISTS log_conversation_access ON public.conversations;
CREATE TRIGGER log_conversation_access
  AFTER SELECT ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.log_customer_data_access();

-- Enhanced security function to check if user can access unassigned conversations
CREATE OR REPLACE FUNCTION public.can_access_unassigned_conversations(user_uuid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    public.has_role(user_uuid, 'admin'::app_role) OR 
    public.has_role(user_uuid, 'manager'::app_role);
$$;

-- Add policy for unassigned conversations (only admins/managers)
CREATE POLICY "admins_managers_can_view_unassigned_conversations" 
ON public.conversations 
FOR SELECT 
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND
  assigned_operator_id IS NULL
);

-- Log security policy updates
INSERT INTO public.system_logs (type, source, message, details)
VALUES (
  'info',
  'security',
  'Critical security policies updated',
  jsonb_build_object(
    'updated_policies', ARRAY[
      'conversations_assignment_based_access',
      'messages_assignment_based_access', 
      'leads_assignment_based_access',
      'seller_data_protection',
      'whapi_credentials_protection',
      'system_config_protection'
    ],
    'security_level', 'critical',
    'updated_by', auth.uid(),
    'timestamp', now()
  )
);