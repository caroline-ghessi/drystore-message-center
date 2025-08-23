-- Criar função para processar mensagem da Caroline diretamente
CREATE OR REPLACE FUNCTION public.process_caroline_message()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  caroline_queue_id uuid;
  caroline_conversation_id uuid;
  caroline_messages text[];
  result jsonb;
BEGIN
  -- Buscar mensagem da Caroline
  SELECT mq.id, mq.conversation_id, mq.messages_content
  INTO caroline_queue_id, caroline_conversation_id, caroline_messages
  FROM message_queue mq
  JOIN conversations c ON mq.conversation_id = c.id
  WHERE c.customer_name = 'Caroline Ghessi' 
    AND mq.status = 'waiting'
    AND c.status = 'bot_attending'
    AND c.fallback_mode = false
  LIMIT 1;

  IF caroline_queue_id IS NOT NULL THEN
    -- Marcar mensagem como processada
    UPDATE message_queue 
    SET status = 'processed', processed_at = now()
    WHERE id = caroline_queue_id;

    -- Inserir resposta do bot (simulada para teste)
    INSERT INTO messages (
      conversation_id,
      sender_type,
      sender_name,
      content,
      message_type,
      delivery_status,
      message_source
    ) VALUES (
      caroline_conversation_id,
      'bot',
      'Drystore Bot',
      'Olá Caroline! Vi que você está interessada em pisos. Temos várias opções disponíveis. Que tipo de piso você está procurando?',
      'text',
      'sent',
      'dify'
    );

    result := jsonb_build_object(
      'success', true,
      'caroline_processed', true,
      'queue_id', caroline_queue_id,
      'conversation_id', caroline_conversation_id,
      'messages', caroline_messages
    );
  ELSE
    result := jsonb_build_object(
      'success', false,
      'caroline_processed', false,
      'message', 'Mensagem da Caroline não encontrada ou já processada'
    );
  END IF;

  -- Log do resultado
  INSERT INTO system_logs (type, source, message, details)
  VALUES (
    'info',
    'caroline_processing',
    'Processamento manual da mensagem da Caroline',
    result
  );

  RETURN result;
END;
$function$;

-- Criar função para limpar fila de mensagens inválidas
CREATE OR REPLACE FUNCTION public.cleanup_invalid_queue_messages()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  deleted_count integer := 0;
  result jsonb;
BEGIN
  -- Remover mensagens de conversas em fallback_mode ou sent_to_seller
  DELETE FROM message_queue 
  WHERE conversation_id IN (
    SELECT id FROM conversations 
    WHERE fallback_mode = true OR status = 'sent_to_seller'
  );
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  result := jsonb_build_object(
    'success', true,
    'deleted_count', deleted_count,
    'message', 'Mensagens inválidas removidas da fila'
  );

  -- Log do resultado
  INSERT INTO system_logs (type, source, message, details)
  VALUES (
    'info',
    'queue_cleanup',
    'Limpeza de mensagens inválidas da fila',
    result
  );

  RETURN result;
END;
$function$;