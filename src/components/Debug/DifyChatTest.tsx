import { useState } from 'react';
import { useDifyChat } from '@/hooks/useDifyChat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, Trash2, TestTube } from 'lucide-react';

export function DifyChatTest() {
  const [input, setInput] = useState('');
  const [useStreaming, setUseStreaming] = useState(true);
  
  const { 
    loading, 
    messages, 
    conversationId,
    sendMessage,
    sendMessageStreaming, 
    clearConversation,
    testConnection 
  } = useDifyChat({
    userId: 'test-user'
  });

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const message = input;
    setInput('');
    
    if (useStreaming) {
      await sendMessageStreaming(message);
    } else {
      await sendMessage(message);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Teste Dify Chatflow</span>
          <div className="flex items-center gap-2">
            {conversationId && (
              <Badge variant="outline" className="text-xs">
                ID: {conversationId.slice(0, 8)}...
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={testConnection}
              disabled={loading}
            >
              <TestTube className="h-4 w-4 mr-1" />
              Testar Conexão
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearConversation}
              disabled={loading}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Limpar
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Opções de teste */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={useStreaming}
              onChange={(e) => setUseStreaming(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Usar streaming</span>
          </label>
        </div>

        {/* Área de mensagens */}
        <div className="h-96 overflow-y-auto border rounded-lg p-4 space-y-3 bg-muted/50">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p className="text-center">
                Nenhuma mensagem ainda.<br />
                Teste a integração enviando uma mensagem.
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] p-3 rounded-lg ${
                    msg.type === 'user' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-background border'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {msg.type === 'user' ? 'Você' : 'Dify Bot'} • {msg.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                    {msg.streaming && (
                      <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Área de input */}
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Digite sua mensagem para testar o Dify..."
            disabled={loading}
            className="flex-1"
          />
          <Button 
            onClick={handleSend} 
            disabled={loading || !input.trim()}
            size="sm"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Instruções */}
        <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
          <p><strong>Como usar:</strong></p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Digite uma mensagem e pressione Enter ou clique em Enviar</li>
            <li>Marque "Usar streaming" para ver respostas em tempo real</li>
            <li>Use "Testar Conexão" para verificar se o Dify está configurado</li>
            <li>O ID da conversa é mantido entre mensagens para contexto</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}