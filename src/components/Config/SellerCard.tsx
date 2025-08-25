import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { 
  User, 
  Settings, 
  TestTube, 
  Copy, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUpdateSeller } from "@/hooks/useSellers";
import { Tables } from "@/integrations/supabase/types";

type Seller = Tables<"sellers">;

interface SellerCardProps {
  seller: Seller;
  onDelete: (id: string) => Promise<void>;
  onTestIntegration: (id: string, token: string) => Promise<boolean>;
}

export default function SellerCard({ seller, onDelete, onTestIntegration }: SellerCardProps) {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const updateSeller = useUpdateSeller();

  const getStatusColor = (whapiStatus: string | null, active: boolean | null) => {
    if (!active) return 'bg-gray-100 text-gray-800 border-gray-200';
    
    switch (whapiStatus) {
      case 'connected': return 'bg-green-100 text-green-800 border-green-200';
      case 'testing': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'error': return 'bg-red-100 text-red-800 border-red-200';
      case 'disconnected':
      default: return 'bg-orange-100 text-orange-800 border-orange-200';
    }
  };

  const getStatusIcon = (whapiStatus: string | null, active: boolean | null) => {
    if (!active) return <XCircle className="h-4 w-4" />;
    
    switch (whapiStatus) {
      case 'connected': return <CheckCircle className="h-4 w-4" />;
      case 'testing': return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'error': return <AlertCircle className="h-4 w-4" />;
      case 'disconnected':
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };
  
  const getStatusText = (whapiStatus: string | null, active: boolean | null) => {
    if (!active) return 'Inativo';
    
    switch (whapiStatus) {
      case 'connected': return 'Conectado';
      case 'testing': return 'Testando';
      case 'error': return 'Erro';
      case 'disconnected':
      default: return 'Desconectado';
    }
  };

  const copyWebhookUrl = () => {
    const webhookUrl = seller.whapi_webhook_url || `https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/whapi-webhook/${seller.id}`;
    navigator.clipboard.writeText(webhookUrl);
    toast({
      title: "URL copiada!",
      description: "URL do webhook copiada para área de transferência.",
    });
  };

  const handleTestIntegration = async () => {
    if (!token.trim()) {
      toast({
        title: "Token necessário",
        description: "Por favor, insira o token da WHAPI para testar a integração.",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(true);
    try {
      const success = await onTestIntegration(seller.id, token);
      
      if (success) {
        await updateSeller.mutateAsync({
          id: seller.id,
          whapi_status: 'connected',
          whapi_last_test: new Date().toISOString(),
          whapi_token: token
        });
        toast({
          title: "Integração testada com sucesso!",
          description: "A conexão com a WHAPI está funcionando corretamente.",
        });
      } else {
        await updateSeller.mutateAsync({
          id: seller.id,
          whapi_status: 'error',
          whapi_last_test: new Date().toISOString(),
          whapi_error_message: 'Falha na conexão com WHAPI'
        });
        toast({
          title: "Falha no teste",
          description: "Não foi possível conectar com a WHAPI. Verifique o token.",
          variant: "destructive",
        });
      }
    } catch (error) {
      await updateSeller.mutateAsync({
        id: seller.id,
        whapi_status: 'error',
        whapi_last_test: new Date().toISOString(),
        whapi_error_message: error instanceof Error ? error.message : 'Erro desconhecido'
      });
      toast({
        title: "Erro no teste",
        description: "Ocorreu um erro ao testar a integração.",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const toggleActive = async () => {
    try {
      console.log("🔄 Alterando status ativo do vendedor:", seller.name, "de", seller.active, "para", !seller.active);
      
      await updateSeller.mutateAsync({
        id: seller.id,
        active: !seller.active
      });
      
      toast({
        title: seller.active ? "Vendedor desativado" : "Vendedor ativado",
        description: `${seller.name} foi ${seller.active ? 'desativado' : 'ativado'} com sucesso.`,
      });
    } catch (error) {
      console.error("❌ Erro ao alterar status ativo:", error);
      toast({
        title: "Erro",
        description: "Não foi possível alterar o status do vendedor.",
        variant: "destructive",
      });
    }
  };

  const toggleAutoMessage = async () => {
    try {
      await updateSeller.mutateAsync({
        id: seller.id,
        auto_first_message: !seller.auto_first_message
      });
      
      toast({
        title: seller.auto_first_message ? "Mensagem automática desativada" : "Mensagem automática ativada",
        description: `Mensagem automática ${seller.auto_first_message ? 'desativada' : 'ativada'} para ${seller.name}.`,
      });
    } catch (error) {
      console.error("❌ Erro ao alterar mensagem automática:", error);
      toast({
        title: "Erro",
        description: "Não foi possível alterar a configuração de mensagem automática.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    console.log("🎯 Iniciando exclusão do vendedor:", seller.name, seller.id);
    setIsDeleting(true);
    try {
      await onDelete(seller.id);
      console.log("✅ Vendedor excluído com sucesso no SellerCard");
    } catch (error) {
      console.error("❌ Erro na exclusão do vendedor no SellerCard:", error);
      // Error handling is done in the parent component
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className={`shadow-card ${!seller.active ? 'opacity-60' : ''}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5 text-drystore-orange" />
            <span>{seller.name}</span>
            {!seller.active && (
              <Badge variant="secondary" className="ml-2 text-xs">
                Inativo
              </Badge>
            )}
          </CardTitle>
          <Badge className={getStatusColor(seller.whapi_status, seller.active)}>
            {getStatusIcon(seller.whapi_status, seller.active)}
            <span className="ml-1">{getStatusText(seller.whapi_status, seller.active)}</span>
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            <strong>Telefone:</strong> {seller.phone_number}
          </p>
          <div className="flex items-center space-x-2">
            <code className="text-xs bg-muted p-1 rounded flex-1 truncate">
              {seller.whapi_webhook_url || `https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/whapi-webhook/${seller.id}`}
            </code>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={copyWebhookUrl}
              className="px-2"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Switch
              checked={seller.active || false}
              onCheckedChange={toggleActive}
              disabled={isTesting || updateSeller.isPending}
            />
            <Label className="text-sm">Ativo</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              checked={seller.auto_first_message || false}
              onCheckedChange={toggleAutoMessage}
              disabled={updateSeller.isPending}
            />
            <Label className="text-sm">Msg. Automática</Label>
          </div>
        </div>

        <div className="flex space-x-2">
          <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="flex-1">
                <Settings className="h-4 w-4 mr-1" />
                Configurar
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Configurar Integração - {seller.name}</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="webhook">URL do Webhook</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Input
                      id="webhook"
                      value={seller.whapi_webhook_url || `https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/whapi-webhook/${seller.id}`}
                      readOnly
                      className="flex-1"
                    />
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={copyWebhookUrl}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Use esta URL no painel da WHAPI
                  </p>
                </div>

                <div>
                  <Label htmlFor="token">Token da WHAPI</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Input
                      id="token"
                      type={showToken ? "text" : "password"}
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="Insira o token da WHAPI"
                      className="flex-1"
                    />
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setShowToken(!showToken)}
                    >
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Token será armazenado de forma segura
                  </p>
                </div>

                <div className="flex space-x-2">
                  <Button 
                    onClick={handleTestIntegration}
                    disabled={isTesting || !token.trim()}
                    className="flex-1"
                  >
                    {isTesting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <TestTube className="h-4 w-4 mr-2" />
                    )}
                    Testar Integração
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsConfigOpen(false)}
                  >
                    Fechar
                  </Button>
                </div>

                {seller.whapi_last_test && (
                  <p className="text-xs text-muted-foreground">
                    Último teste: {new Date(seller.whapi_last_test).toLocaleString()}
                  </p>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                size="sm" 
                variant="destructive"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Excluir"
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o vendedor <strong>{seller.name}</strong>? 
                Esta ação irá remover o vendedor da plataforma. Ele não aparecerá mais em nenhuma lista.
                O histórico de conversas e leads será mantido para fins de auditoria.
              </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Confirmar exclusão
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}