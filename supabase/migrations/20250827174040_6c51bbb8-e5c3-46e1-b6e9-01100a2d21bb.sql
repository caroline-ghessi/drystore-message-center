-- ✅ REMOVER DEFINITIVAMENTE OS 3 CRON JOBS PROBLEMÁTICOS

-- 1. Remover process-message-queue-active (jobid: 21)
SELECT cron.unschedule('process-message-queue-active');

-- 2. Remover process-pending-messages-manual (jobid: 20)  
SELECT cron.unschedule('process-pending-messages-manual');

-- 3. Remover test-manual-process (jobid: 12)
SELECT cron.unschedule('test-manual-process');

-- Log da limpeza final
INSERT INTO public.system_logs (type, source, message, details)
VALUES (
  'info',
  'cron_management', 
  'Limpeza final: 3 cron jobs problemáticos removidos definitivamente',
  jsonb_build_object(
    'removed_jobs', ARRAY['process-message-queue-active', 'process-pending-messages-manual', 'test-manual-process'],
    'remaining_jobs', ARRAY['bot-dify-processor', 'cleanup-message-queue', 'monitor-whapi-pending-messages'],
    'timestamp', now()
  )
);