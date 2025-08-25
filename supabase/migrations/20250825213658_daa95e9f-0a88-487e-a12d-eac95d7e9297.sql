-- Corrigir o número de telefone do Douglas (remover "51" duplicado)
UPDATE public.sellers 
SET phone_number = '5196494341',
    whapi_status = 'pending'
WHERE phone_number = '515196494341' 
  AND name = 'Douglas'
  AND active = true;

-- Criar configuração WHAPI para o Douglas
INSERT INTO public.whapi_configurations (
  name,
  phone_number,
  token_secret_name,
  webhook_url,
  type,
  seller_id,
  active,
  health_status
) VALUES (
  'Douglas - WHAPI',
  '5196494341',
  'WHAPI_TOKEN_DOUGLAS_5196494341',
  'https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/whapi-webhook',
  'seller',
  (SELECT id FROM public.sellers WHERE phone_number = '5196494341' AND name = 'Douglas' AND active = true LIMIT 1),
  true,
  'healthy'
) ON CONFLICT (phone_number, type) DO UPDATE SET
  seller_id = EXCLUDED.seller_id,
  token_secret_name = EXCLUDED.token_secret_name,
  active = EXCLUDED.active,
  health_status = EXCLUDED.health_status;

-- Atualizar o seller com a informação do token secret
UPDATE public.sellers 
SET whapi_token_secret_name = 'WHAPI_TOKEN_DOUGLAS_5196494341',
    whapi_status = 'connected'
WHERE phone_number = '5196494341' 
  AND name = 'Douglas'
  AND active = true;

-- Remover registros duplicados do Douglas
DELETE FROM public.sellers 
WHERE name = 'Douglas'
  AND phone_number != '5196494341'
  AND (deleted = true OR active = false);