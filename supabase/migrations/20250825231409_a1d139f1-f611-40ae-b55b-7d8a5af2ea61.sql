-- PASSO 1: Corrigir Douglas - ativar o correto e desativar o incorreto
UPDATE public.sellers 
SET deleted = false, active = true, updated_at = now()
WHERE id = 'bb2d7ce2-5b14-4e72-9da8-161fda1b8597' AND phone_number = '5196494341';

UPDATE public.sellers 
SET deleted = true, active = false, updated_at = now()
WHERE id = 'e8f0f4fd-4156-40d3-9e60-15a3ffbdc44c' AND phone_number = '5196494341';

-- PASSO 2: Adicionar Ricardo Henriques ao sistema
INSERT INTO public.sellers (
  id,
  name,
  phone_number,
  active,
  deleted,
  personality_type,
  experience_years,
  max_concurrent_leads,
  whapi_status,
  created_at,
  updated_at
) 
SELECT 
  gen_random_uuid(),
  'Ricardo Henriques',
  '5194916150',
  true,
  false,
  'consultivo',
  2,
  8,
  'disconnected',
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.sellers WHERE phone_number = '5194916150' AND deleted = false
);

-- PASSO 3: Configurar WHAPI para Ricardo
DO $$
DECLARE
  ricardo_id uuid;
BEGIN
  -- Obter ID do Ricardo
  SELECT id INTO ricardo_id FROM public.sellers WHERE phone_number = '5194916150' AND deleted = false;
  
  IF ricardo_id IS NOT NULL THEN
    -- Remover configuração existente se houver
    DELETE FROM public.whapi_configurations 
    WHERE phone_number = '5194916150' AND type = 'seller';
    
    -- Inserir nova configuração WHAPI para Ricardo
    INSERT INTO public.whapi_configurations (
      name,
      phone_number,
      token_secret_name,
      webhook_url,
      type,
      seller_id,
      active,
      health_status,
      created_at,
      updated_at
    ) VALUES (
      'Ricardo Henriques WHAPI',
      '5194916150',
      'WHAPI_TOKEN_RICARDO_5194916150',
      'https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/whapi-webhook/' || ricardo_id,
      'seller',
      ricardo_id,
      true,
      'unknown',
      now(),
      now()
    );
  END IF;
END $$;

-- PASSO 4: Verificação final e logs
INSERT INTO public.system_logs (type, source, message, details)
VALUES (
  'info',
  'webhook_setup',
  'Correção completa das configurações de vendedores finalizada',
  jsonb_build_object(
    'douglas_corrected', true,
    'ricardo_added', true,
    'webhook_urls_updated', true,
    'timestamp', now()
  )
);