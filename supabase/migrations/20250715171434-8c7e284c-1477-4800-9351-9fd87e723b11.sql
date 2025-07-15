-- Insert WhatsApp Meta integration directly
INSERT INTO public.integrations (name, type, config, active)
SELECT 
  'WhatsApp Business Meta',
  'whatsapp',
  jsonb_build_object(
    'webhook_verify_token', 'whatsapp_meta_verify_mTk9Xx2A',
    'meta_access_token', '',
    'phone_number_id', '',
    'business_account_id', '',
    'app_id', '',
    'webhook_url', 'https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/whatsapp-webhook'
  ),
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.integrations 
  WHERE name = 'WhatsApp Business Meta'
);

-- Add Dify and batching settings
INSERT INTO public.settings (key, value, description) 
VALUES 
  ('whatsapp_message_batch_delay', '60', 'Tempo em segundos para agrupar mensagens antes de enviar ao Dify'),
  ('dify_api_endpoint', '""', 'URL do endpoint da API do Dify para processamento de mensagens'),
  ('dify_api_key', '""', 'Chave de API do Dify para autenticação')
ON CONFLICT (key) DO NOTHING;