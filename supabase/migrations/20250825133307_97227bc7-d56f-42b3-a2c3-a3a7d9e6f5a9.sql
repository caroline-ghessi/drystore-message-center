-- Corrigir configuração do Dify
UPDATE public.integrations 
SET config = jsonb_build_object(
  'api_base_url', 'https://api.dify.ai/v1',
  'api_key', 'DIFY_API_KEY'
)
WHERE type = 'dify';

-- Inserir log para debug da configuração
INSERT INTO public.system_logs (type, source, message, details)
VALUES (
  'info',
  'dify',
  'Configuração do Dify corrigida',
  jsonb_build_object(
    'action', 'config_update',
    'timestamp', now()
  )
);