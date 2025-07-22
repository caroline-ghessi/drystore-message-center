
-- Corrigir o número do Rodrigo Bot para o número real associado ao token
UPDATE public.whapi_configurations 
SET phone_number = '555181155622'
WHERE type = 'rodrigo_bot' AND token_secret_name = 'WHAPI_TOKEN_5551981155622';

-- Atualizar a função set_message_direction para reconhecer o número correto
CREATE OR REPLACE FUNCTION public.set_message_direction()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o token é do Rodrigo Bot
  IF NEW.token_secret_name = 'WHAPI_TOKEN_5551981155622' THEN
    NEW.direction = 'bot_to_seller';
  -- Se o phone_from é do Rodrigo Bot (número correto sem o 9 extra)
  ELSIF NEW.phone_from IN ('555181155622', '5551981155622') THEN
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

-- Garantir que todos os logs existentes do Rodrigo Bot tenham o token_secret_name correto
UPDATE public.whapi_logs 
SET token_secret_name = 'WHAPI_TOKEN_5551981155622',
    direction = 'bot_to_seller'
WHERE phone_from IN ('555181155622', '5551981155622') 
AND token_secret_name IS NULL;
