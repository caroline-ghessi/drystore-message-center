-- Adicionar campo direction para esclarecer fluxo de mensagens na tabela whapi_logs
ALTER TABLE public.whapi_logs
ADD COLUMN IF NOT EXISTS direction VARCHAR(50) CHECK (direction IN ('bot_to_seller', 'seller_to_customer', 'customer_to_seller', 'system_to_seller', 'unknown'));

-- Atualizar mensagens existentes para ter uma direção padrão
UPDATE public.whapi_logs 
SET direction = 'unknown'
WHERE direction IS NULL;

-- Criar índice para facilitar a busca por direção
CREATE INDEX IF NOT EXISTS idx_whapi_logs_direction ON public.whapi_logs(direction);

-- Adicionando trigger e função para preencher automaticamente a direção com base nos números de origem e destino
CREATE OR REPLACE FUNCTION public.set_message_direction()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o número de origem é do Rodrigo Bot (identificado pelo secret_name)
  IF NEW.token_secret_name = 'WHAPI_TOKEN_5551981155622' THEN
    NEW.direction = 'bot_to_seller';
  -- Se o número de destino está no formato de um cliente (sem @s.whatsapp.net)
  ELSIF NEW.phone_to NOT LIKE '%@s.whatsapp.net' THEN
    NEW.direction = 'seller_to_customer';
  -- Se o número de origem está no formato de um cliente
  ELSIF NEW.phone_from NOT LIKE '%@s.whatsapp.net' THEN
    NEW.direction = 'customer_to_seller';
  ELSE
    NEW.direction = 'unknown';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para novas inserções
DROP TRIGGER IF EXISTS set_message_direction_trigger ON public.whapi_logs;
CREATE TRIGGER set_message_direction_trigger
BEFORE INSERT ON public.whapi_logs
FOR EACH ROW
EXECUTE FUNCTION public.set_message_direction();