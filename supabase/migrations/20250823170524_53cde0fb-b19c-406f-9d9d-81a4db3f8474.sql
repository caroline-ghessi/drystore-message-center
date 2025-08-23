-- Add ElevenLabs integration configuration to conversations table
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS audio_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS preferred_voice text DEFAULT 'alloy';

-- Insert ElevenLabs integration configuration (without ON CONFLICT)
INSERT INTO public.integrations (name, type, config, active)
SELECT 
  'ElevenLabs',
  'ai_voice',
  jsonb_build_object(
    'api_url', 'https://api.elevenlabs.io/v1',
    'default_voice', 'alloy',
    'default_model', 'eleven_multilingual_v2',
    'voices', jsonb_build_array(
      jsonb_build_object('id', 'EXAVITQu4vr4xnSDxMaL', 'name', 'Sarah'),
      jsonb_build_object('id', '9BWtsMINqrJLrRacOk9x', 'name', 'Aria'),
      jsonb_build_object('id', 'CwhRBWXzGAHq8TQ4Fs17', 'name', 'Roger'),
      jsonb_build_object('id', 'pNInz6obpgDQGcFmaJgB', 'name', 'Adam'),
      jsonb_build_object('id', 'TX3LPaxmHKxFdv7VOQHJ', 'name', 'Liam')
    ),
    'audio_format', 'mp3',
    'quality', 'high'
  ),
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.integrations 
  WHERE name = 'ElevenLabs' AND type = 'ai_voice'
);