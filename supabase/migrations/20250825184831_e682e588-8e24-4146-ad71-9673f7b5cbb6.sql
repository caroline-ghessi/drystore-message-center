-- Atualizar cron jobs para o novo fluxo de transferência automática

-- 1. Remover cron jobs existentes relacionados ao sistema antigo
SELECT cron.unschedule(jobname) 
FROM cron.job 
WHERE jobname IN ('check-inactive-conversations', 'process-lead-evaluation', 'intelligent-transfer-orchestrator');

-- 2. Criar novos cron jobs com frequências corretas

-- Verificar conversas inativas a cada 5 minutos (procura por 40+ min de inatividade)
SELECT cron.schedule(
    'check-inactive-conversations-40min',
    '*/5 * * * *', -- A cada 5 minutos
    $$
    SELECT net.http_post(
        url:='https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/check-inactive-conversations',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb3Fzbm55dHZqYWJnZWFla2t3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjU5NTc4NywiZXhwIjoyMDY4MTcxNzg3fQ.tqnUGUxO9cFBBu7dOYYAGy8b5n4MlLgdNJJvI7ht3HI"}'::jsonb,
        body:='{"auto_run": true}'::jsonb
    ) as request_id;
    $$
);

-- Processar avaliações de leads a cada 2 minutos
SELECT cron.schedule(
    'process-lead-evaluation-ai',
    '*/2 * * * *', -- A cada 2 minutos
    $$
    SELECT net.http_post(
        url:='https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/process-lead-evaluation',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb3Fzbm55dHZqYWJnZWFla2t3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjU5NTc4NywiZXhwIjoyMDY4MTcxNzg3fQ.tqnUGUxO9cFBBu7dOYYAGy8b5n4MlLgdNJJvI7ht3HI"}'::jsonb,
        body:='{"auto_run": true}'::jsonb
    ) as request_id;
    $$
);

-- Processar transferências automáticas a cada 1 minuto
SELECT cron.schedule(
    'process-automatic-transfers',
    '* * * * *', -- A cada 1 minuto
    $$
    SELECT net.http_post(
        url:='https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/process-automatic-transfers',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb3Fzbm55dHZqYWJnZWFla2t3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjU5NTc4NywiZXhwIjoyMDY4MTcxNzg3fQ.tqnUGUxO9cFBBu7dOYYAGy8b5n4MlLgdNJJvI7ht3HI"}'::jsonb,
        body:='{"auto_run": true}'::jsonb
    ) as request_id;
    $$
);

-- Log da configuração
INSERT INTO public.system_logs (type, source, message, details)
VALUES (
  'info',
  'cron_management',
  'Sistema de transferência automática configurado',
  jsonb_build_object(
    'inactivity_check_frequency', '5 minutos',
    'inactivity_threshold', '40 minutos',
    'evaluation_frequency', '2 minutos',
    'transfer_frequency', '1 minuto',
    'timestamp', now()
  )
);