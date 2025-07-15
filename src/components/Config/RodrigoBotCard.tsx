import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Bot, 
  Settings, 
  TestTube, 
  Copy, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Loader2,
  MessageCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RodrigoBotProps {
  status: 'active' | 'inactive' | 'testing' | 'error';
  webhook_url: string;
  phone_number: string;
  last_test?: string;
  messages_sent_today?: number;
  onUpdate: (data: any) => void;
  onTestIntegration: (token: string) => Promise<boolean>;
}

export default function RodrigoBotCard({ 
  status, 
  webhook_url, 
  phone_number,
  last_test,
  messages_sent_today = 0,
  onUpdate, 
  onTestIntegration 
}: RodrigoBotProps) {
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
    navigator.clipboard.writeText(webhook_url);
    toast({
      title: "URL copiada!",
      description: "URL do webhook do Rodrigo Bot copiada para área de transferência.",
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
      const success = await onTestIntegration(token);
      
      if (success) {
        onUpdate({
          status: 'active',
          last_test: new Date().toISOString()
        });
        toast({
          title: "Rodrigo Bot conectado com sucesso!",
          description: "A integração com a WHAPI está funcionando corretamente.",
        });
      } else {
        onUpdate({
          status: 'error',
          last_test: new Date().toISOString()
        });
        toast({
          title: "Falha na conexão",
          description: "Não foi possível conectar o Rodrigo Bot. Verifique o token.",
          variant: "destructive",
        });
      }
    } catch (error) {
      onUpdate({
        status: 'error',
        last_test: new Date().toISOString()
      });
      toast({
        title: "Erro na integração",
        description: "Ocorreu um erro ao testar a integração do Rodrigo Bot.",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card className="shadow-card border-drystore-orange/20">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Bot className="h-5 w-5 text-drystore-orange" />
            <span>Rodrigo Bot</span>
          </CardTitle>
          <Badge className={getStatusColor(status)}>
            {getStatusIcon(status)}
            <span className="ml-1 capitalize">{status}</span>
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            <strong>Número:</strong> {phone_number}
          </p>
          <div className="flex items-center space-x-2">
            <code className="text-xs bg-muted p-1 rounded flex-1 truncate">
              {webhook_url}
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

        <div className="flex items-center justify-between bg-muted/50 p-3 rounded-lg">
          <div className="flex items-center space-x-2">
            <MessageCircle className="h-4 w-4 text-drystore-orange" />
            <span className="text-sm">Mensagens hoje:</span>
          </div>
          <Badge variant="secondary">{messages_sent_today}</Badge>
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
                <DialogTitle>Configurar Rodrigo Bot</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="bot-webhook">URL do Webhook</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Input
                      id="bot-webhook"
                      value={webhook_url}
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
                    Use esta URL no painel da WHAPI para o Rodrigo Bot
                  </p>
                </div>

                <div>
                  <Label htmlFor="bot-token">Token da WHAPI</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Input
                      id="bot-token"
                      type={showToken ? "text" : "password"}
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="Insira o token da WHAPI para o Rodrigo Bot"
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
                    Token será armazenado de forma segura nos Secrets do Supabase
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

                {last_test && (
                  <p className="text-xs text-muted-foreground">
                    Último teste: {new Date(last_test).toLocaleString()}
                  </p>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}