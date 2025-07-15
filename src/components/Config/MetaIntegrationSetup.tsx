
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function MetaIntegrationSetup() {
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const { toast } = useToast();

  const setupIntegration = async () => {
    setIsConfiguring(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('setup-meta-integration');
      
      if (error) throw error;
      
      if (data.success) {
        setIsConfigured(true);
        toast({
          title: "✅ Integração Configurada!",
          description: "A API oficial do WhatsApp foi configurada com sucesso.",
        });
      } else {
        throw new Error(data.error || 'Erro desconhecido');
      }
    } catch (error) {
      console.error('Erro ao configurar integração:', error);
      toast({
        title: "❌ Erro na Configuração",
        description: error.message || "Erro ao configurar a integração",
        variant: "destructive",
      });
    } finally {
      setIsConfiguring(false);
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          {isConfigured ? (
            <CheckCircle className="h-5 w-5 text-green-600" />
          ) : (
            <AlertCircle className="h-5 w-5 text-orange-500" />
          )}
          <span>Configuração da API Meta WhatsApp</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Configure a integração com a API oficial do WhatsApp Business usando os dados que você forneceu.
          </p>
          
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-2">📋 Dados Configurados:</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>✅ Meta Access Token</li>
              <li>✅ Phone Number ID</li>
              <li>✅ Business Account ID</li>
              <li>✅ Meta App ID</li>
              <li>✅ Webhook URL configurada</li>
            </ul>
          </div>

          {isConfigured ? (
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-green-800 font-medium">🎉 Integração ativa e funcionando!</p>
              <p className="text-sm text-green-700 mt-1">
                Agora você pode receber e enviar mensagens através da API oficial do WhatsApp.
              </p>
            </div>
          ) : (
            <Button 
              onClick={setupIntegration} 
              disabled={isConfiguring}
              className="w-full"
            >
              {isConfiguring ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Configurando...
                </>
              ) : (
                'Finalizar Configuração'
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
