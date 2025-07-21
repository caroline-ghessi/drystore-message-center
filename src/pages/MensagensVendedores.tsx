import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  UserPlus,
  Users,
  MessageCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSellers } from "@/hooks/useSellers";
import { DeliveryStatusPanel } from "@/components/WhatsApp/DeliveryStatusPanel";

export default function MensagensVendedores() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const { sellers, isLoading, error } = useSellers();

  useEffect(() => {
    if (error) {
      toast({
        title: "Erro ao carregar vendedores",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [error, toast]);


  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Mensagens dos Vendedores</h1>
        <Badge variant="secondary">
          {sellers?.length || 0} vendedores ativos
        </Badge>
      </div>

      {/* Painel de Status de Entrega */}
      <DeliveryStatusPanel />

      <Tabs defaultValue="monitoring" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="monitoring">Monitoramento</TabsTrigger>
          <TabsTrigger value="sellers">Vendedores</TabsTrigger>
        </TabsList>
        <TabsContent value="monitoring" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MessageCircle className="h-5 w-5" />
                <span>Monitoramento de Mensagens</span>
              </CardTitle>
              <CardDescription>
                Acompanhe as conversas dos vendedores em tempo real
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Em desenvolvimento - Painel de conversas dos vendedores
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="sellers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Lista de Vendedores</span>
              </CardTitle>
              <CardDescription>
                Vendedores configurados no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="text-sm text-muted-foreground mt-2">Carregando vendedores...</p>
                  </div>
                ) : sellers && sellers.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {sellers.map((seller) => (
                      <Card key={seller.id}>
                        <CardHeader>
                          <CardTitle className="text-sm">{seller.name}</CardTitle>
                          <CardDescription>{seller.phone_number}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <Badge variant={seller.active ? "default" : "secondary"}>
                            {seller.active ? "Ativo" : "Inativo"}
                          </Badge>
                        </CardContent>
                      </Card>
                    ))}
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
