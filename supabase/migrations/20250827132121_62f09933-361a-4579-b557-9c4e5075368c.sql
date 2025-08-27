-- 1. LIMPAR CRON JOBS INCORRETOS
-- Remover todos os cron jobs que chamam funções erradas
SELECT cron.unschedule('process-message-queue-active');
SELECT cron.unschedule('process-messages-unified-final');
SELECT cron.unschedule('process-pending-messages-manual');
SELECT cron.unschedule('test-manual-process');
SELECT cron.unschedule('process-message-queue-fixed');

-- Remover qualquer outro cron job relacionado a processamento de mensagens
DO $$
DECLARE
    job_record RECORD;
BEGIN
    FOR job_record IN 
        SELECT jobid, jobname FROM cron.job 
        WHERE command LIKE '%process-pending-messages%' 
           OR command LIKE '%manual-process-queue%'
           OR command LIKE '%process-message-queue%'
    LOOP
        PERFORM cron.unschedule(job_record.jobid);
        INSERT INTO system_logs (type, source, message, details)
        VALUES (
            'info',
            'cron_management',
            'Cron job removido: ' || job_record.jobname,
            jsonb_build_object('job_id', job_record.jobid, 'timestamp', now())
        );
    END LOOP;
END $$;

-- 2. RESETAR MENSAGENS TRAVADAS
-- Resetar mensagens com scheduled_for futuro para processamento imediato
UPDATE message_queue 
SET scheduled_for = now() - interval '1 minute'
WHERE status = 'waiting' AND scheduled_for > now();

-- 3. CRIAR CRON JOB CORRETO PARA DIFY-PROCESS-MESSAGES
-- Criar cron job que chama a função correta a cada 1 minuto
SELECT cron.schedule(
    'dify-process-messages-auto',
    '* * * * *', -- A cada minuto
    $$
    SELECT net.http_post(
        url := 'https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/dify-process-messages',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb3Fzbm55dHZqYWJnZWFla2t3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjU5NTc4NywiZXhwIjoyMDY4MTcxNzg3fQ.tqnUGUxO9cFBBu7dOYYAGy8b5n4MlLgdNJJvI7ht3HI"}',
        body := '{"auto_run": true}'
    ) as request_id;
    $$
);

-- 4. LOG DA IMPLEMENTAÇÃO
INSERT INTO system_logs (type, source, message, details)
VALUES (
    'info',
    'bot_automation',
    'Plano de correção do bot automático implementado',
    jsonb_build_object(
        'actions', jsonb_build_array(
            'Cron jobs incorretos removidos',
            'Mensagens travadas resetadas',
            'Cron job correto criado para dify-process-messages',
            'Configuração automática ativada'
        ),
        'cron_schedule', '* * * * *',
        'function_target', 'dify-process-messages',
        'timestamp', now()
    )
);