-- CORREÇÃO COMPLETA DOS VENDEDORES

-- PASSO 1: Corrigir Douglas - ativar o correto
UPDATE public.sellers 
SET deleted = false, active = true, updated_at = now()
WHERE id = 'bb2d7ce2-5b14-4e72-9da8-161fda1b8597';

-- PASSO 1b: Desativar Douglas incorreto (telefone com 5 extra)
UPDATE public.sellers 
SET deleted = true, active = false, updated_at = now()
WHERE id = 'e8f0f4fd-4156-40d3-9e60-15a3ffbdc44c' AND phone_number = '515196494341';

-- PASSO 2: Verificar se whapi_configurations do Douglas está correto
UPDATE public.whapi_configurations 
SET seller_id = 'bb2d7ce2-5b14-4e72-9da8-161fda1b8597',
    webhook_url = 'https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/whapi-webhook/bb2d7ce2-5b14-4e72-9da8-161fda1b8597',
    active = true
WHERE phone_number = '5196494341' AND type = 'seller';

-- PASSO 3: Adicionar Ricardo Henriques
INSERT INTO public.sellers (
  name,
  phone_number,
  active,
  deleted,
  personality_type,
  experience_years,
  max_concurrent_leads,
  whapi_status
) 
SELECT 
  'Ricardo Henriques',
  '5194916150',
  true,
  false,
  'consultivo',
  3,
  10,
  'disconnected'
WHERE NOT EXISTS (
  SELECT 1 FROM public.sellers WHERE phone_number = '5194916150' AND deleted = false
);

-- PASSO 4: Configurar WHAPI para Ricardo (se foi criado)
INSERT INTO public.whapi_configurations (
  name,
  phone_number,
  token_secret_name,
  webhook_url,
  type,
  seller_id,
  active,
  health_status
)
SELECT 
  'Ricardo Henriques WHAPI',
  '5194916150',
  'WHAPI_TOKEN_RICARDO_5194916150',
  'https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/whapi-webhook/' || s.id,
  'seller',
  s.id,
  true,
  'unknown'
FROM public.sellers s
WHERE s.phone_number = '5194916150' 
  AND s.deleted = false
  AND NOT EXISTS (
    SELECT 1 FROM public.whapi_configurations 
    WHERE phone_number = '5194916150' AND type = 'seller'
  );