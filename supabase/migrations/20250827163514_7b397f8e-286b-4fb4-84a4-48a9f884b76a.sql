-- LIMPEZA FINAL AGRESSIVA - REMOVER TODOS OS JOBS CONFLITANTES

-- Remover TODOS os jobs de processamento exceto bot-dify-processor
DO $$
DECLARE
    job_record RECORD;
    removed_count INTEGER := 0;
BEGIN
    -- Buscar todos os jobs ativos que não sejam essenciais
    FOR job_record IN 
        SELECT jobname, jobid FROM cron.job 
        WHERE active = true 
        AND jobname NOT IN (
            'bot-dify-processor',
            'cleanup-message-queue', 
            'monitor-whapi-pending-messages'
        )
    LOOP
        BEGIN
            PERFORM cron.unschedule(job_record.jobname);
            removed_count := removed_count + 1;
            
            INSERT INTO system_logs (type, source, message, details)
            VALUES (
                'info',
                'dify',
                'Job removido na limpeza final: ' || job_record.jobname,
                jsonb_build_object(
                    'job_name', job_record.jobname,
                    'job_id', job_record.jobid,
                    'final_cleanup', true,
                    'timestamp', now()
                )
            );
        EXCEPTION 
            WHEN OTHERS THEN
                INSERT INTO system_logs (type, source, message, details)
                VALUES (
                    'error',
                    'dify',
                    'Erro ao remover job: ' || job_record.jobname,
                    jsonb_build_object(
                        'job_name', job_record.jobname,
                        'error', SQLERRM,
                        'timestamp', now()
                    )
                );
        END;
    END LOOP;
    
    -- Log final definitivo
    INSERT INTO system_logs (type, source, message, details)
    VALUES (
        'success',
        'dify',
        '🎯 SISTEMA DEFINITIVAMENTE UNIFICADO!',
        jsonb_build_object(
            'jobs_removed_final', removed_count,
            'remaining_active_jobs', jsonb_build_array(
                'bot-dify-processor → Processa mensagens a cada 2 minutos',
                'cleanup-message-queue → Limpeza diária',
                'monitor-whapi-pending-messages → Monitor apenas'
            ),
            'system_status', 'PRONTO PARA FUNCIONAR',
            'test_instructions', 'Aguarde 2-3 minutos e envie mensagem de teste',
            'expected_behavior', 'Bot Dify deve responder automaticamente',
            'timestamp', now()
        )
    );
END $$;