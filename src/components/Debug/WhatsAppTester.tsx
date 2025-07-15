import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useWhatsAppTest, useConnectionStatus } from "@/hooks/useDebugData";
import { Send, CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";

export default function WhatsAppTester() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [message, setMessage] = useState("");
  const { toast } = useToast();
  
  const { mutate: sendTest, isPending } = useWhatsAppTest();
  const { data: connectionStatus } = useConnectionStatus();

  const handleTest = () => {
    if (!phoneNumber.trim() || !message.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o número de telefone e a mensagem",
        variant: "destructive",
      });
      return;
    }

    // Formatar número (remover caracteres especiais)
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    
    sendTest(
      { to: cleanNumber, content: message },
      {
        onSuccess: (data) => {
          toast({
            title: "✅ Mensagem enviada!",
            description: `Teste realizado com sucesso para ${phoneNumber}`,
          });
          setMessage("");
        },
        onError: (error) => {
          toast({
            title: "❌ Erro no teste",
            description: error.message || "Falha ao enviar mensagem de teste",
            variant: "destructive",
          });
        },
      }
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'disconnected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'not_configured':
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
      default:
        return <Loader2 className="h-4 w-4 animate-spin text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'disconnected':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'error':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'not_configured':
        return 'bg-gray-50 text-gray-700 border-gray-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'connected':
        return 'Conectado';
      case 'disconnected':
        return 'Desconectado';
      case 'error':
        return 'Erro';
      case 'not_configured':
        return 'Não Configurado';
      default:
        return 'Verificando...';
    }
  };

  return (
    <div className="space-y-6">
      {/* Status das Conexões */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5" />
            <span>Status das Integrações</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {connectionStatus && Object.entries(connectionStatus).map(([service, status]) => {
              if (service === 'recent_errors') return null;
              
              return (
                <div key={service} className="flex items-center space-x-2">
                  {getStatusIcon(status as string)}
                  <span className="text-sm font-medium capitalize">
                    {service.replace('_', ' ')}
                  </span>
                  <Badge 
                    variant="outline" 
                    className={getStatusColor(status as string)}
                  >
                    {getStatusLabel(status as string)}
                  </Badge>
                </div>
              );
            })}
          </div>
          
          {connectionStatus?.recent_errors && Array.isArray(connectionStatus.recent_errors) && connectionStatus.recent_errors.length > 0 && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="text-sm font-medium text-red-800 mb-2">
                ⚠️ Erros Recentes (últimos 5 min):
              </h4>
              <div className="space-y-1">
                {connectionStatus.recent_errors.slice(0, 3).map((error: any, index: number) => (
                  <p key={index} className="text-xs text-red-700">
                    • {error.message}
                  </p>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Teste de Envio */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Send className="h-5 w-5" />
            <span>Teste de Envio WhatsApp</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="phone">Número de Teste</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="5511999999999"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Formato: código do país + DDD + número (ex: 5511999999999)
              </p>
            </div>
            
            <div>
              <Label htmlFor="message">Mensagem de Teste</Label>
              <Textarea
                id="message"
                placeholder="Digite sua mensagem de teste aqui..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>
            
            <Button 
              onClick={handleTest} 
              disabled={isPending || !phoneNumber.trim() || !message.trim()}
              className="w-full"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar Teste
                </>
              )}
            </Button>
            
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>💡 Dica:</strong> Use seu próprio número para testar o envio. 
                A mensagem será enviada via API oficial do WhatsApp.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}