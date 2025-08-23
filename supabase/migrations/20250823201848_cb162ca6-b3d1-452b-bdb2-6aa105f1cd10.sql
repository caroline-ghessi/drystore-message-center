-- FASE 1: Resolver problema da constraint de auditoria
-- Modificar a constraint para permitir user_id NULL ou usar um usuário do sistema válido

-- Primeiro, vamos criar uma entrada para o usuário do sistema na tabela auth.users
-- Como não podemos modificar diretamente auth.users, vamos alterar a constraint

-- Modificar o trigger de auditoria para não tentar inserir user_id inválido
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id UUID;
BEGIN
  -- Use auth.uid() se disponível, caso contrário use NULL
  current_user_id := auth.uid();
  
  -- Se o auth.uid() retornar o ID do sistema inválido, usar NULL
  IF current_user_id = '00000000-0000-0000-0000-000000000000' THEN
    current_user_id := NULL;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_values)
    VALUES (current_user_id, TG_OP, TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_values, new_values)
    VALUES (current_user_id, TG_OP, TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_values)
    VALUES (current_user_id, TG_OP, TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$;

-- Alterar a coluna user_id para aceitar NULL
ALTER TABLE public.audit_logs ALTER COLUMN user_id DROP NOT NULL;

-- Criar função para processar conversas em lotes
CREATE OR REPLACE FUNCTION public.reset_conversations_batch(batch_size integer DEFAULT 50)
RETURNS TABLE(
  batch_number integer,
  conversations_reset integer,
  total_remaining integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_batch integer := 1;
  reset_count integer;
  remaining_count integer;
  conversation_ids uuid[];
BEGIN
  LOOP
    -- Pegar IDs das próximas conversas para resetar
    SELECT array_agg(id) INTO conversation_ids
    FROM (
      SELECT id FROM public.conversations 
      WHERE status = 'sent_to_seller' OR fallback_mode = true
      LIMIT batch_size
    ) batch_conversations;
    
    -- Se não há mais conversas para processar, sair do loop
    IF conversation_ids IS NULL OR array_length(conversation_ids, 1) = 0 THEN
      EXIT;
    END IF;
    
    -- Resetar o lote atual
    UPDATE public.conversations 
    SET 
      status = 'bot_attending',
      fallback_mode = false,
      fallback_taken_by = NULL,
      updated_at = now()
    WHERE id = ANY(conversation_ids);
    
    GET DIAGNOSTICS reset_count = ROW_COUNT;
    
    -- Contar quantas ainda restam
    SELECT COUNT(*) INTO remaining_count
    FROM public.conversations 
    WHERE status = 'sent_to_seller' OR fallback_mode = true;
    
    -- Retornar resultado do lote
    RETURN QUERY SELECT current_batch, reset_count, remaining_count;
    
    current_batch := current_batch + 1;
    
    -- Pequeno delay para evitar sobrecarga
    PERFORM pg_sleep(0.1);
  END LOOP;
END;
$function$;