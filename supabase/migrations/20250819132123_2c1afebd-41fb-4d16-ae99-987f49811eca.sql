-- Fix Security Definer Views by recreating them without SECURITY DEFINER
-- Views inherit security from underlying tables which already have RLS

-- 1. Recreate conversations_with_last_message view
DROP VIEW IF EXISTS public.conversations_with_last_message CASCADE;

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

-- 2. Recreate seller_dashboard view  
DROP VIEW IF EXISTS public.seller_dashboard CASCADE;

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