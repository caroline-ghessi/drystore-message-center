-- Corrigir a configuração da integração Dify
UPDATE public.integrations 
SET config = jsonb_build_object(
  'api_url', 'https://api.dify.ai/v1',
  'api_key', 'DIFY_API_KEY'
)
WHERE name = 'dify' AND type = 'chatbot';

-- Se não existir, criar a integração Dify
INSERT INTO public.integrations (name, type, config, active)
SELECT 'dify', 'chatbot', jsonb_build_object(
  'api_url', 'https://api.dify.ai/v1', 
  'api_key', 'DIFY_API_KEY'
), true
WHERE NOT EXISTS (SELECT 1 FROM public.integrations WHERE name = 'dify' AND type = 'chatbot');

-- Log da correção
INSERT INTO public.system_logs (type, source, message, details)
VALUES (
  'info',
  'system_repair',
  'Configuração da integração Dify corrigida',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'fix_dify_integration_config'
  )
);