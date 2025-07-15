import { useState, useEffect, useRef } from "react";
import { MessageBubble, MessageType, SenderType } from "./MessageBubble";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";

interface Message {
  id: string;
  conversation_id: string;
  sender_type: SenderType;
  sender_name: string;
  content: string;
  message_type: MessageType;
  media_url?: string;
  created_at: string;
}

interface MessagePanelProps {
  conversation_id: string;
  messages: Message[];
  canSendMessage?: boolean;
  onSendMessage?: (message: string) => void;
  className?: string;
}

export function MessagePanel({ 
  conversation_id, 
  messages, 
  canSendMessage = false,
  onSendMessage,
  className 
}: MessagePanelProps) {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
              content={message.content}
              sender_type={message.sender_type}
              sender_name={message.sender_name}
              message_type={message.message_type}
              media_url={message.media_url}
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
    </div>
  );
}