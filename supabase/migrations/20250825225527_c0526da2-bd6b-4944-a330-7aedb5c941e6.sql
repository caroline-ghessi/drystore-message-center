-- Corrigir configuração WHAPI do Douglas: definir seller_id correto
UPDATE public.whapi_configurations 
SET seller_id = 'bb2d7ce2-5b14-4e72-9da8-161fda1b8597',
    webhook_url = 'https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/whapi-webhook/bb2d7ce2-5b14-4e72-9da8-161fda1b8597'
WHERE phone_number = '5196494341' 
  AND type = 'seller'
  AND seller_id IS NULL;