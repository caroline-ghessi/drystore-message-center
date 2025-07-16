import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, AlertTriangle, CheckCircle } from "lucide-react";

export function MediaRetryTest() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const { toast } = useToast();

  const handleRetryMedia = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('retry-media-processing');
      
      if (error) {
        throw error;
      }

      setLastResult(data);
      
      if (data.success) {
        toast({
          title: "Retry concluído!",
          description: `Processadas: ${data.processed} | Sucesso: ${data.successful} | Falhas: ${data.failed}`,
        });
      } else {
        throw new Error(data.error || 'Erro desconhecido');
      }
    } catch (error: any) {
      console.error('Erro ao executar retry:', error);
      toast({
        title: "Erro no retry",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <RefreshCw className="h-5 w-5" />
          <span>Retry de Processamento de Mídia</span>
        </CardTitle>
        <CardDescription>
          Reprocessa mídias que falharam ou não foram processadas ainda
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={handleRetryMedia}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Executar Retry de Mídia
            </>
          )}
        </Button>

        {lastResult && (
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <h4 className="font-semibold mb-2 flex items-center">
              {lastResult.success ? (
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />
              )}
              Último Resultado
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Total encontradas: {lastResult.total_found || 0}</div>
              <div>Processadas: {lastResult.processed || 0}</div>
              <div>Sucessos: {lastResult.successful || 0}</div>
              <div>Falhas: {lastResult.failed || 0}</div>
            </div>
            {lastResult.error && (
              <div className="mt-2 text-sm text-red-500">
                Erro: {lastResult.error}
              </div>
            )}
          </div>
        )}

        <div className="text-sm text-muted-foreground">
          <p><strong>Como funciona:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Busca mensagens com mídia não processada ou que falharam</li>
            <li>Tenta processar novamente usando o whatsapp-media-processor</li>
            <li>Atualiza as URLs das mídias no banco de dados</li>
            <li>Processa até 10 mensagens por vez</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}