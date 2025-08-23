-- Inserir configuração ElevenLabs com tipo válido
INSERT INTO public.integrations (name, type, config, active)
SELECT 
  'ElevenLabs',
  'ai',
  jsonb_build_object(
    'api_url', 'https://api.elevenlabs.io/v1',
    'default_voice', 'EXAVITQu4vr4xnSDxMaL',
    'default_model', 'eleven_multilingual_v2',
    'voices', jsonb_build_array(
      jsonb_build_object('id', 'EXAVITQu4vr4xnSDxMaL', 'name', 'Sarah'),
      jsonb_build_object('id', '9BWtsMINqrJLrRacOk9x', 'name', 'Aria'),
      jsonb_build_object('id', 'CwhRBWXzGAHq8TQ4Fs17', 'name', 'Roger'),
      jsonb_build_object('id', 'pNInz6obpgDQGcFmaJgB', 'name', 'Adam'),
      jsonb_build_object('id', 'TX3LPaxmHKxFdv7VOQHJ', 'name', 'Liam')
    ),
    'audio_format', 'mp3',
    'quality', 'high',
    'features', jsonb_build_array('speech_to_text', 'text_to_speech')
  ),
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.integrations 
  WHERE name = 'ElevenLabs'
);