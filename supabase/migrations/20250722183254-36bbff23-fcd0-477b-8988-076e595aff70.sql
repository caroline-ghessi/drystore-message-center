-- Corrigir o problema dos search_path mutáveis nas funções
-- Função set_message_direction já criada anteriormente
ALTER FUNCTION public.set_message_direction() SET search_path = public;

-- Função update_updated_at_column
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

-- Função process_message_queue
ALTER FUNCTION public.process_message_queue() SET search_path = public;

-- Função update_whapi_configurations_updated_at
ALTER FUNCTION public.update_whapi_configurations_updated_at() SET search_path = public;

-- Função get_dashboard_stats
ALTER FUNCTION public.get_dashboard_stats() SET search_path = public;

-- Função get_seller_conversations
ALTER FUNCTION public.get_seller_conversations(seller_uuid uuid) SET search_path = public;