-- Criar registro para integração Dify
INSERT INTO integrations (type, name, config, active) 
VALUES (
  'dify',
  'Dify Chatflow',
  '{"api_url": "", "api_key": ""}'::jsonb,
  false
) ON CONFLICT (type) DO UPDATE SET
  name = EXCLUDED.name,
  updated_at = now();

-- Atualizar config.toml para incluir nova edge function
-- (Isso será feito automaticamente pelo sistema)