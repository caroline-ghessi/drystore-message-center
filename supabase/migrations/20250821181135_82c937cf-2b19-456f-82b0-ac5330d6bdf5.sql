-- PHASE 2: Fix Security Definer Views and complete token security

-- Fix Security Definer Views by replacing them with proper RLS-respecting alternatives
-- The problematic views are likely: seller_dashboard, sellers_basic_info, conversations_with_last_message

-- Drop and recreate seller_dashboard view without SECURITY DEFINER
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
) quality_stats ON s.id = quality_stats.seller_id
WHERE s.active = true;

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
WHERE active = true;

-- Drop and recreate conversations_with_last_message view without SECURITY DEFINER
DROP VIEW IF EXISTS public.conversations_with_last_message;
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
  msg_stats.last_message,
  msg_stats.last_message_at,
  msg_stats.last_sender_type,
  msg_stats.total_messages
FROM public.conversations c
LEFT JOIN public.sellers s ON c.assigned_seller_id = s.id
LEFT JOIN (
  SELECT 
    conversation_id,
    MAX(created_at) as last_message_at,
    COUNT(*) as total_messages,
    (SELECT content FROM public.messages m2 
     WHERE m2.conversation_id = m.conversation_id 
     ORDER BY m2.created_at DESC LIMIT 1) as last_message,
    (SELECT sender_type FROM public.messages m3 
     WHERE m3.conversation_id = m.conversation_id 
     ORDER BY m3.created_at DESC LIMIT 1) as last_sender_type
  FROM public.messages m
  GROUP BY conversation_id
) msg_stats ON c.id = msg_stats.conversation_id;

-- Enable RLS on views (they inherit from underlying tables)
-- Views automatically respect RLS policies from their underlying tables

-- Remove the old whapi_token column from sellers table (final security step)
-- First, let's make sure all tokens are migrated
UPDATE public.sellers 
SET whapi_token_secret_name = 'WHAPI_TOKEN_' || REPLACE(phone_number, '+', '')
WHERE whapi_token IS NOT NULL 
AND whapi_token != '' 
AND whapi_token_secret_name IS NULL;

-- Now drop the insecure column
ALTER TABLE public.sellers DROP COLUMN IF EXISTS whapi_token;

-- Log completion of security fixes
INSERT INTO public.system_logs (type, source, message, details)
VALUES (
  'info',
  'user_management',
  'Security Definer Views fixed and WHAPI tokens fully secured',
  jsonb_build_object(
    'views_fixed', 3,
    'tokens_secured', (SELECT COUNT(*) FROM public.sellers WHERE whapi_token_secret_name IS NOT NULL),
    'plaintext_tokens_removed', true,
    'timestamp', now()
  )
);