
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, ArrowRight, Bot, User } from "lucide-react";
import { useSellers } from "@/hooks/useSellers";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, CheckCircle } from "lucide-react";

export const DeliveryTestPanel = () => {
  const [selectedSeller, setSelectedSeller] = useState<string>("");
  const [testMessage, setTestMessage] = useState("✅ Teste de entrega - WhatsApp funcionando!");
  const [isLoading, setIsLoading] = useState(false);
  const [lastTestResult, setLastTestResult] = useState<any>(null);
  
  const { toast } = useToast();
  const { sellers } = useSellers();

  const handleTest = async () => {
    if (!selectedSeller) {
      toast({
        title: "Erro",
        description: "Selecione um vendedor para testar",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-seller-delivery', {
        body: {
          sellerId: selectedSeller,
          testMessage
        }
      });

      if (error) throw error;

      setLastTestResult(data);
      toast({
        title: "Teste enviado!",
        description: `Mensagem enviada DO Rodrigo Bot PARA ${data.details.recipient}`,
      });
    } catch (error: any) {
      console.error('Erro no teste:', error);
      toast({
        title: "Erro no teste",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Teste de Entrega WHAPI - Fluxo Correto
        </CardTitle>
        <CardDescription>
          <div className="flex items-center gap-2 mt-2 p-2 bg-green-50 rounded-lg border border-green-200">
            <Bot className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-800">Rodrigo Bot (51981155622)</span>
            <ArrowRight className="h-4 w-4 text-green-600" />
            <User className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-800">Vendedor</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            O teste envia mensagem DO número oficial da empresa PARA o vendedor
          </p>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Vendedor (Destinatário)</label>
          <Select value={selectedSeller} onValueChange={setSelectedSeller}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um vendedor" />
            </SelectTrigger>
            <SelectContent>
              {sellers?.filter(s => s.active && !s.deleted).map((seller) => (
                <SelectItem key={seller.id} value={seller.id}>
                  {seller.name} - {seller.phone_number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Mensagem de teste</label>
          <Textarea
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            placeholder="Digite a mensagem de teste..."
            rows={3}
          />
        </div>

        <Button 
          onClick={handleTest} 
          disabled={isLoading || !selectedSeller}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enviando teste...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Enviar Teste (Bot → Vendedor)
            </>
          )}
        </Button>

        {lastTestResult && (
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Último teste realizado</span>
              <Badge variant={lastTestResult.success ? "default" : "destructive"}>
                {lastTestResult.success ? "Sucesso" : "Falha"}
              </Badge>
            </div>
            
            <div className="mb-3">
              <Badge variant="secondary" className="mb-2">
                Fluxo de mensagem CORRETO
              </Badge>
              <div className="flex items-center gap-2 px-3 py-2 bg-card rounded-md border">
                <Bot className="h-4 w-4 text-orange-600" />
                <span className="text-xs font-semibold text-orange-600">
                  Rodrigo Bot ({lastTestResult.details?.sender_phone})
                </span>
                <ArrowRight className="h-3 w-3 text-green-600" />
                <User className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-semibold text-blue-600">
                  {lastTestResult.details?.recipient} ({lastTestResult.details?.recipient_phone})
                </span>
              </div>
            </div>
            
            <div className="text-sm space-y-1">
              <p><strong>Remetente:</strong> {lastTestResult.details?.sender} ({lastTestResult.details?.sender_phone})</p>
              <p><strong>Destinatário:</strong> {lastTestResult.details?.recipient} ({lastTestResult.details?.recipient_phone})</p>
              <p><strong>Direção:</strong> <Badge variant="outline">{lastTestResult.details?.message_direction}</Badge></p>
              <p><strong>Token usado:</strong> {lastTestResult.details?.token_used}</p>
              {lastTestResult.details?.send_result?.message_id && (
                <p><strong>ID da Mensagem:</strong> {lastTestResult.details.send_result.message_id}</p>
              )}
            </div>

            {lastTestResult.details?.expected_whatsapp_behavior && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="text-sm font-medium text-blue-800 mb-2">
                  📱 Como deve aparecer no WhatsApp:
                </h4>
                <div className="text-xs text-blue-700 space-y-1">
                  <p><strong>No WhatsApp do Rodrigo Bot:</strong> {lastTestResult.details.expected_whatsapp_behavior.rodrigo_bot_whatsapp}</p>
                  <p><strong>No WhatsApp do Vendedor:</strong> {lastTestResult.details.expected_whatsapp_behavior.seller_whatsapp}</p>
                </div>
              </div>
            )}

            <div className="mt-3 p-2 bg-yellow-50 rounded border border-yellow-200">
              <p className="text-xs text-yellow-800">
                <AlertCircle className="h-3 w-3 inline mr-1" />
                Se a mensagem apareceu invertida, verifique se o token WHAPI_TOKEN_5551981155622 está correto
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
