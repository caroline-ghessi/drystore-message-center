-- Padronizar todas as URLs de webhook dos vendedores para incluir seller_id
UPDATE public.whapi_configurations 
SET webhook_url = 'https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/whapi-webhook/' || seller_id
WHERE type = 'seller' 
  AND seller_id IS NOT NULL
  AND webhook_url NOT LIKE '%/whapi-webhook/' || seller_id;

-- Manter URL específica para rodrigo_bot (sem seller_id)
UPDATE public.whapi_configurations 
SET webhook_url = 'https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/whapi-webhook'
WHERE type = 'rodrigo_bot';