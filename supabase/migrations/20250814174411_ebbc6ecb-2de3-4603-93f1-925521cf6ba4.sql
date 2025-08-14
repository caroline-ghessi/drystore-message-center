-- Fix Security Definer View issues
-- Drop and recreate views to ensure they don't have SECURITY DEFINER properties

-- Drop existing views first
DROP VIEW IF EXISTS conversations_with_last_message CASCADE;
DROP VIEW IF EXISTS seller_dashboard CASCADE;

-- Recreate conversations_with_last_message view without SECURITY DEFINER
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
  s.name AS seller_name,
  last_msg.content AS last_message,
  last_msg.created_at AS last_message_at,
  last_msg.sender_type AS last_sender_type,
  msg_count.total_messages
FROM conversations c
LEFT JOIN sellers s ON c.assigned_seller_id = s.id
LEFT JOIN LATERAL (
  SELECT 
    messages.content,
    messages.created_at,
    messages.sender_type
  FROM messages
  WHERE messages.conversation_id = c.id
  ORDER BY messages.created_at DESC
  LIMIT 1
) last_msg ON true
LEFT JOIN LATERAL (
  SELECT count(*) AS total_messages
  FROM messages
  WHERE messages.conversation_id = c.id
) msg_count ON true;

-- Recreate seller_dashboard view without SECURITY DEFINER
CREATE VIEW seller_dashboard AS
SELECT 
  s.id,
  s.name,
  s.active,
  count(DISTINCT l.id) AS total_leads,
  count(DISTINCT CASE WHEN l.status = 'attending' THEN l.id END) AS active_leads,
  count(DISTINCT CASE WHEN l.generated_sale = true THEN l.id END) AS total_sales,
  sum(CASE WHEN l.generated_sale = true THEN l.sale_value ELSE 0 END) AS total_revenue,
  avg(qa.score) AS avg_quality_score
FROM sellers s
LEFT JOIN leads l ON s.id = l.seller_id
LEFT JOIN quality_analyses qa ON s.id = qa.seller_id
GROUP BY s.id, s.name, s.active;

-- Grant appropriate permissions to ensure proper access
GRANT SELECT ON conversations_with_last_message TO authenticated;
GRANT SELECT ON seller_dashboard TO authenticated;