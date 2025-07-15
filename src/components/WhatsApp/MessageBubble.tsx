import { cn } from "@/lib/utils";
import { Play, Download, FileText, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

export type MessageType = 'text' | 'audio' | 'image' | 'video' | 'document' | 'location';
export type SenderType = 'customer' | 'bot' | 'seller' | 'system';

interface MessageBubbleProps {
  content: string;
  sender_type: SenderType;
  sender_name: string;
  message_type: MessageType;
  media_url?: string;
  created_at: string;
  className?: string;
}

export function MessageBubble({
  content,
  sender_type,
  sender_name,
  message_type,
  media_url,
  created_at,
  className
}: MessageBubbleProps) {
  const isFromCustomer = sender_type === 'customer';
  const isFromBot = sender_type === 'bot';
  const isFromSeller = sender_type === 'seller';
  const isSystem = sender_type === 'system';

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderMessageContent = () => {
    switch (message_type) {
      case 'audio':
        return (
          <div className="flex items-center space-x-2 p-2">
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
              <Play className="h-4 w-4" />
            </Button>
            <div className="h-1 bg-muted rounded-full flex-1">
              <div className="h-1 bg-primary rounded-full w-1/3"></div>
            </div>
            <span className="text-xs text-muted-foreground">0:32</span>
          </div>
        );
      
      case 'image':
        return (
          <div className="max-w-xs">
            <img 
              src={media_url || '/placeholder.svg'} 
              alt="Imagem compartilhada"
              className="rounded-lg w-full h-auto"
            />
            {content && <p className="mt-2 text-sm">{content}</p>}
          </div>
        );
      
      case 'video':
        return (
          <div className="max-w-xs">
            <div className="relative bg-muted rounded-lg aspect-video flex items-center justify-center">
              <Play className="h-8 w-8 text-muted-foreground" />
            </div>
            {content && <p className="mt-2 text-sm">{content}</p>}
          </div>
        );
      
      case 'document':
        return (
          <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg max-w-xs">
            <FileText className="h-8 w-8 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{content || 'Documento'}</p>
              <p className="text-xs text-muted-foreground">PDF • 245 KB</p>
            </div>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        );
      
      case 'location':
        return (
          <div className="max-w-xs">
            <div className="bg-muted rounded-lg p-4 flex items-center space-x-3">
              <MapPin className="h-6 w-6 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Localização compartilhada</p>
                <p className="text-xs text-muted-foreground">Toque para visualizar</p>
              </div>
            </div>
            {content && <p className="mt-2 text-sm">{content}</p>}
          </div>
        );
      
      default:
        return <p className="text-sm leading-relaxed">{content}</p>;
    }
  };

  if (isSystem) {
    return (
      <div className={cn("flex justify-center my-4", className)}>
        <div className="bg-muted px-4 py-2 rounded-full">
          <p className="text-xs text-muted-foreground text-center">{content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex mb-4 animate-fade-in",
      isFromCustomer ? "justify-end" : "justify-start",
      className
    )}>
      <div className={cn(
        "max-w-[70%] rounded-2xl px-4 py-3",
        isFromCustomer && "bg-drystore-orange text-white",
        isFromBot && "bg-muted",
        isFromSeller && "bg-drystore-info text-white"
      )}>
        {/* Sender name for non-customer messages */}
        {!isFromCustomer && (
          <div className="flex items-center justify-between mb-1">
            <p className={cn(
              "text-xs font-medium",
              isFromBot && "text-drystore-orange",
              isFromSeller && "text-drystore-info"
            )}>
              {sender_name}
            </p>
          </div>
        )}
        
        {/* Message content */}
        <div className={cn(
          isFromCustomer ? "text-white" : "",
          isFromBot ? "text-foreground" : "",
          isFromSeller ? "text-white" : ""
        )}>
          {renderMessageContent()}
        </div>
        
        {/* Timestamp */}
        <div className="flex justify-end mt-1">
          <span className={cn(
            "text-xs",
            isFromCustomer ? "text-white/70" : "text-muted-foreground"
          )}>
            {formatTime(created_at)}
          </span>
        </div>
      </div>
    </div>
  );
}