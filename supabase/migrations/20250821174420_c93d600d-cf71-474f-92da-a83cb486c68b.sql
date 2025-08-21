-- Correção Imediata: Limpar fila de mensagens problemáticas para parar o loop infinito
-- Marcar todas as mensagens antigas em 'waiting' como 'failed' (valores permitidos pelo constraint)
UPDATE public.message_queue 
SET status = 'failed', 
    processed_at = now()
WHERE status = 'waiting' 
  AND created_at < now() - interval '10 minutes';

-- Adicionar colunas para controle de retry
ALTER TABLE public.message_queue 
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS last_error TEXT;

-- Reduzir tempo de agrupamento padrão para 15 segundos
UPDATE public.message_queue 
SET scheduled_for = created_at + interval '15 seconds'
WHERE status = 'waiting' 
  AND scheduled_for > created_at + interval '30 seconds';