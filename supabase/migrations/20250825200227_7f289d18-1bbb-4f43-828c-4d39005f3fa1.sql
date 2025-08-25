-- Corrigir token secret name do Cristiano Ghessi que tem espaço indevido
UPDATE sellers 
SET whapi_token_secret_name = 'WHAPI_TOKEN_51995265283'
WHERE name = 'Cristiano Ghessi' AND whapi_token_secret_name LIKE '%WHAPI_TOKEN_ 51995265283%';

-- Corrigir também na tabela whapi_configurations
UPDATE whapi_configurations 
SET token_secret_name = 'WHAPI_TOKEN_51995265283'
WHERE token_secret_name LIKE '%WHAPI_TOKEN_ 51995265283%';

-- Log da correção
INSERT INTO system_logs (type, source, message, details)
VALUES (
  'info',
  'whapi',
  'Corrigido token secret name do Cristiano Ghessi',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'fix_cristiano_token_name'
  )
);