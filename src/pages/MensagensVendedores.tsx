
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, MessageCircle, History } from "lucide-react";
import { useSellers } from "@/hooks/useSellers";
import { useSellerConversations } from "@/hooks/useSellerConversations";
import { SellerConversationsList } from "@/components/Sellers/SellerConversationsList";
import { SellerConversationView } from "@/components/Sellers/SellerConversationView";

export default function MensagensVendedores() {
  const [selectedConversation, setSelectedConversation] = useState<string>("");
  const [selectedSeller, setSelectedSeller] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  
  const { sellers, isLoading: sellersLoading } = useSellers();
  const { data: conversations, isLoading: conversationsLoading } = useSellerConversations(
    selectedSeller || undefined,
    selectedStatus || undefined
  );

  const selectedConversationData = conversations?.find(conv => conv.id === selectedConversation);

  const activeConversations = conversations?.filter(conv => 
    conv.status === 'sent_to_seller' || conv.status === 'bot_attending'
  ) || [];

  const finishedConversations = conversations?.filter(conv => 
    conv.status === 'finished'
  ) || [];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Mensagens dos Vendedores</h1>
        <Badge variant="secondary">
          {activeConversations.length} conversas ativas
        </Badge>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="active">
            <MessageCircle className="w-4 h-4 mr-2" />
            Conversas Ativas
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="w-4 h-4 mr-2" />
            Histórico
          </TabsTrigger>
          <TabsTrigger value="sellers">
            <Users className="w-4 h-4 mr-2" />
            Vendedores
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[700px]">
            <SellerConversationsList
              conversations={activeConversations}
              selectedConversation={selectedConversation}
              onSelectConversation={setSelectedConversation}
              onSellerFilter={setSelectedSeller}
              onStatusFilter={setSelectedStatus}
              sellers={sellers || []}
            />
            
            <SellerConversationView
              conversationId={selectedConversation}
              conversation={selectedConversationData}
            />
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[700px]">
            <SellerConversationsList
              conversations={finishedConversations}
              selectedConversation={selectedConversation}
              onSelectConversation={setSelectedConversation}
              onSellerFilter={setSelectedSeller}
              onStatusFilter={() => setSelectedStatus('finished')}
              sellers={sellers || []}
            />
            
            <SellerConversationView
              conversationId={selectedConversation}
              conversation={selectedConversationData}
            />
          </div>
        </TabsContent>

        <TabsContent value="sellers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Lista de Vendedores</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sellersLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="text-sm text-muted-foreground mt-2">Carregando vendedores...</p>
                  </div>
                ) : sellers && sellers.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {sellers.map((seller) => {
                      const sellerConversations = conversations?.filter(conv => 
                        conv.seller_id === seller.id
                      ) || [];
                      const activeCount = sellerConversations.filter(conv => 
                        conv.status === 'sent_to_seller'
                      ).length;

                      return (
                        <Card key={seller.id} className="cursor-pointer hover:shadow-md transition-shadow"
                              onClick={() => setSelectedSeller(seller.id)}>
                          <CardHeader>
                            <CardTitle className="text-sm">{seller.name}</CardTitle>
                            <p className="text-xs text-muted-foreground">{seller.phone_number}</p>
                          </CardHeader>
                          <CardContent>
                            <div className="flex items-center justify-between">
                              <Badge variant={seller.active ? "default" : "secondary"}>
                                {seller.active ? "Ativo" : "Inativo"}
                              </Badge>
                              {activeCount > 0 && (
                                <Badge variant="outline">
                                  {activeCount} conversas
                                </Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Nenhum vendedor encontrado. Configure vendedores na página de Configurações.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
