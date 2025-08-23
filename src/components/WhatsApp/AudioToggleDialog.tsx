import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface AudioToggleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  currentAudioEnabled: boolean;
  currentPreferredVoice?: string;
  onUpdate: () => void;
}

const ELEVENLABS_VOICES = [
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', language: 'Português/Inglês' },
  { id: '9BWtsMINqrJLrRacOk9x', name: 'Aria', language: 'Multilingual' },
  { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger', language: 'Inglês' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', language: 'Inglês' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', language: 'Inglês' }
];

export function AudioToggleDialog({ 
  isOpen, 
  onClose, 
  conversationId, 
  currentAudioEnabled, 
  currentPreferredVoice,
  onUpdate 
}: AudioToggleDialogProps) {
  const [audioEnabled, setAudioEnabled] = useState(currentAudioEnabled);
  const [preferredVoice, setPreferredVoice] = useState(currentPreferredVoice || 'EXAVITQu4vr4xnSDxMaL');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('conversations')
        .update({
          metadata: {
            audio_enabled: audioEnabled,
            preferred_voice: preferredVoice
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
      
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Erro ao atualizar configuração de áudio:', error);
      toast.error('Erro ao salvar configurações de áudio');
    } finally {
      setSaving(false);
    }
  };

  const testVoice = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-text-to-speech', {
        body: {
          text: 'Olá! Esta é a voz que será usada nas respostas do bot para esta conversa.',
          voiceId: preferredVoice,
          conversationId
        }
      });

      if (error) {
        throw new Error(error.message || 'Erro no teste de voz');
      }

      if (data?.success && data.audioBase64) {
        const audio = new Audio(`data:audio/mpeg;base64,${data.audioBase64}`);
        await audio.play();
        toast.success('🔊 Teste de voz reproduzido com sucesso!');
      } else {
        throw new Error(data?.error || 'Falha no teste de voz');
      }
    } catch (error) {
      console.error('Erro no teste de voz:', error);
      toast.error(`❌ Erro no teste: ${error.message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {audioEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            Configurar Modo Áudio
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Habilitar Modo Áudio</h4>
              <p className="text-sm text-muted-foreground">
                Bot responderá em áudio e transcreverá mensagens de áudio
              </p>
            </div>
            <Switch
              checked={audioEnabled}
              onCheckedChange={setAudioEnabled}
            />
          </div>

          {audioEnabled && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Voz Preferida</label>
                <Select value={preferredVoice} onValueChange={setPreferredVoice}>
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

              <Button 
                variant="outline" 
                size="sm" 
                onClick={testVoice}
                disabled={testing}
                className="w-full"
              >
                {testing ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    Testando Voz...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4" />
                    Testar Voz
                  </div>
                )}
              </Button>

              <div className="rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-3">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>Modo Áudio:</strong> As mensagens de áudio dos clientes serão automaticamente transcritas e o bot responderá em áudio usando a voz selecionada.
                </p>
              </div>
            </>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Salvando...
                </div>
              ) : (
                'Salvar'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}