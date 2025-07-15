-- Criar registro para integração Dify (sem ON CONFLICT pois não há constraint unique)
INSERT INTO integrations (type, name, config, active) 
SELECT 'dify', 'Dify Chatflow', '{"api_url": "", "api_key": ""}'::jsonb, false
WHERE NOT EXISTS (
  SELECT 1 FROM integrations WHERE type = 'dify'
);