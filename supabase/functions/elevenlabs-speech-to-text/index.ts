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
    const { audioUrl, conversationId, messageId } = await req.json();

    if (!audioUrl) {
      throw new Error('Audio URL é obrigatório');
    }

    // Buscar configuração ElevenLabs
    const { data: config, error: configError } = await supabase
      .from('integrations')
      .select('config')
      .eq('name', 'ElevenLabs')
      .eq('active', true)
      .single();

    if (configError || !config) {
      throw new Error('Configuração ElevenLabs não encontrada');
    }

    // Baixar o arquivo de áudio
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error(`Erro ao baixar áudio: ${audioResponse.statusText}`);
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const audioBlob = new Blob([audioBuffer]);

    // Preparar FormData para ElevenLabs
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.mp3');
    formData.append('model', 'whisper-1');

    // Chamar API ElevenLabs Speech-to-Text
    const elevenLabsResponse = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': Deno.env.get('ELEVENLABS_API_KEY') ?? '',
      },
      body: formData,
    });

    if (!elevenLabsResponse.ok) {
      const errorText = await elevenLabsResponse.text();
      console.error('Erro ElevenLabs STT:', errorText);
      throw new Error(`Erro na transcrição: ${elevenLabsResponse.statusText}`);
    }

    const result = await elevenLabsResponse.json();
    const transcription = result.text || '';

    console.log(`Transcrição realizada: "${transcription.substring(0, 100)}..."`);

    // Atualizar mensagem com transcrição
    if (messageId) {
      await supabase
        .from('messages')
        .update({
          content: transcription,
          metadata: {
            original_audio_url: audioUrl,
            transcription_provider: 'elevenlabs',
            transcribed_at: new Date().toISOString()
          }
        })
        .eq('id', messageId);
    }

    // Log da operação
    await supabase.from('system_logs').insert({
      type: 'info',
      source: 'elevenlabs-speech-to-text',
      message: 'Transcrição de áudio realizada com sucesso',
      details: {
        conversation_id: conversationId,
        message_id: messageId,
        transcription_length: transcription.length,
        audio_url: audioUrl
      }
    });

    return new Response(JSON.stringify({
      success: true,
      transcription,
      original_audio_url: audioUrl
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro na transcrição ElevenLabs:', error);
    
    await supabase.from('system_logs').insert({
      type: 'error',
      source: 'elevenlabs-speech-to-text',
      message: 'Erro na transcrição de áudio',
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