import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { text, voiceId, conversationId, messageId } = await req.json();

    if (!text) {
      throw new Error('Texto é obrigatório');
    }

    // Buscar configuração ElevenLabs
    const { data: config, error: configError } = await supabase
      .from('integrations')
      .select('config')
      .eq('name', 'ElevenLabs')
      .eq('active', true)
      .single();

    if (configError) {
      console.log('Config não encontrada, usando valores padrão');
    }

    const defaultVoice = config?.config?.default_voice || 'EXAVITQu4vr4xnSDxMaL'; // Sarah
    const selectedVoice = voiceId || defaultVoice;

    // Buscar voz preferida da conversa se disponível
    if (conversationId && !voiceId) {
      const { data: conversation } = await supabase
        .from('conversations')
        .select('preferred_voice')
        .eq('id', conversationId)
        .single();
      
      if (conversation?.preferred_voice) {
        // Mapear nome para ID se necessário
        const voiceMapping = {
          'sarah': 'EXAVITQu4vr4xnSDxMaL',
          'aria': '9BWtsMINqrJLrRacOk9x',
          'roger': 'CwhRBWXzGAHq8TQ4Fs17',
          'adam': 'pNInz6obpgDQGcFmaJgB',
          'liam': 'TX3LPaxmHKxFdv7VOQHJ'
        };
        const finalVoice = voiceMapping[conversation.preferred_voice.toLowerCase()] || conversation.preferred_voice;
        // Use finalVoice instead of selectedVoice
      }
    }

    console.log(`Gerando áudio para texto: "${text.substring(0, 100)}..." com voz: ${selectedVoice}`);

    // Chamar API ElevenLabs Text-to-Speech
    const elevenLabsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}`, {
      method: 'POST',
      headers: {
        'xi-api-key': Deno.env.get('ELEVENLABS_API_KEY') ?? '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
          style: 0.0,
          use_speaker_boost: true
        }
      }),
    });

    if (!elevenLabsResponse.ok) {
      const errorText = await elevenLabsResponse.text();
      console.error('Erro ElevenLabs TTS:', errorText);
      throw new Error(`Erro na síntese de voz: ${elevenLabsResponse.statusText}`);
    }

    // Converter áudio para base64
    const audioBuffer = await elevenLabsResponse.arrayBuffer();
    const audioBase64 = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));

    console.log(`Áudio gerado com sucesso, tamanho: ${audioBuffer.byteLength} bytes`);

    // Salvar áudio no storage se necessário
    let audioUrl = null;
    if (messageId) {
      const fileName = `audio_${messageId}_${Date.now()}.mp3`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('whatsapp-media')
        .upload(fileName, audioBuffer, {
          contentType: 'audio/mpeg',
          cacheControl: '3600',
        });

      if (!uploadError && uploadData) {
        const { data: urlData } = supabase.storage
          .from('whatsapp-media')
          .getPublicUrl(fileName);
        audioUrl = urlData.publicUrl;
      }
    }

    // Log da operação
    await supabase.from('system_logs').insert({
      type: 'info',
      source: 'elevenlabs-text-to-speech',
      message: 'Síntese de voz realizada com sucesso',
      details: {
        conversation_id: conversationId,
        message_id: messageId,
        voice_id: selectedVoice,
        text_length: text.length,
        audio_size_bytes: audioBuffer.byteLength,
        audio_url: audioUrl
      }
    });

    return new Response(JSON.stringify({
      success: true,
      audioBase64,
      audioUrl,
      voiceUsed: selectedVoice,
      audioSize: audioBuffer.byteLength
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro na síntese ElevenLabs:', error);
    
    await supabase.from('system_logs').insert({
      type: 'error',
      source: 'elevenlabs-text-to-speech',
      message: 'Erro na síntese de voz',
      details: {
        error: error.message,
        stack: error.stack
      }
    });

    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});