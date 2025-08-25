-- Atualizar o registro do Douglas com o nome correto do secret
UPDATE sellers 
SET whapi_token_secret_name = 'WHAPI_TOKEN_DOUGLAS_5196494341'
WHERE phone_number = '5196494341' OR name ILIKE '%douglas%';

-- Atualizar o registro do Ricardo com o nome correto do secret  
UPDATE sellers 
SET whapi_token_secret_name = 'WHAPI_TOKEN_RICARDO_5194916150'
WHERE phone_number = '5194916150' OR name ILIKE '%ricardo%';

-- Log da atualização
INSERT INTO system_logs (type, source, message, details)
VALUES (
  'info',
  'whapi_sync',
  'Sellers updated with correct WHAPI token secret names',
  jsonb_build_object(
    'douglas_secret', 'WHAPI_TOKEN_DOUGLAS_5196494341',
    'ricardo_secret', 'WHAPI_TOKEN_RICARDO_5194916150',
    'timestamp', now()
  )
);