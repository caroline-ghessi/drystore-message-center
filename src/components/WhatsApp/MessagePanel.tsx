import { useState, useEffect, useRef } from "react";
import { MessageBubble, MessageType, SenderType } from "./MessageBubble";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OperatorAssignmentPanel } from "@/components/Security/OperatorAssignmentPanel";
import { AudioToggleDialog } from "./AudioToggleDialog";
import { FallbackControlPanel } from "./FallbackControlPanel";
import { useElevenLabsIntegration } from "@/hooks/useElevenLabsIntegration";
import { Send, Volume2 } from "lucide-react";

interface Message {
  id: string;
  conversation_id: string;
  sender_type: SenderType;
  sender_name?: string;
  content?: string;
  message_type: MessageType;
  media_url?: string;
  metadata?: any;
  created_at: string;
}

interface MessagePanelProps {
  conversation_id: string;
  messages: Message[];
  canSendMessage?: boolean;
  onSendMessage?: (message: string) => void;
  className?: string;
  customerName?: string;
  assignedOperatorId?: string;
  onAssignmentChange?: () => void;
  fallbackMode?: boolean;
  fallbackTakenBy?: string;
  fallbackTakenAt?: string;
}

export function MessagePanel({ 
  conversation_id, 
  messages, 
  canSendMessage = false,
  onSendMessage,
  className,
  customerName,
  assignedOperatorId,
  onAssignmentChange,
  fallbackMode = false,
  fallbackTakenBy,
  fallbackTakenAt
}: MessagePanelProps) {
  const [newMessage, setNewMessage] = useState('');
  const [audioDialogOpen, setAudioDialogOpen] = useState(false);
  const [audioSettings, setAudioSettings] = useState({ audioEnabled: false, preferredVoice: undefined });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isActive: elevenLabsActive, getConversationAudioSettings } = useElevenLabsIntegration();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Carregar configurações de áudio da conversa
    if (conversation_id && elevenLabsActive) {
      getConversationAudioSettings(conversation_id).then(settings => {
        setAudioSettings(settings);
      });
    }
  }, [conversation_id, elevenLabsActive, getConversationAudioSettings]);

  const handleUpdateAudioSettings = async () => {
    // Recarregar configurações após atualização
    if (conversation_id && elevenLabsActive) {
      const settings = await getConversationAudioSettings(conversation_id);
      setAudioSettings(settings);
    }
  };

  const handleSendMessage = () => {
    if (newMessage.trim() && onSendMessage) {
      onSendMessage(newMessage);
      setNewMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Security Assignment Panel */}
      {customerName && (
        <div className="p-4 border-b bg-muted/20">
          <OperatorAssignmentPanel
            conversationId={conversation_id}
            currentOperatorId={assignedOperatorId}
            customerName={customerName}
            onAssignmentChange={onAssignmentChange}
          />
        </div>
      )}

      {/* Fallback Control Panel */}
      <div className="px-4 py-2 border-b">
        <FallbackControlPanel
          conversationId={conversation_id}
          fallbackMode={fallbackMode}
          fallbackTakenBy={fallbackTakenBy}
          fallbackTakenAt={fallbackTakenAt}
          onFallbackChange={onAssignmentChange}
        />
      </div>

      {/* Audio Toggle Panel */}
      {elevenLabsActive && conversation_id && (
        <div className="border-b bg-muted/50 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Volume2 className="h-4 w-4" />
            <span>Modo Áudio: {audioSettings.audioEnabled ? 'Ativo' : 'Inativo'}</span>
            {audioSettings.audioEnabled && audioSettings.preferredVoice && (
              <span className="text-muted-foreground">
                (Voz: {audioSettings.preferredVoice})
              </span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAudioDialogOpen(true)}
          >
            Configurar
          </Button>
        </div>
      )}
      
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground text-center">
              Nenhuma mensagem ainda.<br />
              As mensagens aparecerão aqui quando chegarem.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              content={message.content || ''}
              sender_type={message.sender_type}
              sender_name={message.sender_name || 'Usuário'}
              message_type={message.message_type}
              media_url={message.media_url}
              metadata={message.metadata}
              created_at={message.created_at}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      {canSendMessage && (
        <div className="border-t p-4">
          <div className="flex space-x-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Digite sua mensagem..."
              className="flex-1"
            />
            <Button 
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              size="sm"
              className="px-3"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Audio Toggle Dialog */}
      {conversation_id && (
        <AudioToggleDialog
          isOpen={audioDialogOpen}
          onClose={() => setAudioDialogOpen(false)}
          conversationId={conversation_id}
          currentAudioEnabled={audioSettings.audioEnabled}
          currentPreferredVoice={audioSettings.preferredVoice}
          onUpdate={handleUpdateAudioSettings}
        />
      )}
    </div>
  );
}