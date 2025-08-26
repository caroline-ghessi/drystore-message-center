-- ELIMINAÇÃO TOTAL DE CRON JOBS DUPLICADOS
-- Remover explicitamente cada job duplicado
SELECT cron.unschedule('process-pending-messages-manual');
SELECT cron.unschedule('process-message-queue-active');

-- Manter apenas o novo job unificado
-- (process-messages-unified-v2 permanece ativo)

-- Log da eliminação final dos duplicados
INSERT INTO public.system_logs (type, source, message, details)
VALUES (
  'info',
  'dify',
  'Cron jobs duplicados eliminados - sistema unificado ativo',
  jsonb_build_object(
    'action', 'final_cleanup',
    'removed_jobs', array['process-pending-messages-manual', 'process-message-queue-active'],
    'active_job', 'process-messages-unified-v2',
    'timestamp', now(),
    'status', 'duplications_eliminated'
  )
);