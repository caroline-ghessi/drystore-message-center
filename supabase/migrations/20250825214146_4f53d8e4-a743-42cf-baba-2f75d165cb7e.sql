-- Corrigir o número de telefone do Douglas (remover "51" duplicado)
UPDATE public.sellers 
SET phone_number = '5196494341',
    whapi_status = 'pending'
WHERE phone_number = '515196494341' 
  AND name = 'Douglas'
  AND active = true;

-- Verificar se já existe configuração WHAPI para o Douglas
DO $$
BEGIN
  -- Se não existe, inserir
  IF NOT EXISTS (SELECT 1 FROM public.whapi_configurations WHERE phone_number = '5196494341' AND type = 'seller') THEN
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
    );
  ELSE
    -- Se existe, atualizar
    UPDATE public.whapi_configurations 
    SET seller_id = (SELECT id FROM public.sellers WHERE phone_number = '5196494341' AND name = 'Douglas' AND active = true LIMIT 1),
        token_secret_name = 'WHAPI_TOKEN_DOUGLAS_5196494341',
        active = true,
        health_status = 'healthy'
    WHERE phone_number = '5196494341' AND type = 'seller';
  END IF;
END $$;

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