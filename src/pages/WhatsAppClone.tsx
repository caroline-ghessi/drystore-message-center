import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, MessageSquare, Users, Clock } from "lucide-react";
import { toast } from "sonner";
import { ConversationsList } from "@/components/WhatsAppClone/ConversationsList";
import { MessageViewer } from "@/components/WhatsAppClone/MessageViewer";
import { SyncHistoryDialog } from "@/components/WhatsAppClone/SyncHistoryDialog";
import { useConversations } from "@/hooks/useConversations";
import { useConversationMessages } from "@/hooks/useConversationMessages";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";

export default function WhatsAppClone() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showSyncDialog, setShowSyncDialog] = useState(false);

  const { data: conversations, refetch: refetchConversations } = useConversations();
  const { data: messages } = useConversationMessages(selectedConversationId);
  const { data: metrics } = useDashboardMetrics();

  const handleRefresh = () => {
    refetchConversations();
    toast.success("Conversas atualizadas");
  };

  const selectedConversation = conversations?.find(c => c.id === selectedConversationId);

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar - Lista de Conversas */}
      <div className="w-1/3 border-r border-border flex flex-direction-column">
        {/* Header */}
        <div className="p-4 bg-card border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              WhatsApp Clone
            </h1>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSyncDialog(true)}
              >
                Sincronizar
              </Button>
            </div>
          </div>

          {/* Métricas Rápidas */}
          <div className="grid grid-cols-3 gap-2">
            <Card className="p-2 text-center">
              <div className="text-lg font-bold text-primary">
                {conversations?.length || 0}
              </div>
              <div className="text-xs text-muted-foreground">
                Conversas
              </div>
            </Card>
            <Card className="p-2 text-center">
              <div className="text-lg font-bold text-emerald-600">
                {conversations?.filter(c => c.status === 'bot_attending').length || 0}
              </div>
              <div className="text-xs text-muted-foreground">
                Ativas
              </div>
            </Card>
            <Card className="p-2 text-center">
              <div className="text-lg font-bold text-orange-600">
                {conversations?.filter(c => c.status === 'sent_to_seller').length || 0}
              </div>
              <div className="text-xs text-muted-foreground">
                Vendedores
              </div>
            </Card>
          </div>
        </div>

        {/* Lista de Conversas */}
        <ScrollArea className="flex-1">
          <ConversationsList
            conversations={conversations || []}
            selectedId={selectedConversationId}
            onSelect={setSelectedConversationId}
          />
        </ScrollArea>
      </div>

      {/* Área Principal - Visualizador de Mensagens */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <MessageViewer
            conversation={selectedConversation}
            messages={messages || []}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-muted/30">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">
                Selecione uma conversa
              </h2>
              <p className="text-muted-foreground">
                Escolha uma conversa na lista para visualizar as mensagens
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Dialog de Sincronização */}
      <SyncHistoryDialog
        open={showSyncDialog}
        onOpenChange={setShowSyncDialog}
        onSuccess={() => {
          refetchConversations();
          toast.success("Histórico sincronizado com sucesso!");
        }}
      />
    </div>
  );
}