-- PLANO DEFINITIVO: RESOLVER CONFLITO DE CRON JOBS DE VEZ
-- FASE 1: LIMPEZA RADICAL DE TODOS OS CRON JOBS CONFLITANTES

-- Log início da operação
INSERT INTO system_logs (type, source, message, details)
VALUES (
    'info',
    'dify',
    'INICIANDO PLANO DEFINITIVO: Limpeza radical de cron jobs',
    jsonb_build_object(
        'action', 'cleanup_all_conflicting_jobs',
        'timestamp', now()
    )
);

-- Remover TODOS os cron jobs de processamento conflitantes
DO $$
DECLARE
    conflicting_jobs TEXT[] := ARRAY[
        'dify-process-messages-auto',
        'process-message-queue-fixed', 
        'process-pending-messages-auto',
        'process-dify-messages-30s',
        'process-message-queue-v2',
        'invoke-function-every-minute'
    ];
    job_name TEXT;
    removed_count INTEGER := 0;
BEGIN
    -- Tentar remover cada job conflitante
    FOREACH job_name IN ARRAY conflicting_jobs LOOP
        BEGIN
            PERFORM cron.unschedule(job_name);
            removed_count := removed_count + 1;
            
            INSERT INTO system_logs (type, source, message, details)
            VALUES (
                'info',
                'dify',
                'Cron job conflitante removido: ' || job_name,
                jsonb_build_object(
                    'job_name', job_name,
                    'removal_order', removed_count,
                    'timestamp', now()
                )
            );
        EXCEPTION 
            WHEN OTHERS THEN
                INSERT INTO system_logs (type, source, message, details)
                VALUES (
                    'warning',
                    'dify',
                    'Job não encontrado (já removido): ' || job_name,
                    jsonb_build_object('job_name', job_name, 'timestamp', now())
                );
        END;
    END LOOP;
    
    -- Log total de jobs removidos
    INSERT INTO system_logs (type, source, message, details)
    VALUES (
        'info',
        'dify',
        'FASE 1 COMPLETA: ' || removed_count || ' cron jobs conflitantes removidos',
        jsonb_build_object(
            'removed_count', removed_count,
            'phase', 'cleanup_complete',
            'timestamp', now()
        )
    );
END $$;

-- FASE 2: CRIAR ÚNICO CRON JOB CORRETO
DO $$
DECLARE
    service_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb3Fzbm55dHZqYWJnZWFla2t3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjU5NTc4NywiZXhwIjoyMDY4MTcxNzg3fQ.tqnUGUxO9cFBBu7dOYYAGy8b5n4MlLgdNJJvI7ht3HI';
    job_command TEXT;
BEGIN
    -- Criar comando do único cron job
    job_command := 'SELECT net.http_post(' ||
        'url := ''https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/process-pending-messages'', ' ||
        'headers := ''{"Content-Type": "application/json", "Authorization": "Bearer ' || service_key || '"}'', ' ||  
        'body := ''{"auto_run": true, "source": "cron_job_unified"}'') AS request_id;';

    -- Criar o único cron job definitivo
    PERFORM cron.schedule(
        'bot-dify-processor',
        '*/2 * * * *', -- A cada 2 minutos
        job_command
    );
    
    INSERT INTO system_logs (type, source, message, details)
    VALUES (
        'info',
        'dify',
        'FASE 2 COMPLETA: Único cron job criado - bot-dify-processor',
        jsonb_build_object(
            'job_name', 'bot-dify-processor',
            'schedule', '*/2 * * * * (every 2 minutes)',
            'function_called', 'process-pending-messages',
            'phase', 'unified_job_created',
            'timestamp', now()
        )
    );
END $$;

-- Log final do plano definitivo
INSERT INTO system_logs (type, source, message, details)
VALUES (
    'success',
    'dify',
    'PLANO DEFINITIVO IMPLEMENTADO: Sistema de cron jobs unificado',
    jsonb_build_object(
        'actions_completed', jsonb_build_array(
            'Todos os cron jobs conflitantes removidos',
            'Único cron job bot-dify-processor criado',
            'Sistema pronto para processar mensagens automaticamente'
        ),
        'next_phase', 'Processar backlog de 25 mensagens manualmente',
        'expected_result', 'Bot Dify funcionando automaticamente em 5-10 minutos',
        'cron_schedule', 'A cada 2 minutos',
        'timestamp', now()
    )
);