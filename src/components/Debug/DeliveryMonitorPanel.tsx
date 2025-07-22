
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useDeliveryMonitoring } from "@/hooks/useDeliveryMonitoring";
import { Loader2, RefreshCw, AlertTriangle, CheckCircle, XCircle, Clock, Phone } from "lucide-react";

export const DeliveryMonitorPanel = () => {
  const [phoneToValidate, setPhoneToValidate] = useState("");
  const { toast } = useToast();
  
  const {
    pendingDeliveries,
    isLoading,
    isChecking,
    checkAllPendingStatus,
    retryFailedMessage,
    isRetrying,
    validatePhoneNumber
  } = useDeliveryMonitoring();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <Loader2 className="h-4 w-4 animate-spin text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'failed':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'pending':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const handleValidatePhone = () => {
    if (!phoneToValidate.trim()) {
      toast({
        title: "Erro",
        description: "Digite um número para validar",
        variant: "destructive"
      });
      return;
    }

    const result = validatePhoneNumber(phoneToValidate);
    
    if (result.isValid) {
      toast({
        title: "✅ Número válido",
        description: `Formatado: ${result.formatted}`,
      });
    } else {
      toast({
        title: "❌ Número inválido",
        description: result.warnings.join(', '),
        variant: "destructive"
      });
    }

    if (result.warnings.length > 0) {
      toast({
        title: "⚠️ Avisos",
        description: result.warnings.join(', '),
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Validador de Número */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Validador de Números
          </CardTitle>
          <CardDescription>
            Valide e formate números de telefone para WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Digite o número (ex: 51999999999)"
              value={phoneToValidate}
              onChange={(e) => setPhoneToValidate(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleValidatePhone}>
              Validar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Monitor de Entregas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Monitor de Entregas
          </CardTitle>
          <CardDescription>
            Acompanhe o status das mensagens enviadas nas últimas 24 horas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              {pendingDeliveries.length} mensagens encontradas
            </div>
            <Button 
              onClick={checkAllPendingStatus}
              disabled={isChecking || isLoading}
              size="sm"
            >
              {isChecking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Verificar Status
                </>
              )}
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Carregando mensagens...</span>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingDeliveries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma mensagem encontrada nas últimas 24 horas
                </div>
              ) : (
                pendingDeliveries.map((delivery) => (
                  <div
                    key={delivery.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(delivery.status)}
                      <div>
                        <div className="font-medium">{delivery.seller_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {delivery.seller_phone}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={getStatusColor(delivery.status)}
                      >
                        {delivery.status}
                      </Badge>
                      
                      {delivery.status === 'pending' && (
                        <div className="flex items-center gap-1 text-xs text-yellow-600">
                          <AlertTriangle className="h-3 w-3" />
                          Possível falso positivo
                        </div>
                      )}

                      {delivery.status === 'failed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => retryFailedMessage(delivery.id)}
                          disabled={isRetrying}
                        >
                          {isRetrying ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            'Reenviar'
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
