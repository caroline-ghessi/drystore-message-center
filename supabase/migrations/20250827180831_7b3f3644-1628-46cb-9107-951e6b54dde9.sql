-- Atualizar função para usar source válido
CREATE OR REPLACE FUNCTION public.remove_message_queue_crons()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Remove todos os cron jobs relacionados ao processamento de mensagens
  PERFORM cron.unschedule(jobid) 
  FROM cron.job 
  WHERE command LIKE '%process-message-queue%';
  
  -- Log da remoção usando source válido
  INSERT INTO public.system_logs (type, source, message, details)
  VALUES (
    'info',
    'security',
    'Cron jobs de message queue removidos',
    jsonb_build_object('timestamp', now())
  );
END;
$function$;