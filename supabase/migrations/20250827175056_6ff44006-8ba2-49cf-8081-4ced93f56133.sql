-- ✅ REMOVER OS 3 CRON JOBS PROBLEMÁTICOS PELOS IDs

-- Remover usando os jobids específicos
SELECT cron.unschedule(21); -- process-message-queue-active
SELECT cron.unschedule(20); -- process-pending-messages-manual  
SELECT cron.unschedule(12); -- test-manual-process

-- Log da limpeza final
INSERT INTO public.system_logs (type, source, message, details)
VALUES (
  'info',
  'cron_management',
  '✅ LIMPEZA FINAL CONCLUÍDA: Sistema com apenas 3 jobs necessários',
  jsonb_build_object(
    'removed_jobs_ids', ARRAY[21, 20, 12],
    'remaining_active_jobs', ARRAY['bot-dify-processor', 'cleanup-message-queue', 'monitor-whapi-pending-messages'],
    'system_status', 'LIMPO E OTIMIZADO',
    'timestamp', now()
  )
);