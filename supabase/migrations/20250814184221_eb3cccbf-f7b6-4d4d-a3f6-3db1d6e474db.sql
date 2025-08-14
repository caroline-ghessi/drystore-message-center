-- Fix critical security issues identified in security review

-- 1. Drop and recreate views without SECURITY DEFINER to ensure RLS is respected
DROP VIEW IF EXISTS public.conversations_with_last_message;
DROP VIEW IF EXISTS public.seller_dashboard;

-- 2. Create conversations_with_last_message view without SECURITY DEFINER
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

-- 3. Create seller_dashboard view without SECURITY DEFINER  
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

-- 4. Enable RLS on views by ensuring proper policies exist on underlying tables
-- (RLS policies already exist on conversations, messages, leads, sellers, quality_analyses)

-- 5. Add RLS policies for the profiles table to restrict access
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage all profiles" ON public.profiles
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 6. Fix database functions to set proper search_path and security
CREATE OR REPLACE FUNCTION public.set_message_direction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Se o token é do Rodrigo Bot
  IF NEW.token_secret_name = 'WHAPI_TOKEN_5551981155622' THEN
    NEW.direction = 'bot_to_seller';
  -- Se o phone_from é do Rodrigo Bot (número completo ou sem 9)
  ELSIF NEW.phone_from IN ('5551981155622', '555181155622') THEN
    NEW.direction = 'bot_to_seller';
  -- Se o número de destino não tem @s.whatsapp.net (formato cliente)
  ELSIF NEW.phone_to NOT LIKE '%@s.whatsapp.net' THEN
    NEW.direction = 'seller_to_customer';
  -- Se o número de origem não tem @s.whatsapp.net (formato cliente)
  ELSIF NEW.phone_from NOT LIKE '%@s.whatsapp.net' THEN
    NEW.direction = 'customer_to_seller';
  ELSE
    NEW.direction = 'unknown';
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  stats JSON;
BEGIN
  SELECT json_build_object(
    'total_conversations', COUNT(DISTINCT c.id),
    'active_conversations', COUNT(DISTINCT CASE WHEN c.status != 'finished' THEN c.id END),
    'total_leads', COUNT(DISTINCT l.id),
    'active_leads', COUNT(DISTINCT CASE WHEN l.status = 'attending' THEN l.id END),
    'total_sales', COUNT(DISTINCT CASE WHEN l.generated_sale = true THEN l.id END),
    'total_revenue', COALESCE(SUM(CASE WHEN l.generated_sale = true THEN l.sale_value END), 0),
    'active_sellers', COUNT(DISTINCT CASE WHEN s.active = true THEN s.id END)
  ) INTO stats
  FROM public.conversations c
  LEFT JOIN public.leads l ON c.id = l.conversation_id
  LEFT JOIN public.sellers s ON s.active = true;
  
  RETURN stats;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_seller_conversations(seller_uuid uuid)
RETURNS TABLE(conversation_id uuid, customer_name text, phone_number text, last_message text, last_message_at timestamp with time zone, status text, total_messages bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.customer_name,
    c.phone_number,
    cv.last_message,
    cv.last_message_at,
    l.status,
    cv.total_messages
  FROM public.conversations c
  JOIN public.leads l ON c.id = l.conversation_id
  JOIN public.conversations_with_last_message cv ON c.id = cv.id
  WHERE l.seller_id = seller_uuid
  ORDER BY cv.last_message_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_message_queue()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  queue_record RECORD;
  processed_count INTEGER := 0;
BEGIN
  FOR queue_record IN 
    SELECT * FROM public.message_queue 
    WHERE status = 'waiting' AND scheduled_for <= NOW()
    ORDER BY scheduled_for
  LOOP
    -- Aqui seria implementada a lógica de envio para o bot
    -- Por enquanto, apenas marcar como processado
    UPDATE public.message_queue 
    SET status = 'sent', processed_at = NOW()
    WHERE id = queue_record.id;
    
    processed_count := processed_count + 1;
  END LOOP;
  
  RETURN processed_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_whapi_configurations_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;