-- 1. RESETAR MENSAGENS TRAVADAS PRIMEIRO
-- Resetar mensagens com scheduled_for futuro para processamento imediato
UPDATE message_queue 
SET scheduled_for = now() - interval '1 minute'
WHERE status = 'waiting' AND scheduled_for > now();

-- 2. LIMPAR CRON JOBS DE FORMA DEFENSIVA
-- Remover cron jobs que existem, ignorando erros se não existir
DO $$
DECLARE
    job_record RECORD;
    job_names TEXT[] := ARRAY[
        'process-message-queue-active',
        'process-messages-unified-final', 
        'process-pending-messages-manual',
        'test-manual-process',
        'process-message-queue-fixed'
    ];
    job_name TEXT;
BEGIN
    -- Tentar remover jobs por nome (pode não existir)
    FOREACH job_name IN ARRAY job_names LOOP
        BEGIN
            PERFORM cron.unschedule(job_name);
            INSERT INTO system_logs (type, source, message, details)
            VALUES (
                'info',
                'cron_management',
                'Cron job removido: ' || job_name,
                jsonb_build_object('job_name', job_name, 'timestamp', now())
            );
        EXCEPTION 
            WHEN OTHERS THEN
                -- Ignorar erro se job não existir
                NULL;
        END;
    END LOOP;
    
    -- Remover qualquer outro job relacionado por padrão de comando
    FOR job_record IN 
        SELECT jobid, jobname FROM cron.job 
        WHERE command LIKE '%process-pending-messages%' 
           OR command LIKE '%manual-process-queue%'
           OR command LIKE '%process-message-queue%'
    LOOP
        BEGIN
            PERFORM cron.unschedule(job_record.jobid);
            INSERT INTO system_logs (type, source, message, details)
            VALUES (
                'info',
                'cron_management',
                'Cron job removido por padrão: ' || job_record.jobname,
                jsonb_build_object('job_id', job_record.jobid, 'job_name', job_record.jobname, 'timestamp', now())
            );
        EXCEPTION 
            WHEN OTHERS THEN
                -- Ignorar erro se job não existir
                NULL;
        END;
    END LOOP;
END $$;

-- 3. CRIAR CRON JOB CORRETO PARA DIFY-PROCESS-MESSAGES
-- Primeiro remover se já existir
DO $$
BEGIN
    PERFORM cron.unschedule('dify-process-messages-auto');
EXCEPTION 
    WHEN OTHERS THEN
        -- Ignorar se não existir
        NULL;
END $$;

-- Criar novo cron job
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
    'Correção do bot automático implementada com sucesso',
    jsonb_build_object(
        'actions', jsonb_build_array(
            'Mensagens travadas resetadas',
            'Cron jobs limpos de forma defensiva',
            'Cron job correto criado: dify-process-messages-auto',
            'Frequência: a cada minuto'
        ),
        'cron_schedule', '* * * * *',
        'function_target', 'dify-process-messages',
        'timestamp', now()
    )
);