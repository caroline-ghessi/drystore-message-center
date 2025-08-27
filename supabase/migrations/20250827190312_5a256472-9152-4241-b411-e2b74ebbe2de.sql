-- Limpar todos os cron jobs existentes para evitar conflitos
DO $$
DECLARE
    job_record record;
BEGIN
    -- Listar e remover todos os cron jobs existentes
    FOR job_record IN 
        SELECT jobid, jobname, command 
        FROM cron.job 
    LOOP
        PERFORM cron.unschedule(job_record.jobid);
        
        -- Log da remoção
        INSERT INTO public.system_logs (type, source, message, details)
        VALUES (
            'info',
            'cron_management',
            'Cron job removido: ' || COALESCE(job_record.jobname, 'unnamed'),
            jsonb_build_object(
                'job_id', job_record.jobid,
                'job_name', job_record.jobname,
                'command', job_record.command,
                'removed_at', now()
            )
        );
    END LOOP;
END $$;

-- Criar apenas os cron jobs necessários
-- 1. Bot Dify Processor (a cada 2 minutos)
SELECT cron.schedule(
    'bot-dify-processor',
    '*/2 * * * *',
    $$
    SELECT net.http_post(
        url := 'https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/bot-dify-processor',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb3Fzbm55dHZqYWJnZWFla2t3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjU5NTc4NywiZXhwIjoyMDY4MTcxNzg3fQ.tqnUGUxO9cFBBu7dOYYAGy8b5n4MlLgdNJJvI7ht3HI"}',
        body := '{"auto_run": true}'
    ) AS request_id;
    $$
);

-- 2. Cleanup Message Queue (a cada hora)
SELECT cron.schedule(
    'cleanup-message-queue',
    '0 * * * *',
    $$
    SELECT public.cleanup_message_queue();
    $$
);

-- Log da criação dos novos cron jobs
INSERT INTO public.system_logs (type, source, message, details)
VALUES (
    'info',
    'cron_management',
    'Cron jobs limpos e reconfigurados',
    jsonb_build_object(
        'active_jobs', array['bot-dify-processor', 'cleanup-message-queue'],
        'bot_processor_schedule', '*/2 * * * *',
        'cleanup_schedule', '0 * * * *',
        'timestamp', now()
    )
);