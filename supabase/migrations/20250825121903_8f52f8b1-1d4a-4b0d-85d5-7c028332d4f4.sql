-- Atualizar apenas a api_key da integração Dify
UPDATE public.integrations 
SET config = jsonb_set(config, '{api_key}', '"DIFY_API_KEY"')
WHERE name = 'Dify Chatflow' AND type = 'dify';