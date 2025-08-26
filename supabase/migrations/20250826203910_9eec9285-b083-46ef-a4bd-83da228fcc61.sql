-- Consolidar conversas duplicadas por cliente
WITH duplicates AS (
  SELECT 
    customer_name, 
    phone_number,
    array_agg(id ORDER BY created_at) as conversation_ids
  FROM conversations 
  WHERE customer_name IS NOT NULL 
  GROUP BY customer_name, phone_number 
  HAVING COUNT(*) > 1
),
conversations_to_keep AS (
  SELECT 
    customer_name,
    phone_number,
    conversation_ids[1] as main_conversation_id,
    conversation_ids[2:] as conversations_to_merge
  FROM duplicates
)
UPDATE conversations 
SET 
  customer_name = COALESCE(conversations.customer_name, ctk.customer_name),
  updated_at = now()
FROM conversations_to_keep ctk
WHERE conversations.id = ctk.main_conversation_id;

-- Mover mensagens das conversas duplicadas para a principal
WITH duplicates AS (
  SELECT 
    customer_name, 
    phone_number,
    array_agg(id ORDER BY created_at) as conversation_ids
  FROM conversations 
  WHERE customer_name IS NOT NULL 
  GROUP BY customer_name, phone_number 
  HAVING COUNT(*) > 1
),
conversations_to_keep AS (
  SELECT 
    customer_name,
    phone_number,
    conversation_ids[1] as main_conversation_id,
    unnest(conversation_ids[2:]) as conversation_to_merge
  FROM duplicates
)
UPDATE messages 
SET conversation_id = ctk.main_conversation_id
FROM conversations_to_keep ctk
WHERE messages.conversation_id = ctk.conversation_to_merge;

-- Mover leads das conversas duplicadas para a principal
WITH duplicates AS (
  SELECT 
    customer_name, 
    phone_number,
    array_agg(id ORDER BY created_at) as conversation_ids
  FROM conversations 
  WHERE customer_name IS NOT NULL 
  GROUP BY customer_name, phone_number 
  HAVING COUNT(*) > 1
),
conversations_to_keep AS (
  SELECT 
    conversation_ids[1] as main_conversation_id,
    unnest(conversation_ids[2:]) as conversation_to_merge
  FROM duplicates
)
UPDATE leads 
SET conversation_id = ctk.main_conversation_id
FROM conversations_to_keep ctk
WHERE leads.conversation_id = ctk.conversation_to_merge;

-- Remover conversas duplicadas vazias
WITH duplicates AS (
  SELECT 
    customer_name, 
    phone_number,
    array_agg(id ORDER BY created_at) as conversation_ids
  FROM conversations 
  WHERE customer_name IS NOT NULL 
  GROUP BY customer_name, phone_number 
  HAVING COUNT(*) > 1
),
conversations_to_delete AS (
  SELECT unnest(conversation_ids[2:]) as conversation_id
  FROM duplicates
)
DELETE FROM conversations 
WHERE id IN (SELECT conversation_id FROM conversations_to_delete);

-- Processar mensagens pendentes na fila que estão aguardando há mais de 5 minutos
UPDATE message_queue 
SET status = 'error', 
    processed_at = now(),
    last_error = 'Timeout - mensagem muito antiga'
WHERE status = 'waiting' 
  AND created_at < now() - interval '5 minutes';