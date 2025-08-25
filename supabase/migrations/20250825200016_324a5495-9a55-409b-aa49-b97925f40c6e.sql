-- Criar configurações WHAPI seguras para todos os vendedores ativos
-- Usando source válido 'whapi' baseado na constraint existente

INSERT INTO whapi_configurations (
  name,
  phone_number,
  token_secret_name,
  webhook_url,
  type,
  seller_id,
  active,
  health_status
)
SELECT 
  s.name || ' - WHAPI',
  REPLACE(s.phone_number, ' ', ''), -- Remove espaços do número
  s.whapi_token_secret_name,
  'https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/whapi-webhook',
  'seller',
  s.id,
  true,
  'unknown'
FROM sellers s
WHERE s.active = true 
  AND s.whapi_token_secret_name IS NOT NULL 
  AND s.whapi_token_secret_name != ''
  AND NOT EXISTS (
    SELECT 1 FROM whapi_configurations wc 
    WHERE wc.seller_id = s.id AND wc.type = 'seller'
  );

-- Atualizar números de telefone para remover espaços e garantir formato correto
UPDATE whapi_configurations 
SET phone_number = REPLACE(phone_number, ' ', '')
WHERE phone_number LIKE '% %';

-- Inserir logs para auditoria usando source válido
INSERT INTO system_logs (type, source, message, details)
VALUES (
  'info',
  'whapi',
  'Configurações WHAPI criadas para vendedores ativos',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'create_seller_whapi_configs',
    'security_migration', true
  )
);