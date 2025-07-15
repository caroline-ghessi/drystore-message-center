import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Loader2, Upload, X } from 'lucide-react';
import { useDifyChat } from '@/hooks/useDifyChat';
import { toast } from 'sonner';

export const DifyChatTestWithFiles: React.FC = () => {
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const { loading, messages, sendMessage, sendMessageWithFiles, clearConversation } = useDifyChat({
    userId: 'test-user-files'
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).slice(0, 5);
      setFiles(selectedFiles);
      
      if (selectedFiles.length > 5) {
        toast.warning('Máximo de 5 arquivos permitidos');
      }
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if ((!input.trim() && files.length === 0) || loading) return;
    
    const message = input || 'Arquivo enviado';
    setInput('');
    
    try {
      if (files.length > 0) {
        // Simular upload para Supabase Storage primeiro
        const fileUrls: string[] = [];
        for (const file of files) {
          // Em um cenário real, faria upload para Supabase Storage aqui
          // Por enquanto, criar URLs de exemplo
          const fakeUrl = `https://example.com/uploads/${Date.now()}-${file.name}`;
          fileUrls.push(fakeUrl);
        }
        
        await sendMessageWithFiles?.(message, fileUrls);
        setFiles([]);
      } else {
        await sendMessage(message);
      }
    } catch (error) {
      toast.error('Erro ao enviar mensagem');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileTypeEmoji = (type: string): string => {
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('audio/')) return '🎵';
    if (type.startsWith('video/')) return '🎥';
    if (type.includes('pdf')) return '📄';
    if (type.includes('document') || type.includes('word')) return '📝';
    if (type.includes('sheet') || type.includes('excel')) return '📊';
    return '📎';
  };

  return (
    <Card className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Teste Dify Chat com Arquivos</h2>
        <Button 
          variant="outline" 
          onClick={clearConversation}
          disabled={loading}
        >
          Limpar Chat
        </Button>
      </div>
      
      <div className="h-96 overflow-y-auto mb-4 space-y-3 border rounded-lg p-4 bg-muted/30">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <Upload className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Envie mensagens e arquivos para testar o Dify</p>
            <p className="text-sm">Suporta: imagens, áudios, vídeos, documentos</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] p-3 rounded-lg ${
                msg.type === 'user' 
                  ? 'bg-primary text-primary-foreground ml-4' 
                  : 'bg-card border mr-4'
              }`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                {msg.files && msg.files.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-current/20">
                    <p className="text-xs opacity-75">
                      📎 {msg.files.length} arquivo(s) anexado(s)
                    </p>
                  </div>
                )}
                {msg.streaming && (
                  <div className="mt-2 pt-2 border-t border-current/20">
                    <p className="text-xs opacity-75">Digitando...</p>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-card border p-3 rounded-lg mr-4">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Bot está pensando...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {/* Upload de arquivos */}
        <div className="space-y-2">
          <label className="block">
            <div className="flex items-center gap-2 p-3 border-2 border-dashed rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
              <Upload className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Clique para selecionar arquivos (máx. 5)
              </span>
            </div>
            <input
              type="file"
              multiple
              accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
              onChange={handleFileChange}
              className="hidden"
              disabled={loading}
            />
          </label>
          
          {files.length > 0 && (
            <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium">Arquivos selecionados:</p>
              {files.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-card rounded border">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-lg">{getFileTypeEmoji(file.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)} • {file.type}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                    disabled={loading}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Input de mensagem */}
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Digite sua mensagem..."
            disabled={loading}
            className="flex-1"
          />
          <Button 
            onClick={handleSend} 
            disabled={loading || (!input.trim() && files.length === 0)}
            className="px-6"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Enviar'
            )}
          </Button>
        </div>

        <div className="text-xs text-muted-foreground text-center">
          <p>Tipos suportados: Imagens (JPG, PNG, GIF), Áudios (MP3, WAV), Vídeos (MP4, MOV), Documentos (PDF, DOC, XLS)</p>
          <p>Tamanho máximo: 50MB por arquivo</p>
        </div>
      </div>
    </Card>
  );
};