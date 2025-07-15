import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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

interface Seller {
  id: string;
  name: string;
  phone_number: string;
  webhook_url: string;
  status: 'active' | 'inactive' | 'testing' | 'error';
  auto_first_message: boolean;
  created_at: string;
  last_test?: string;
}

interface SellerCardProps {
  seller: Seller;
  onUpdate: (seller: Seller) => void;
  onDelete: (id: string) => void;
  onTestIntegration: (id: string, token: string) => Promise<boolean>;
}

export default function SellerCard({ seller, onUpdate, onDelete, onTestIntegration }: SellerCardProps) {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const { toast } = useToast();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'inactive': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'testing': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'error': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4" />;
      case 'inactive': return <XCircle className="h-4 w-4" />;
      case 'testing': return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'error': return <AlertCircle className="h-4 w-4" />;
      default: return <XCircle className="h-4 w-4" />;
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(seller.webhook_url);
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
        onUpdate({
          ...seller,
          status: 'active',
          last_test: new Date().toISOString()
        });
        toast({
          title: "Integração testada com sucesso!",
          description: "A conexão com a WHAPI está funcionando corretamente.",
        });
      } else {
        onUpdate({
          ...seller,
          status: 'error',
          last_test: new Date().toISOString()
        });
        toast({
          title: "Falha no teste",
          description: "Não foi possível conectar com a WHAPI. Verifique o token.",
          variant: "destructive",
        });
      }
    } catch (error) {
      onUpdate({
        ...seller,
        status: 'error',
        last_test: new Date().toISOString()
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

  const toggleActive = () => {
    onUpdate({
      ...seller,
      status: seller.status === 'active' ? 'inactive' : 'active'
    });
  };

  const toggleAutoMessage = () => {
    onUpdate({
      ...seller,
      auto_first_message: !seller.auto_first_message
    });
  };

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5 text-drystore-orange" />
            <span>{seller.name}</span>
          </CardTitle>
          <Badge className={getStatusColor(seller.status)}>
            {getStatusIcon(seller.status)}
            <span className="ml-1 capitalize">{seller.status}</span>
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
              {seller.webhook_url}
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
              checked={seller.status === 'active'}
              onCheckedChange={toggleActive}
              disabled={isTesting}
            />
            <Label className="text-sm">Ativo</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              checked={seller.auto_first_message}
              onCheckedChange={toggleAutoMessage}
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
                      value={seller.webhook_url}
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

                {seller.last_test && (
                  <p className="text-xs text-muted-foreground">
                    Último teste: {new Date(seller.last_test).toLocaleString()}
                  </p>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Button 
            size="sm" 
            variant="destructive" 
            onClick={() => onDelete(seller.id)}
          >
            Excluir
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}