-- Ajustar status das conversas para permitir bot processamento
UPDATE conversations 
SET 
  status = 'bot_attending',
  fallback_mode = false,
  updated_at = now()
WHERE id IN ('3cedbac7-49c5-41ee-9222-f816cc38e43b', '5072490d-71c2-4d76-8689-5376aa83e754');