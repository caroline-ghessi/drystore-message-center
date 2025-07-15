-- Add Dify and batching settings
INSERT INTO public.settings (key, value, description) 
VALUES 
  ('whatsapp_message_batch_delay', '60', 'Tempo em segundos para agrupar mensagens antes de enviar ao Dify'),
  ('dify_api_endpoint', '""', 'URL do endpoint da API do Dify para processamento de mensagens'),
  ('dify_api_key', '""', 'Chave de API do Dify para autenticação')
ON CONFLICT (key) DO NOTHING;