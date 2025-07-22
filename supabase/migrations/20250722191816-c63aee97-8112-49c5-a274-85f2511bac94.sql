
-- Primeiro, vamos corrigir o campo token_secret_name na tabela whapi_logs que está faltando
ALTER TABLE public.whapi_logs 
ADD COLUMN IF NOT EXISTS token_secret_name TEXT;

-- Atualizar a função set_message_direction para usar o token_secret_name correto
CREATE OR REPLACE FUNCTION public.set_message_direction()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o token é do Rodrigo Bot
  IF NEW.token_secret_name = 'WHAPI_TOKEN_5551981155622' THEN
    NEW.direction = 'bot_to_seller';
  -- Se o phone_from é do Rodrigo Bot (número completo ou sem 9)
  ELSIF NEW.phone_from IN ('5551981155622', '555181155622') THEN
    NEW.direction = 'bot_to_seller';
  -- Se o número de destino não tem @s.whatsapp.net (formato cliente)
  ELSIF NEW.phone_to NOT LIKE '%@s.whatsapp.net' THEN
    NEW.direction = 'seller_to_customer';
  -- Se o número de origem não tem @s.whatsapp.net (formato cliente)
  ELSIF NEW.phone_from NOT LIKE '%@s.whatsapp.net' THEN
    NEW.direction = 'customer_to_seller';
  ELSE
    NEW.direction = 'unknown';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Corrigir o número do Rodrigo Bot na configuração WHAPI (pode estar errado)
UPDATE public.whapi_configurations 
SET phone_number = '5551981155622'
WHERE type = 'rodrigo_bot' AND token_secret_name = 'WHAPI_TOKEN_5551981155622';

-- Se não existe a configuração do Rodrigo Bot, criar
INSERT INTO public.whapi_configurations (
  name,
  phone_number,
  token_secret_name,
  webhook_url,
  type,
  active,
  health_status
)
SELECT 
  'Rodrigo Bot - Oficial',
  '5551981155622',
  'WHAPI_TOKEN_5551981155622',
  'https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/whapi-webhook',
  'rodrigo_bot',
  true,
  'healthy'
WHERE NOT EXISTS (
  SELECT 1 FROM public.whapi_configurations 
  WHERE type = 'rodrigo_bot' AND token_secret_name = 'WHAPI_TOKEN_5551981155622'
);

-- Criar índice para token_secret_name
CREATE INDEX IF NOT EXISTS idx_whapi_logs_token_secret ON public.whapi_logs(token_secret_name);
