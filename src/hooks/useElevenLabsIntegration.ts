import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ElevenLabsConfig {
  active: boolean;
  default_voice: string;
  quality: string;
  audio_format: string;
}

export const useElevenLabsIntegration = () => {
  const [config, setConfig] = useState<ElevenLabsConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('name', 'ElevenLabs')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        const configData = data.config as any;
        setConfig({
          active: data.active || false,
          default_voice: configData?.default_voice || 'EXAVITQu4vr4xnSDxMaL',
          quality: configData?.quality || 'high',
          audio_format: configData?.audio_format || 'mp3'
        });
      }
    } catch (error) {
      console.error('Erro ao carregar configuração ElevenLabs:', error);
    } finally {
      setLoading(false);
    }
  };

  const testTextToSpeech = async (text: string, voiceId?: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-text-to-speech', {
        body: {
          text,
          voiceId: voiceId || config?.default_voice
        }
      });

      if (error) {
        throw new Error(error.message || 'Erro no teste TTS');
      }

      if (data?.success) {
        // Reproduzir áudio se disponível
        if (data.audioBase64) {
          const audio = new Audio(`data:audio/mpeg;base64,${data.audioBase64}`);
          await audio.play();
        }
        return { success: true, audioBase64: data.audioBase64 };
      } else {
        throw new Error(data?.error || 'Falha no teste TTS');
      }
    } catch (error) {
      console.error('Erro no teste TTS:', error);
      throw error;
    }
  };

  const testSpeechToText = async (audioUrl: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-speech-to-text', {
        body: {
          audioUrl
        }
      });

      if (error) {
        throw new Error(error.message || 'Erro no teste STT');
      }

      if (data?.success) {
        return { success: true, transcription: data.transcription };
      } else {
        throw new Error(data?.error || 'Falha no teste STT');
      }
    } catch (error) {
      console.error('Erro no teste STT:', error);
      throw error;
    }
  };

  const updateConversationAudioSettings = async (
    conversationId: string, 
    audioEnabled: boolean, 
    preferredVoice?: string
  ) => {
    try {
      // Buscar metadata atual da conversa
      const { data: conversation, error: fetchError } = await supabase
        .from('conversations')
        .select('metadata')
        .eq('id', conversationId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      const currentMetadata = (conversation?.metadata as any) || {};
      
      const { error } = await supabase
        .from('conversations')
        .update({
          metadata: {
            ...currentMetadata,
            audio_enabled: audioEnabled,
            preferred_voice: preferredVoice || config?.default_voice
          }
        })
        .eq('id', conversationId);

      if (error) {
        throw error;
      }

      toast.success(audioEnabled ? 
        '✅ Modo áudio ativado para esta conversa' : 
        '✅ Modo áudio desativado para esta conversa'
      );
      
      return { success: true };
    } catch (error) {
      console.error('Erro ao atualizar configurações de áudio:', error);
      toast.error('Erro ao salvar configurações de áudio');
      throw error;
    }
  };

  const getConversationAudioSettings = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('metadata')
        .eq('id', conversationId)
        .single();

      if (error) {
        throw error;
      }

      const metadata = (data?.metadata as any) || {};
      return {
        audioEnabled: metadata.audio_enabled || false,
        preferredVoice: metadata.preferred_voice || config?.default_voice
      };
    } catch (error) {
      console.error('Erro ao buscar configurações de áudio:', error);
      return {
        audioEnabled: false,
        preferredVoice: config?.default_voice
      };
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  return {
    config,
    loading,
    loadConfig,
    testTextToSpeech,
    testSpeechToText,
    updateConversationAudioSettings,
    getConversationAudioSettings,
    isActive: config?.active || false
  };
};