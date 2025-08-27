-- REMOÇÃO FORÇADA DOS JOBS CONFLITANTES RESTANTES
-- Jobs que resistiram à limpeza anterior

DO $$
BEGIN
    -- Tentar remover process-message-queue-active de forma direta
    BEGIN
        DELETE FROM cron.job WHERE jobname = 'process-message-queue-active';
        INSERT INTO system_logs (type, source, message, details)
        VALUES ('success', 'dify', '🗑️ FORÇADO: Removido process-message-queue-active via DELETE', '{}');
    EXCEPTION WHEN OTHERS THEN
        BEGIN
            PERFORM cron.unschedule('process-message-queue-active');
            INSERT INTO system_logs (type, source, message, details)
            VALUES ('success', 'dify', '🗑️ FORÇADO: Removido process-message-queue-active via unschedule', '{}');
        EXCEPTION WHEN OTHERS THEN
            INSERT INTO system_logs (type, source, message, details)
            VALUES ('error', 'dify', '❌ FALHOU: Não conseguiu remover process-message-queue-active', 
                   jsonb_build_object('error', SQLERRM));
        END;
    END;

    -- Tentar remover process-pending-messages-manual de forma direta
    BEGIN
        DELETE FROM cron.job WHERE jobname = 'process-pending-messages-manual';
        INSERT INTO system_logs (type, source, message, details)
        VALUES ('success', 'dify', '🗑️ FORÇADO: Removido process-pending-messages-manual via DELETE', '{}');
    EXCEPTION WHEN OTHERS THEN
        BEGIN
            PERFORM cron.unschedule('process-pending-messages-manual');
            INSERT INTO system_logs (type, source, message, details)
            VALUES ('success', 'dify', '🗑️ FORÇADO: Removido process-pending-messages-manual via unschedule', '{}');
        EXCEPTION WHEN OTHERS THEN
            INSERT INTO system_logs (type, source, message, details)
            VALUES ('error', 'dify', '❌ FALHOU: Não conseguiu remover process-pending-messages-manual', 
                   jsonb_build_object('error', SQLERRM));
        END;
    END;

    -- Tentar remover test-manual-process de forma direta
    BEGIN
        DELETE FROM cron.job WHERE jobname = 'test-manual-process';
        INSERT INTO system_logs (type, source, message, details)
        VALUES ('success', 'dify', '🗑️ FORÇADO: Removido test-manual-process via DELETE', '{}');
    EXCEPTION WHEN OTHERS THEN
        BEGIN
            PERFORM cron.unschedule('test-manual-process');
            INSERT INTO system_logs (type, source, message, details)
            VALUES ('success', 'dify', '🗑️ FORÇADO: Removido test-manual-process via unschedule', '{}');
        EXCEPTION WHEN OTHERS THEN
            INSERT INTO system_logs (type, source, message, details)
            VALUES ('error', 'dify', '❌ FALHOU: Não conseguiu remover test-manual-process', 
                   jsonb_build_object('error', SQLERRM));
        END;
    END;

    -- Log final da tentativa de remoção forçada
    INSERT INTO system_logs (type, source, message, details)
    VALUES (
        'info',
        'dify',
        '⚡ TENTATIVA DE REMOÇÃO FORÇADA CONCLUÍDA',
        jsonb_build_object(
            'metodo', 'DELETE direto na tabela cron.job + fallback unschedule',
            'jobs_alvo', jsonb_build_array(
                'process-message-queue-active',
                'process-pending-messages-manual',
                'test-manual-process'
            ),
            'verificacao_necessaria', true,
            'timestamp', now()
        )
    );

END $$;