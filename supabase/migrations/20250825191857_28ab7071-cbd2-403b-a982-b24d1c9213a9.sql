-- Adicionar tipo 'reaction' ao enum message_type
ALTER TYPE message_type ADD VALUE IF NOT EXISTS 'reaction';

-- Log da adição do suporte a reações
INSERT INTO public.system_logs (type, source, message, details)
VALUES (
  'info',
  'whapi',
  'Suporte a reações do WhatsApp adicionado',
  jsonb_build_object(
    'new_message_type', 'reaction',
    'feature', 'whatsapp_reactions',
    'timestamp', now()
  )
);