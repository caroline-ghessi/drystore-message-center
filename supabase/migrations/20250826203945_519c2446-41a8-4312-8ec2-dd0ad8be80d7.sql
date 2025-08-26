-- Limpar mensagens antigas da fila (mais de 30 minutos)
DELETE FROM message_queue 
WHERE status = 'waiting' 
  AND created_at < now() - interval '30 minutes';

-- Resetar mensagens pendentes recentes para reprocessamento
UPDATE message_queue 
SET scheduled_for = now() + interval '10 seconds'
WHERE status = 'waiting' 
  AND created_at >= now() - interval '30 minutes';