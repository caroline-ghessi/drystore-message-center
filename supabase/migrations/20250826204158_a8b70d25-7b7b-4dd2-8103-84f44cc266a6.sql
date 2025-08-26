-- Consolidar conversas específicas da Nexus Construtora
WITH nexus_conversations AS (
  SELECT 
    id,
    customer_name,
    phone_number,
    created_at,
    ROW_NUMBER() OVER (PARTITION BY phone_number ORDER BY created_at ASC) as rn
  FROM conversations 
  WHERE customer_name = 'Nexus Construtora' AND phone_number = '554896481624'
),
main_conversation AS (
  SELECT id as main_id FROM nexus_conversations WHERE rn = 1
),
duplicate_conversations AS (
  SELECT id as dup_id FROM nexus_conversations WHERE rn > 1
)
-- Mover mensagens das conversas duplicadas para a principal
UPDATE messages 
SET conversation_id = (SELECT main_id FROM main_conversation)
WHERE conversation_id IN (SELECT dup_id FROM duplicate_conversations);

-- Mover queue items das conversas duplicadas para a principal  
WITH nexus_conversations AS (
  SELECT 
    id,
    customer_name,
    phone_number,
    created_at,
    ROW_NUMBER() OVER (PARTITION BY phone_number ORDER BY created_at ASC) as rn
  FROM conversations 
  WHERE customer_name = 'Nexus Construtora' AND phone_number = '554896481624'
),
main_conversation AS (
  SELECT id as main_id FROM nexus_conversations WHERE rn = 1
),
duplicate_conversations AS (
  SELECT id as dup_id FROM nexus_conversations WHERE rn > 1
)
UPDATE message_queue 
SET conversation_id = (SELECT main_id FROM main_conversation)
WHERE conversation_id IN (SELECT dup_id FROM duplicate_conversations);

-- Remover conversas duplicadas da Nexus Construtora
WITH nexus_conversations AS (
  SELECT 
    id,
    customer_name,
    phone_number,
    created_at,
    ROW_NUMBER() OVER (PARTITION BY phone_number ORDER BY created_at ASC) as rn
  FROM conversations 
  WHERE customer_name = 'Nexus Construtora' AND phone_number = '554896481624'
),
duplicate_conversations AS (
  SELECT id as dup_id FROM nexus_conversations WHERE rn > 1
)
DELETE FROM conversations 
WHERE id IN (SELECT dup_id FROM duplicate_conversations);

-- Resetar conversa principal da Nexus para bot_attending
UPDATE conversations 
SET 
  status = 'bot_attending',
  fallback_mode = false,
  fallback_taken_by = NULL,
  updated_at = now()
WHERE customer_name = 'Nexus Construtora' 
  AND phone_number = '554896481624';