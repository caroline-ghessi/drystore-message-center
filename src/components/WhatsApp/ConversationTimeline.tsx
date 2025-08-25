import { Clock, Bot, User, UserCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { MessageBubble } from "./MessageBubble"

interface Message {
  id: string
  sender_type: string
  sender_name: string | null
  content: string
  message_type: string
  created_at: string
  media_url: string | null
  message_source: string
}

interface ConversationTimelineProps {
  messages: Message[]
  conversationStatus: string
  sellerName?: string
  leadTransferredAt?: string
}

export function ConversationTimeline({ 
  messages, 
  conversationStatus, 
  sellerName,
  leadTransferredAt 
}: ConversationTimelineProps) {
  // Organizar mensagens por fases da conversa
  const organizedMessages = messages.reduce((acc, message) => {
    if (message.sender_type === 'bot' || message.message_source === 'dify') {
      acc.botPhase.push(message)
    } else if (message.sender_type === 'seller' || message.sender_type === 'customer') {
      acc.sellerPhase.push(message)
    }
    return acc
  }, {
    botPhase: [] as Message[],
    sellerPhase: [] as Message[]
  })

  const hasBotPhase = organizedMessages.botPhase.length > 0
  const hasSellerPhase = organizedMessages.sellerPhase.length > 0

  return (
    <div className="space-y-4">
      {/* Fase do Bot */}
      {hasBotPhase && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 py-2 border-b border-border/50">
            <Bot className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">
              Atendimento Bot Dify
            </span>
            <Badge variant="secondary" className="text-xs">
              {organizedMessages.botPhase.length} mensagens
            </Badge>
          </div>
          
          <div className="space-y-2 ml-6">
            {organizedMessages.botPhase.map((message) => (
              <MessageBubble
                key={message.id}
                content={message.content}
                sender_type={message.sender_type as any}
                sender_name={message.sender_name || (message.sender_type === 'bot' ? 'Drystore Bot' : 'Cliente')}
                message_type={message.message_type as any}
                media_url={message.media_url}
                created_at={message.created_at}
                metadata={message}
              />
            ))}
          </div>
        </div>
      )}

      {/* Transição Bot → Vendedor */}
      {hasBotPhase && hasSellerPhase && (
        <div className="flex items-center gap-2 py-3 border-y border-border/30 bg-muted/30">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Lead transferido para {sellerName}
          </span>
          {leadTransferredAt && (
            <span className="text-xs text-muted-foreground/70">
              em {new Date(leadTransferredAt).toLocaleDateString('pt-BR')} às{' '}
              {new Date(leadTransferredAt).toLocaleTimeString('pt-BR', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </span>
          )}
        </div>
      )}

      {/* Fase do Vendedor */}
      {hasSellerPhase && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 py-2 border-b border-border/50">
            <UserCheck className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">
              Atendimento {sellerName}
            </span>
            <Badge variant="secondary" className="text-xs">
              {organizedMessages.sellerPhase.length} mensagens
            </Badge>
          </div>
          
          <div className="space-y-2 ml-6">
            {organizedMessages.sellerPhase.map((message) => (
              <MessageBubble
                key={message.id}
                content={message.content}
                sender_type={message.sender_type as any}
                sender_name={message.sender_name || (message.sender_type === 'seller' ? sellerName : 'Cliente')}
                message_type={message.message_type as any}
                media_url={message.media_url}
                created_at={message.created_at}
                metadata={message}
              />
            ))}
          </div>
        </div>
      )}

      {/* Estado quando não há mensagens */}
      {!hasBotPhase && !hasSellerPhase && (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <div className="text-center">
            <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma mensagem encontrada</p>
          </div>
        </div>
      )}

      {/* Status da conversa */}
      <div className="flex items-center justify-center pt-4 border-t border-border/30">
        <Badge 
          variant={conversationStatus === 'finished' ? 'secondary' : 'default'}
          className="text-xs"
        >
          Status: {conversationStatus === 'bot_attending' ? 'Bot Atendendo' : 
                   conversationStatus === 'sent_to_seller' ? 'Com Vendedor' : 
                   conversationStatus === 'finished' ? 'Finalizada' : conversationStatus}
        </Badge>
      </div>
    </div>
  )
}