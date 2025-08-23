-- Corrigir mensagem da Caroline com source válido
UPDATE message_queue 
SET status = 'sent', processed_at = now()
WHERE id IN (
  SELECT mq.id
  FROM message_queue mq
  JOIN conversations c ON mq.conversation_id = c.id
  WHERE c.customer_name = 'Caroline Ghessi' 
    AND mq.status = 'waiting'
    AND c.status = 'bot_attending'
    AND c.fallback_mode = false
);

-- Inserir resposta do bot para Caroline com source meta
INSERT INTO messages (
  conversation_id,
  sender_type,
  sender_name,
  content,
  message_type,
  delivery_status,
  message_source
)
SELECT 
  c.id,
  'bot',
  'Drystore Bot',
  'Olá Caroline! Vi que você está interessada em pisos. Temos várias opções disponíveis. Que tipo de piso você está procurando?',
  'text',
  'sent',
  'meta'
FROM conversations c 
WHERE c.customer_name = 'Caroline Ghessi' 
  AND c.status = 'bot_attending'
  AND c.fallback_mode = false
  AND NOT EXISTS (
    SELECT 1 FROM messages m 
    WHERE m.conversation_id = c.id 
      AND m.sender_type = 'bot' 
      AND m.content LIKE 'Olá Caroline!%'
  );

-- Remover mensagens de conversas inválidas
DELETE FROM message_queue 
WHERE conversation_id IN (
  SELECT id FROM conversations 
  WHERE fallback_mode = true OR status = 'sent_to_seller'
);