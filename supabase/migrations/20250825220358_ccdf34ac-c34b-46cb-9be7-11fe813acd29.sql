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

-- Log das atualizações
INSERT INTO public.system_logs (type, source, message, details)
VALUES (
  'info',
  'webhook_standardization',
  'Webhook URLs padronizadas para incluir seller_id',
  jsonb_build_object(
    'timestamp', now(),
    'sellers_updated', (SELECT COUNT(*) FROM public.whapi_configurations WHERE type = 'seller' AND seller_id IS NOT NULL)
  )
);