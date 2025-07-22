import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
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
        description: `Mensagem de teste enviada para ${data.details.seller_name}`,
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
          Teste de Entrega WHAPI
        </CardTitle>
        <CardDescription>
          Enviar mensagem de teste para verificar se os vendedores estão recebendo leads
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Vendedor</label>
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
              Enviar Teste
            </>
          )}
        </Button>

        {lastTestResult && (
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Último teste realizado</span>
            </div>
            <div className="text-sm space-y-1">
              <p><strong>Vendedor:</strong> {lastTestResult.details?.seller_name}</p>
              <p><strong>Número:</strong> {lastTestResult.details?.phone_number}</p>
              <p><strong>Status:</strong> {lastTestResult.success ? 'Enviado' : 'Falhou'}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};