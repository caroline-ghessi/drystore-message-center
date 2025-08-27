-- CORREÇÃO COMPLETA DO SISTEMA DE BOT AUTOMÁTICO

-- 1. Eliminar cron jobs duplicados definitivamente
DO $$
BEGIN
  -- Tentar remover os jobs antigos (se existirem)
  BEGIN
    PERFORM cron.unschedule('process-pending-messages-manual');
  EXCEPTION WHEN others THEN
    NULL; -- Ignora se não existir
  END;
  
  BEGIN
    PERFORM cron.unschedule('process-message-queue-active');
  EXCEPTION WHEN others THEN
    NULL; -- Ignora se não existir
  END;
END $$;

-- 2. Corrigir status das conversas travadas
UPDATE public.conversations 
SET 
  status = 'bot_attending',
  updated_at = now()
WHERE status = 'waiting_evaluation' AND fallback_mode = false;

-- 3. Resetar mensagens travadas na fila para reprocessamento
UPDATE public.message_queue 
SET 
  status = 'waiting',
  processed_at = NULL,
  scheduled_for = now()
WHERE status = 'waiting' AND created_at < now() - interval '10 minutes';

-- 4. Garantir que conversas ativas estejam no status correto
UPDATE public.conversations
SET status = 'bot_attending'
WHERE status IN ('active', 'new') AND fallback_mode = false;

-- 5. Log das correções
INSERT INTO public.system_logs (type, source, message, details)
VALUES (
  'info',
  'dify',
  'Sistema de bot automático corrigido',
  jsonb_build_object(
    'cron_jobs_removed', array['process-pending-messages-manual', 'process-message-queue-active'],
    'conversations_fixed', (SELECT COUNT(*) FROM public.conversations WHERE status = 'bot_attending' AND fallback_mode = false),
    'messages_reset', (SELECT COUNT(*) FROM public.message_queue WHERE status = 'waiting'),
    'timestamp', now(),
    'action', 'full_system_fix'
  )
);