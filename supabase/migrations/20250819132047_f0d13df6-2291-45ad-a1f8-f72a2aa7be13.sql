-- Fix Security Definer Views
-- Need to recreate the views without SECURITY DEFINER property

-- 1. Drop and recreate conversations_with_last_message view
DROP VIEW IF EXISTS public.conversations_with_last_message;

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

-- Enable RLS on the view
ALTER VIEW public.conversations_with_last_message SET (security_barrier = true);

-- Add RLS policies for conversations_with_last_message
CREATE POLICY "admins_managers_can_view_all_conversation_summaries" 
ON public.conversations_with_last_message
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "operators_can_view_conversation_summaries" 
ON public.conversations_with_last_message
FOR SELECT 
USING (has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "sellers_can_view_assigned_conversation_summaries" 
ON public.conversations_with_last_message
FOR SELECT 
USING (has_role(auth.uid(), 'seller'::app_role) AND 
       ((assigned_seller_id IS NULL) OR can_access_seller_data(auth.uid(), assigned_seller_id)));

-- 2. Drop and recreate seller_dashboard view
DROP VIEW IF EXISTS public.seller_dashboard;

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

-- Enable security barrier on seller_dashboard
ALTER VIEW public.seller_dashboard SET (security_barrier = true);

-- Add RLS policies for seller_dashboard
CREATE POLICY "admins_managers_can_view_all_seller_dashboard" 
ON public.seller_dashboard
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "sellers_can_view_own_dashboard" 
ON public.seller_dashboard
FOR SELECT 
USING (has_role(auth.uid(), 'seller'::app_role) AND can_access_seller_data(auth.uid(), id));