import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowRight, 
  ArrowLeft, 
  User, 
  Phone, 
  MessageSquare,
  CheckCircle,
  Loader2
} from "lucide-react";
import { useSellers } from "@/hooks/useSellers";
import { useManualTransfer } from "@/hooks/useManualTransfer";

interface ManualTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string | null;
  customerName?: string;
  phoneNumber?: string;
}

type Step = 1 | 2 | 3;

export function ManualTransferDialog({
  open,
  onOpenChange,
  conversationId,
  customerName,
  phoneNumber
}: ManualTransferDialogProps) {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [summary, setSummary] = useState("");
  const [selectedSellerId, setSelectedSellerId] = useState("");
  const [notes, setNotes] = useState("");

  const { sellers } = useSellers();
  const { generateSummary, transferToSeller, isLoading, isGeneratingSummary } = useManualTransfer();

  const activeSellers = sellers?.filter(seller => seller.active && !seller.deleted) || [];
  const selectedSeller = activeSellers.find(s => s.id === selectedSellerId);

  useEffect(() => {
    if (!open) {
      setCurrentStep(1);
      setSummary("");
      setSelectedSellerId("");
      setNotes("");
    }
  }, [open]);

  const handleGenerateSummary = async () => {
    if (!conversationId) return;
    
    try {
      const generatedSummary = await generateSummary(conversationId);
      setSummary(generatedSummary);
      setCurrentStep(2);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleTransfer = async () => {
    if (!conversationId || !selectedSellerId || !summary) return;

    try {
      await transferToSeller({
        conversationId,
        sellerId: selectedSellerId,
        summary,
        notes
      });
      onOpenChange(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
          <MessageSquare className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Gerar Resumo da Conversa</h3>
          <p className="text-muted-foreground">
            Vamos criar um resumo inteligente desta conversa para enviar ao vendedor
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="w-4 h-4" />
            Dados do Cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nome:</span>
            <span>{customerName || 'Cliente'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Telefone:</span>
            <span>{phoneNumber}</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button 
          onClick={handleGenerateSummary}
          disabled={isGeneratingSummary || !conversationId}
        >
          {isGeneratingSummary && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Gerar Resumo por IA
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
          <User className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Resumo e Seleção de Vendedor</h3>
          <p className="text-muted-foreground">
            Revise o resumo e escolha o vendedor mais adequado
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Resumo da Conversa</label>
          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Resumo da conversa..."
            className="min-h-[100px]"
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Observações Adicionais</label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observações para o vendedor..."
            className="min-h-[80px]"
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-3 block">Selecionar Vendedor</label>
          <div className="grid gap-3 max-h-60 overflow-y-auto">
            {activeSellers.map((seller) => (
              <Card
                key={seller.id}
                className={`cursor-pointer transition-colors ${
                  selectedSellerId === seller.id 
                    ? 'ring-2 ring-primary bg-primary/5' 
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => setSelectedSellerId(seller.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={seller.avatar_url || undefined} />
                      <AvatarFallback>
                        {seller.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{seller.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {seller.current_workload || 0} leads
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Phone className="w-3 h-3" />
                        {seller.phone_number}
                      </div>
                    </div>
                    {selectedSellerId === seller.id && (
                      <CheckCircle className="w-5 h-5 text-primary" />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setCurrentStep(1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <Button 
          onClick={() => setCurrentStep(3)}
          disabled={!selectedSellerId || !summary.trim()}
        >
          Revisar Transferência
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Confirmar Transferência</h3>
          <p className="text-muted-foreground">
            Revise os dados e confirme o envio do lead via Rodrigo Bot
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nome:</span>
              <span>{customerName || 'Cliente'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Telefone:</span>
              <span>{phoneNumber}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Vendedor Selecionado</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedSeller && (
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={selectedSeller.avatar_url || undefined} />
                  <AvatarFallback>
                    {selectedSeller.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{selectedSeller.name}</div>
                  <div className="text-sm text-muted-foreground">{selectedSeller.phone_number}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Resumo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{summary}</p>
            {notes && (
              <>
                <Separator className="my-3" />
                <div>
                  <div className="text-sm font-medium mb-1">Observações:</div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{notes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setCurrentStep(2)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <Button onClick={handleTransfer} disabled={isLoading}>
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Transferir Lead
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Transferência Manual - Etapa {currentStep}/3</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
        </div>
      </DialogContent>
    </Dialog>
  );
}