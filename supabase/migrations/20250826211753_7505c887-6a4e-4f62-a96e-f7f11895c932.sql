-- ELIMINAÇÃO MANUAL E DEFINITIVA DOS CRON JOBS DUPLICADOS
SELECT cron.unschedule('process-pending-messages-manual');
SELECT cron.unschedule('process-message-queue-active');

-- Verificação e log
INSERT INTO public.system_logs (type, source, message, details)
VALUES (
  'info',
  'dify',
  'Eliminação manual definitiva dos cron jobs duplicados',
  jsonb_build_object(
    'removed_jobs', array['process-pending-messages-manual', 'process-message-queue-active'],
    'remaining_job', 'process-messages-unified-final',
    'timestamp', now(),
    'status', 'manual_cleanup_executed'
  )
);