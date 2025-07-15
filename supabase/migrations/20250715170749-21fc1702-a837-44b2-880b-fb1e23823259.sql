-- Add WhatsApp Meta integration configuration
INSERT INTO public.integrations (name, type, config, active) VALUES
(
  'WhatsApp Business Meta',
  'whatsapp_meta',
  jsonb_build_object(
    'webhook_verify_token', 'whatsapp_meta_verify_' || substr(gen_random_uuid()::text, 1, 8),
    'meta_access_token', '',
    'phone_number_id', '',
    'business_account_id', '',
    'app_id', '',
    'webhook_url', 'https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/whatsapp-webhook'
  ),
  true
);

-- Add settings for message batching
INSERT INTO public.settings (key, value, description) VALUES
(
  'whatsapp_message_batch_delay',
  '60',
  'Tempo em segundos para agrupar mensagens antes de enviar ao Dify'
),
(
  'dify_api_endpoint',
  '""',
  'URL do endpoint da API do Dify para processamento de mensagens'
),
(
  'dify_api_key',
  '""',
  'Chave de API do Dify para autenticação'
) ON CONFLICT (key) DO NOTHING;