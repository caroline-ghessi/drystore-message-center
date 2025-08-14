-- Fix remaining security definer view issues

-- The linter is still detecting SECURITY DEFINER views, let's ensure they are completely removed
-- Drop views again and recreate with explicit security context

-- Drop existing views
DROP VIEW IF EXISTS public.conversations_with_last_message CASCADE;
DROP VIEW IF EXISTS public.seller_dashboard CASCADE;

-- Recreate conversations_with_last_message view with proper security context
CREATE VIEW public.conversations_with_last_message 
SECURITY INVOKER
AS
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

-- Recreate seller_dashboard view with proper security context
CREATE VIEW public.seller_dashboard 
SECURITY INVOKER
AS
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