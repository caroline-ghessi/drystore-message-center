import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Circle,
  Copy,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
  Whatsapp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSellers, useDeleteSeller, useUpdateSeller } from "@/hooks/useSellers";
import { DataTable } from "@/components/ui/data-table";
import { columns } from "@/components/Sellers/columns";
import { SellerForm } from "@/components/Sellers/seller-form";
import { AlertDialogDemo } from "@/components/ui/alert-dialog";
import { useConversations } from "@/hooks/useConversations";
import { Link } from "react-router-dom";
import { DeliveryStatusPanel } from "@/components/WhatsApp/DeliveryStatusPanel";

export default function MensagensVendedores() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { sellers, isLoading, error } = useSellers();
  const { mutate: deleteSeller, isLoading: isDeleting } = useDeleteSeller();
  const { mutate: updateSeller, isLoading: isUpdating } = useUpdateSeller();
  const { data: conversations } = useConversations(searchTerm);

  useEffect(() => {
    if (error) {
      toast({
        title: "Erro ao carregar vendedores",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [error, toast]);

  const handleDelete = (sellerId: string) => {
    deleteSeller(sellerId, {
      onSuccess: () => {
        toast({
          title: "Vendedor excluído",
          description: "O vendedor foi removido com sucesso.",
        });
      },
      onError: (error: any) => {
        toast({
          title: "Erro ao excluir vendedor",
          description: error.message,
          variant: "destructive",
        });
      },
    });
  };

  const handleActiveToggle = async (sellerId: string, active: boolean) => {
    updateSeller({ id: sellerId, active: active });
  };

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

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="active">Ativos</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Lista de Vendedores</CardTitle>
              <CardDescription>
                Gerencie seus vendedores e suas configurações.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center mb-4">
                <Input
                  type="search"
                  placeholder="Buscar vendedor..."
                  className="max-w-sm"
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Button onClick={() => setOpen(true)}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Adicionar Vendedor
                </Button>
              </div>
              <DataTable columns={columns} data={sellers} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="active" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Vendedores Ativos</CardTitle>
              <CardDescription>
                Veja os vendedores que estão ativos no sistema.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {sellers?.map((seller) => (
                  <Card key={seller.id}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        {seller.name}
                        <AlertDialogDemo
                          onConfirm={() => handleDelete(seller.id)}
                          disabled={isDeleting}
                        />
                      </CardTitle>
                      <CardDescription>{seller.phone_number}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Label>Ativo:</Label>
                        <Button
                          variant="outline"
                          onClick={() =>
                            handleActiveToggle(seller.id, !seller.active)
                          }
                          disabled={isUpdating}
                        >
                          {seller.active ? "Desativar" : "Ativar"}
                        </Button>
                      </div>
                      <p>Leads Atendidos: 12</p>
                      <p>Leads Qualificados: 8</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <SellerForm open={open} setOpen={setOpen} />
    </div>
  );
}
