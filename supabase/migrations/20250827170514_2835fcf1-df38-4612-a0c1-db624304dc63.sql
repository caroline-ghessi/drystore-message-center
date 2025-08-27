-- ÚLTIMA TENTATIVA: DESATIVAR JOBS CONFLITANTES
-- Se não conseguimos remover, vamos desativá-los

DO $$
DECLARE
    jobs_desativados INTEGER := 0;
BEGIN
    -- Desativar jobs conflitantes diretamente na tabela
    UPDATE cron.job 
    SET active = false
    WHERE jobname IN (
        'process-message-queue-active',
        'process-pending-messages-manual',
        'test-manual-process'
    );
    
    GET DIAGNOSTICS jobs_desativados = ROW_COUNT;
    
    -- Log do resultado
    INSERT INTO system_logs (type, source, message, details)
    VALUES (
        CASE WHEN jobs_desativados > 0 THEN 'success' ELSE 'warning' END,
        'dify',
        '🔒 JOBS CONFLITANTES DESATIVADOS (última tentativa)',
        jsonb_build_object(
            'jobs_desativados', jobs_desativados,
            'metodo', 'UPDATE active = false',
            'explicacao', 'Se não consegue remover, pelo menos desativar',
            'jobs_alvo', jsonb_build_array(
                'process-message-queue-active',
                'process-pending-messages-manual',
                'test-manual-process'
            ),
            'resultado_esperado', 'Apenas bot-dify-processor deve permanecer processando mensagens',
            'timestamp', now()
        )
    );
    
    -- Status final esperado
    INSERT INTO system_logs (type, source, message, details)
    VALUES (
        'info',
        'dify',
        '🎯 RESULTADO FINAL ESPERADO',
        jsonb_build_object(
            'jobs_ativos_esperados', jsonb_build_array(
                'bot-dify-processor (*/2 * * * *) → dify-process-messages ✅ ÚNICO PROCESSADOR',
                'cleanup-message-queue (0 * * * *) → limpeza diária ✅',
                'monitor-whapi-pending-messages (*/2 * * * *) → monitor apenas ✅'
            ),
            'jobs_desativados', jsonb_build_array(
                'process-message-queue-active → DESATIVADO ❌',
                'process-pending-messages-manual → DESATIVADO ❌',
                'test-manual-process → DESATIVADO ❌'
            ),
            'sistema_status', 'DEVE ESTAR FUNCIONAL AGORA',
            'teste_recomendado', 'Enviar mensagem WhatsApp e aguardar resposta do bot em 2 minutos',
            'timestamp', now()
        )
    );

END $$;