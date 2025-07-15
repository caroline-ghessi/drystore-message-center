-- Check existing types and constraints
SELECT DISTINCT type FROM public.integrations;

-- Try to insert with type 'meta'
INSERT INTO public.integrations (name, type, config, active)
SELECT 
  'WhatsApp Business Meta',
  'meta',
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