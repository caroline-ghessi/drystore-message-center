-- FASE 4: REMOVER CRON JOBS CONFLITANTES RESTANTES
-- Ainda há jobs duplicados que podem causar conflito

-- Log início da limpeza final
INSERT INTO system_logs (type, source, message, details)
VALUES (
    'warning',
    'dify',
    'FASE 4: Removendo cron jobs conflitantes restantes',
    jsonb_build_object(
        'remaining_jobs', jsonb_build_array(
            'process-message-queue-active',
            'process-messages-unified-final', 
            'process-pending-messages-manual',
            'test-manual-process'
        ),
        'action', 'final_cleanup',
        'timestamp', now()
    )
);

-- Remover jobs conflitantes restantes
DO $$
DECLARE
    remaining_jobs TEXT[] := ARRAY[
        'process-message-queue-active',
        'process-messages-unified-final', 
        'process-pending-messages-manual',
        'test-manual-process'
    ];
    job_name TEXT;
    removed_count INTEGER := 0;
BEGIN
    FOREACH job_name IN ARRAY remaining_jobs LOOP
        BEGIN
            PERFORM cron.unschedule(job_name);
            removed_count := removed_count + 1;
            
            INSERT INTO system_logs (type, source, message, details)
            VALUES (
                'info',
                'dify',
                'Cron job conflitante final removido: ' || job_name,
                jsonb_build_object(
                    'job_name', job_name,
                    'final_cleanup', true,
                    'timestamp', now()
                )
            );
        EXCEPTION 
            WHEN OTHERS THEN
                INSERT INTO system_logs (type, source, message, details)
                VALUES (
                    'warning',
                    'dify',
                    'Job final não encontrado: ' || job_name,
                    jsonb_build_object('job_name', job_name, 'timestamp', now())
                );
        END;
    END LOOP;
    
    -- Log da limpeza final
    INSERT INTO system_logs (type, source, message, details)
    VALUES (
        'success',
        'dify',
        'LIMPEZA FINAL COMPLETA: Sistema unificado definitivo',
        jsonb_build_object(
            'removed_final_count', removed_count,
            'remaining_jobs', jsonb_build_array(
                'bot-dify-processor (ATIVO - a cada 2 min)',
                'cleanup-message-queue (utility)',
                'monitor-whapi-pending-messages (monitor)',
                'process-automatic-transfers (transfers)'
            ),
            'status', 'Sistema pronto para funcionar automaticamente',
            'next_test', 'Aguardar 2-3 minutos e testar com nova mensagem',
            'timestamp', now()
        )
    );
END $$;