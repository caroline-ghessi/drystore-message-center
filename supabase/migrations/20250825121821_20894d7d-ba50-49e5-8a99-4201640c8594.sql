-- Atualizar apenas a api_key da integração Dify existente
UPDATE public.integrations 
SET config = jsonb_set(config, '{api_key}', '"DIFY_API_KEY"')
WHERE name = 'Dify Chatflow' AND type = 'dify';

-- Log da correção
INSERT INTO public.system_logs (type, source, message, details)
VALUES (
  'info',
  'system_repair',
  'API key da integração Dify configurada',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'set_dify_api_key'
  )
);