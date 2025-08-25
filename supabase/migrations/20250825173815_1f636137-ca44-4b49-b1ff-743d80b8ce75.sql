-- Corrigir configuração do Dify: alterar api_base_url para api_url
UPDATE public.integrations 
SET config = jsonb_set(
  jsonb_set(
    config, 
    '{api_url}', 
    config->'api_base_url'
  ),
  '{api_base_url}',
  'null'::jsonb
) - 'api_base_url'
WHERE type = 'dify' AND config ? 'api_base_url';

-- Limpar mensagens inválidas da fila (conversas em fallback_mode ou sent_to_seller)
DELETE FROM public.message_queue 
WHERE conversation_id IN (
  SELECT id FROM public.conversations 
  WHERE fallback_mode = true OR status = 'sent_to_seller'
);

-- Log da correção
INSERT INTO public.system_logs (type, source, message, details)
VALUES (
  'info',
  'dify',
  'Configuração Dify corrigida e fila de mensagens limpa',
  jsonb_build_object(
    'fixed_config', 'Changed api_base_url to api_url',
    'cleaned_queue', 'Removed messages from fallback/sent_to_seller conversations',
    'timestamp', now()
  )
);