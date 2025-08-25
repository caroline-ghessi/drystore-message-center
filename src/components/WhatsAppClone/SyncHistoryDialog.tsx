import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, RefreshCw, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useSellers } from "@/hooks/useSellers";
import { supabase } from "@/integrations/supabase/client";

interface SyncHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function SyncHistoryDialog({ open, onOpenChange, onSuccess }: SyncHistoryDialogProps) {
  const [selectedSeller, setSelectedSeller] = useState<string>('');
  const [limitChats, setLimitChats] = useState<number>(50);
  const [limitMessages, setLimitMessages] = useState<number>(100);
  const [syncLoading, setSyncLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<any>(null);

  const { sellers, isLoading, error } = useSellers();

  const handleSync = async () => {
    if (!selectedSeller) {
      toast.error("Selecione um vendedor");
      return;
    }

    setSyncLoading(true);
    setStatus('syncing');
    setProgress(0);
    
    try {
      // Simular progresso
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const { data, error } = await supabase.functions.invoke('whapi-sync-history', {
        body: {
          sellerId: selectedSeller,
          limitChats,
          limitMessages
        }
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (error) throw error;

      setResult(data);
      setStatus('success');
      toast.success("Sincronização concluída com sucesso!");
      
      // Aguardar um pouco para mostrar o resultado
      setTimeout(() => {
        onSuccess();
        onOpenChange(false);
        handleReset();
      }, 2000);

    } catch (error: any) {
      setStatus('error');
      toast.error("Erro na sincronização: " + error.message);
      console.error('Erro na sincronização:', error);
    } finally {
      setSyncLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedSeller('');
    setLimitChats(50);
    setLimitMessages(100);
    setProgress(0);
    setStatus('idle');
    setResult(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!syncLoading) {
      onOpenChange(newOpen);
      if (!newOpen) {
        handleReset();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Sincronizar Histórico WHAPI
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {status === 'idle' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="seller">Vendedor</Label>
                <Select value={selectedSeller} onValueChange={setSelectedSeller}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um vendedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {sellers?.map((seller) => (
                      <SelectItem key={seller.id} value={seller.id}>
                        {seller.name} - {seller.phone_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="limitChats">Máx. Conversas</Label>
                  <Input
                    id="limitChats"
                    type="number"
                    min="1"
                    max="200"
                    value={limitChats}
                    onChange={(e) => setLimitChats(Number(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="limitMessages">Máx. Mensagens/Chat</Label>
                  <Input
                    id="limitMessages"
                    type="number"
                    min="1"
                    max="500"
                    value={limitMessages}
                    onChange={(e) => setLimitMessages(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="bg-muted/50 p-3 rounded-lg text-sm text-muted-foreground">
                <p><strong>Importante:</strong></p>
                <ul className="list-disc list-inside space-y-1 mt-1">
                  <li>Apenas conversas individuais serão sincronizadas</li>
                  <li>Grupos são automaticamente ignorados</li>
                  <li>Mensagens duplicadas são descartadas</li>
                </ul>
              </div>
            </>
          )}

          {status === 'syncing' && (
            <div className="space-y-4">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                <p className="font-medium">Sincronizando histórico...</p>
                <p className="text-sm text-muted-foreground">
                  Buscando conversas e mensagens do WHAPI
                </p>
              </div>
              
              <Progress value={progress} className="w-full" />
              
              <div className="text-center text-sm text-muted-foreground">
                {progress}% concluído
              </div>
            </div>
          )}

          {status === 'success' && result && (
            <div className="space-y-4">
              <div className="text-center">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
                <p className="font-medium text-green-700">Sincronização Concluída!</p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-medium text-green-800">Conversas</div>
                    <div className="text-green-600">{result.statistics?.conversations_created || 0}</div>
                  </div>
                  <div>
                    <div className="font-medium text-green-800">Mensagens</div>
                    <div className="text-green-600">{result.statistics?.messages_imported || 0}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-600" />
              <p className="font-medium text-red-700">Erro na Sincronização</p>
              <p className="text-sm text-muted-foreground mt-1">
                Verifique os logs para mais detalhes
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          {status === 'idle' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSync} disabled={!selectedSeller}>
                Iniciar Sincronização
              </Button>
            </>
          )}

          {status === 'syncing' && (
            <Button disabled>
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              Sincronizando...
            </Button>
          )}

          {(status === 'success' || status === 'error') && (
            <Button onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}