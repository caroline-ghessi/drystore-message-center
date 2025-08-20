-- Corrigir problemas de segurança das views removendo SECURITY DEFINER
-- As views não devem ter SECURITY DEFINER pois isso pode causar problemas de segurança

-- Verificar se existem views com SECURITY DEFINER e corrigi-las
DROP VIEW IF EXISTS public.conversations_with_last_message CASCADE;
DROP VIEW IF EXISTS public.seller_dashboard CASCADE;
DROP VIEW IF EXISTS public.sellers_basic_info CASCADE;

-- Recriar as views sem SECURITY DEFINER (views normais)
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
  lm.last_message_at,
  lm.last_message,
  lm.last_sender_type,
  lm.total_messages,
  s.name AS seller_name
FROM conversations c
LEFT JOIN sellers s ON c.assigned_seller_id = s.id
LEFT JOIN (
  SELECT 
    conversation_id,
    MAX(created_at) AS last_message_at,
    (array_agg(content ORDER BY created_at DESC))[1] AS last_message,
    (array_agg(sender_type ORDER BY created_at DESC))[1] AS last_sender_type,
    COUNT(*) AS total_messages
  FROM messages
  GROUP BY conversation_id
) lm ON c.id = lm.conversation_id;

CREATE VIEW public.seller_dashboard AS
SELECT 
  s.id,
  s.name,
  s.active,
  COALESCE(lead_stats.total_leads, 0) AS total_leads,
  COALESCE(lead_stats.active_leads, 0) AS active_leads,
  COALESCE(lead_stats.total_sales, 0) AS total_sales,
  COALESCE(lead_stats.total_revenue, 0) AS total_revenue,
  COALESCE(quality_stats.avg_quality_score, 0) AS avg_quality_score
FROM sellers s
LEFT JOIN (
  SELECT 
    seller_id,
    COUNT(*) AS total_leads,
    COUNT(CASE WHEN status = 'attending' THEN 1 END) AS active_leads,
    COUNT(CASE WHEN generated_sale = true THEN 1 END) AS total_sales,
    COALESCE(SUM(CASE WHEN generated_sale = true THEN sale_value END), 0) AS total_revenue
  FROM leads
  GROUP BY seller_id
) lead_stats ON s.id = lead_stats.seller_id
LEFT JOIN (
  SELECT 
    seller_id,
    AVG(score) AS avg_quality_score
  FROM quality_analyses
  GROUP BY seller_id
) quality_stats ON s.id = quality_stats.seller_id;

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
FROM sellers
WHERE NOT deleted;