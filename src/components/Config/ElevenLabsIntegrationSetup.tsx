import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const ELEVENLABS_VOICES = [
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', language: 'Português/Inglês' },
  { id: '9BWtsMINqrJLrRacOk9x', name: 'Aria', language: 'Multilingual' },
  { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger', language: 'Inglês' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', language: 'Inglês' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', language: 'Inglês' }
];

export function ElevenLabsIntegrationSetup() {
  const [integration, setIntegration] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    active: false,
    default_voice: 'EXAVITQu4vr4xnSDxMaL',
    quality: 'high',
    audio_format: 'mp3'
  });

  useEffect(() => {
    loadIntegration();
  }, []);

  const loadIntegration = async () => {
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
        setIntegration(data);
        setSettings({
          active: data.active || false,
          default_voice: (data.config as any)?.default_voice || 'EXAVITQu4vr4xnSDxMaL',
          quality: (data.config as any)?.quality || 'high',
          audio_format: (data.config as any)?.audio_format || 'mp3'
        });
      }
    } catch (error) {
      console.error('Erro ao carregar integração ElevenLabs:', error);
      toast.error('Erro ao carregar configuração ElevenLabs');
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      // Testar TTS com texto simples
      const { data, error } = await supabase.functions.invoke('elevenlabs-text-to-speech', {
        body: {
          text: 'Olá! Este é um teste da integração com ElevenLabs.',
          voiceId: settings.default_voice
        }
      });

      if (error) {
        throw new Error(error.message || 'Erro no teste de conexão');
      }

      if (data?.success) {
        toast.success('✅ Conexão com ElevenLabs testada com sucesso!');
        
        // Reproduzir áudio de teste se disponível
        if (data.audioBase64) {
          const audio = new Audio(`data:audio/mpeg;base64,${data.audioBase64}`);
          audio.play().catch(console.error);
        }
      } else {
        throw new Error(data?.error || 'Falha no teste');
      }
    } catch (error) {
      console.error('Erro no teste:', error);
      toast.error(`❌ Erro no teste: ${error.message}`);
    } finally {
      setTesting(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const configData = {
        api_url: 'https://api.elevenlabs.io/v1',
        default_voice: settings.default_voice,
        default_model: 'eleven_multilingual_v2',
        quality: settings.quality,
        audio_format: settings.audio_format,
        voices: ELEVENLABS_VOICES,
        features: ['speech_to_text', 'text_to_speech']
      };

      let query;
      if (integration) {
        // Atualizar integração existente
        query = supabase
          .from('integrations')
          .update({
            active: settings.active,
            config: configData,
            updated_at: new Date().toISOString()
          })
          .eq('id', integration.id);
      } else {
        // Criar nova integração - usar tipo válido
        query = supabase
          .from('integrations')
          .insert({
            name: 'ElevenLabs',
            type: 'ai', // Usando tipo válido baseado na query anterior
            active: settings.active,
            config: configData
          });
      }

      const { error } = await query;

      if (error) {
        throw error;
      }

      toast.success('✅ Configurações ElevenLabs salvas com sucesso!');
      loadIntegration(); // Recarregar dados
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error(`Erro ao salvar configurações: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            ElevenLabs Integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            ElevenLabs Integration
          </div>
          <Badge variant={settings.active ? "default" : "secondary"}>
            {settings.active ? "Ativo" : "Inativo"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium">Ativar ElevenLabs</h4>
            <p className="text-sm text-muted-foreground">
              Habilitar transcrição de áudio e síntese de voz
            </p>
          </div>
          <Switch
            checked={settings.active}
            onCheckedChange={(checked) => 
              setSettings(prev => ({ ...prev, active: checked }))
            }
          />
        </div>

        {settings.active && (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium">Voz Padrão</label>
              <Select
                value={settings.default_voice}
                onValueChange={(value) => 
                  setSettings(prev => ({ ...prev, default_voice: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma voz" />
                </SelectTrigger>
                <SelectContent>
                  {ELEVENLABS_VOICES.map((voice) => (
                    <SelectItem key={voice.id} value={voice.id}>
                      <div className="flex flex-col">
                        <span>{voice.name}</span>
                        <span className="text-xs text-muted-foreground">{voice.language}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Qualidade do Áudio</label>
              <Select
                value={settings.quality}
                onValueChange={(value) => 
                  setSettings(prev => ({ ...prev, quality: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">Alta Qualidade</SelectItem>
                  <SelectItem value="medium">Qualidade Média</SelectItem>
                  <SelectItem value="low">Qualidade Baixa (Mais Rápido)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Formato de Áudio</label>
              <Select
                value={settings.audio_format}
                onValueChange={(value) => 
                  setSettings(prev => ({ ...prev, audio_format: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mp3">MP3 (Recomendado)</SelectItem>
                  <SelectItem value="wav">WAV</SelectItem>
                  <SelectItem value="ogg">OGG</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        <div className="flex gap-3">
          <Button 
            onClick={saveSettings} 
            disabled={saving}
            className="flex-1"
          >
            {saving ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Salvando...
              </div>
            ) : (
              'Salvar Configurações'
            )}
          </Button>
          
          {settings.active && (
            <Button 
              variant="outline" 
              onClick={testConnection}
              disabled={testing}
            >
              {testing ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  Testando...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4" />
                  Testar Conexão
                </div>
              )}
            </Button>
          )}
        </div>

        <div className="rounded-lg bg-muted p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <span className="font-medium">Configuração necessária</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Para usar o ElevenLabs, você precisa adicionar sua API key nos secrets do Supabase:
          </p>
          <code className="text-xs bg-background p-2 rounded border block">
            ELEVENLABS_API_KEY
          </code>
        </div>

        {settings.active && (
          <div className="rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
              <CheckCircle className="h-4 w-4" />
              <span className="font-medium">Funcionalidades Habilitadas</span>
            </div>
            <ul className="text-sm text-green-600 dark:text-green-400 space-y-1 ml-6">
              <li>• Transcrição automática de áudios dos clientes</li>
              <li>• Respostas do bot em áudio com voz natural</li>
              <li>• Configuração de voz por conversa</li>
              <li>• Fallback automático para texto em caso de erro</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}