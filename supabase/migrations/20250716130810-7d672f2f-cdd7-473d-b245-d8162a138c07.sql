-- Ativar e configurar corretamente a integração do Dify
UPDATE integrations 
SET 
  active = true,
  config = jsonb_build_object(
    'api_url', 'https://api.dify.ai/v1',
    'api_key', ''
  ),
  updated_at = now()
WHERE type = 'dify';