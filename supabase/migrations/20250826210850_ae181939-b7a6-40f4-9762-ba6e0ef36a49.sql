-- Passo 1: Remover TODOS os cron jobs conflitantes
SELECT cron.unschedule(jobname) FROM cron.job WHERE command LIKE '%process%message%';

-- Passo 2: Criar apenas UM cron job otimizado (a cada 5 minutos)
SELECT cron.schedule(
  'process-messages-unified',
  '*/5 * * * *', -- A cada 5 minutos
  $$
  SELECT net.http_post(
    url := 'https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/process-pending-messages',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb3Fzbm55dHZqYWJnZWFla2t3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjU5NTc4NywiZXhwIjoyMDY4MTcxNzg3fQ.tqnUGUxO9cFBBu7dOYYAGy8b5n4MlLgdNJJvI7ht3HI"}'::jsonb,
    body := '{"auto_run": true}'::jsonb
  ) as request_id;
  $$
);

-- Passo 3: Log da reorganização
INSERT INTO public.system_logs (type, source, message, details)
VALUES (
  'info',
  'cron_management',
  'Cron jobs reorganizados - eliminadas duplicações',
  jsonb_build_object(
    'old_jobs_removed', true,
    'new_unified_job', 'process-messages-unified',
    'interval', '5 minutes',
    'timestamp', now()
  )
);