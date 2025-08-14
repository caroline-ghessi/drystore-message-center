-- Comprehensive security fixes for role-based access control and proper RLS policies

-- Create user roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'operator', 'seller');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid uuid DEFAULT auth.uid())
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = user_uuid LIMIT 1;
$$;

-- Function to check if user has specific role
CREATE OR REPLACE FUNCTION public.has_role(user_uuid uuid, required_role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = user_uuid AND role = required_role
  );
$$;

-- Function to check if user can access seller data
CREATE OR REPLACE FUNCTION public.can_access_seller_data(user_uuid uuid, target_seller_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Enable all for authenticated users on conversations" ON conversations;
DROP POLICY IF EXISTS "Enable all for authenticated users on messages" ON messages;
DROP POLICY IF EXISTS "Enable all for authenticated users on leads" ON leads;
DROP POLICY IF EXISTS "Enable all for authenticated users on sellers" ON sellers;
DROP POLICY IF EXISTS "Enable all for authenticated users on quality_analyses" ON quality_analyses;
DROP POLICY IF EXISTS "Enable all for authenticated users on whapi_logs" ON whapi_logs;
DROP POLICY IF EXISTS "Enable all for authenticated users on system_logs" ON system_logs;
DROP POLICY IF EXISTS "Enable all for authenticated users on webhook_logs" ON webhook_logs;
DROP POLICY IF EXISTS "Enable all for authenticated users on integrations" ON integrations;
DROP POLICY IF EXISTS "Enable all for authenticated users on settings" ON settings;

-- Create granular RLS policies for conversations
CREATE POLICY "admins_managers_can_view_all_conversations" ON conversations
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "operators_can_view_conversations" ON conversations  
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'operator'));

CREATE POLICY "sellers_can_view_assigned_conversations" ON conversations
FOR SELECT TO authenticated  
USING (
  public.has_role(auth.uid(), 'seller') AND 
  (assigned_seller_id IS NULL OR public.can_access_seller_data(auth.uid(), assigned_seller_id))
);

CREATE POLICY "admins_managers_operators_can_manage_conversations" ON conversations
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'manager') OR 
  public.has_role(auth.uid(), 'operator')
);

-- Create granular RLS policies for messages
CREATE POLICY "admins_managers_can_view_all_messages" ON messages
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "operators_can_view_messages" ON messages
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'operator'));

CREATE POLICY "sellers_can_view_assigned_messages" ON messages
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'seller') AND 
  EXISTS (
    SELECT 1 FROM conversations c 
    WHERE c.id = messages.conversation_id 
    AND (c.assigned_seller_id IS NULL OR public.can_access_seller_data(auth.uid(), c.assigned_seller_id))
  )
);

CREATE POLICY "admins_managers_operators_can_manage_messages" ON messages
FOR ALL TO authenticated  
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'manager') OR 
  public.has_role(auth.uid(), 'operator')
);

-- Create granular RLS policies for leads
CREATE POLICY "admins_managers_can_view_all_leads" ON leads
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "operators_can_view_leads" ON leads
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'operator'));

CREATE POLICY "sellers_can_view_assigned_leads" ON leads  
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'seller') AND 
  public.can_access_seller_data(auth.uid(), seller_id)
);

CREATE POLICY "admins_managers_operators_can_manage_leads" ON leads
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'manager') OR 
  public.has_role(auth.uid(), 'operator')
);

-- Create granular RLS policies for sellers
CREATE POLICY "admins_managers_can_view_all_sellers" ON sellers
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "operators_can_view_active_sellers" ON sellers
FOR SELECT TO authenticated  
USING (public.has_role(auth.uid(), 'operator') AND active = true);

CREATE POLICY "sellers_can_view_own_profile" ON sellers
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'seller') AND 
  public.can_access_seller_data(auth.uid(), id)
);

CREATE POLICY "admins_managers_can_manage_sellers" ON sellers
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- Create policies for quality_analyses 
CREATE POLICY "admins_managers_can_view_all_quality_analyses" ON quality_analyses
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "sellers_can_view_own_quality_analyses" ON quality_analyses
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'seller') AND 
  public.can_access_seller_data(auth.uid(), seller_id)
);

CREATE POLICY "admins_managers_can_manage_quality_analyses" ON quality_analyses
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- Create policies for system logs (admin/manager only)
CREATE POLICY "admins_managers_can_view_system_logs" ON system_logs
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "admins_can_manage_system_logs" ON system_logs  
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create policies for webhook logs (admin/manager only)
CREATE POLICY "admins_managers_can_view_webhook_logs" ON webhook_logs
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "admins_can_manage_webhook_logs" ON webhook_logs
FOR ALL TO authenticated  
USING (public.has_role(auth.uid(), 'admin'));

-- Create policies for whapi logs (admin/manager only) 
CREATE POLICY "admins_managers_can_view_whapi_logs" ON whapi_logs
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "admins_can_manage_whapi_logs" ON whapi_logs
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create policies for integrations (admin only)
CREATE POLICY "admins_can_manage_integrations" ON integrations  
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create policies for settings (admin only)
CREATE POLICY "admins_can_manage_settings" ON settings
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create policy for user_roles (users can view their own roles, admins can manage all)
CREATE POLICY "users_can_view_own_roles" ON user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "admins_can_manage_all_roles" ON user_roles
FOR ALL TO authenticated  
USING (public.has_role(auth.uid(), 'admin'));

-- Recreate views without security definer to fix security issue
DROP VIEW IF EXISTS conversations_with_last_message;
CREATE VIEW conversations_with_last_message AS
SELECT 
    c.id,
    c.phone_number,
    c.customer_name,
    c.status,
    c.assigned_seller_id,
    c.fallback_mode,
    c.fallback_taken_by,
    c.created_at,
    c.updated_at,
    s.name as seller_name,
    last_msg.content as last_message,
    last_msg.sender_type as last_sender_type,
    last_msg.created_at as last_message_at,
    msg_count.total_messages
FROM conversations c
LEFT JOIN sellers s ON c.assigned_seller_id = s.id
LEFT JOIN LATERAL (
    SELECT content, sender_type, created_at
    FROM messages m 
    WHERE m.conversation_id = c.id 
    ORDER BY m.created_at DESC 
    LIMIT 1
) last_msg ON true
LEFT JOIN LATERAL (
    SELECT COUNT(*) as total_messages
    FROM messages m2 
    WHERE m2.conversation_id = c.id
) msg_count ON true;

DROP VIEW IF EXISTS seller_dashboard;
CREATE VIEW seller_dashboard AS
SELECT 
    s.id,
    s.name,
    s.active,
    COUNT(DISTINCT l.id) as total_leads,
    COUNT(DISTINCT CASE WHEN l.status = 'attending' THEN l.id END) as active_leads,
    COUNT(DISTINCT CASE WHEN l.generated_sale = true THEN l.id END) as total_sales,
    COALESCE(SUM(CASE WHEN l.generated_sale = true THEN l.sale_value END), 0) as total_revenue,
    COALESCE(AVG(qa.score), 0) as avg_quality_score
FROM sellers s
LEFT JOIN leads l ON s.id = l.seller_id
LEFT JOIN quality_analyses qa ON s.id = qa.seller_id
GROUP BY s.id, s.name, s.active;

-- Insert default admin role for existing profiles (if any exist)
-- This ensures existing users can access the system
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role 
FROM auth.users 
WHERE id NOT IN (SELECT user_id FROM public.user_roles)
ON CONFLICT (user_id, role) DO NOTHING;