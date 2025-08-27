-- Remover todos os cron jobs problemáticos de message queue
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname LIKE '%message-queue%' OR command LIKE '%process-message-queue%';

-- Log da limpeza
INSERT INTO public.system_logs (type, source, message, details)
VALUES (
  'info',
  'security',
  'Limpeza forçada de cron jobs duplicados executada',
  jsonb_build_object('timestamp', now(), 'action', 'force_cleanup_crons')
);