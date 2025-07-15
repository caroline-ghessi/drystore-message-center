import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { UserPlus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Seller {
  id: string;
  name: string;
  phone_number: string;
  active: boolean;
}

interface TransferToSellerDialogProps {
  conversationId: string;
  customerName: string;
  sellers: Seller[];
  isLoading?: boolean;
  onTransfer: (sellerId: string, notes?: string) => Promise<void>;
}

export function TransferToSellerDialog({ 
  conversationId, 
  customerName, 
  sellers, 
  isLoading = false, 
  onTransfer 
}: TransferToSellerDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  const { toast } = useToast();

  const handleTransfer = async () => {
    if (!selectedSeller) {
      toast({
        title: "Erro",
        description: "Selecione um vendedor antes de transferir",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsTransferring(true);
      await onTransfer(selectedSeller, notes);
      
      toast({
        title: "Transferência Realizada",
        description: `Conversa de ${customerName} transferida com sucesso`,
      });
      
      setOpen(false);
      setSelectedSeller("");
      setNotes("");
    } catch (error) {
      toast({
        title: "Erro na Transferência",
        description: "Ocorreu um erro ao transferir a conversa. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsTransferring(false);
    }
  };

  const activeSellers = sellers.filter(seller => seller.active);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          size="sm" 
          variant="default" 
          className="flex items-center space-x-1"
          disabled={isLoading || activeSellers.length === 0}
        >
          <UserPlus className="h-3 w-3" />
          <span>Transferir para Vendedor</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Transferir Conversa</DialogTitle>
          <DialogDescription>
            Transferir a conversa de <strong>{customerName}</strong> para um vendedor especializado.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="seller">Vendedor</Label>
            <Select value={selectedSeller} onValueChange={setSelectedSeller}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um vendedor" />
              </SelectTrigger>
              <SelectContent>
                {activeSellers.map((seller) => (
                  <SelectItem key={seller.id} value={seller.id}>
                    <div className="flex flex-col">
                      <span>{seller.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {seller.phone_number}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeSellers.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum vendedor ativo disponível
              </p>
            )}
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Adicione observações sobre a conversa para o vendedor..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => setOpen(false)}
            disabled={isTransferring}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleTransfer}
            disabled={!selectedSeller || isTransferring}
          >
            {isTransferring && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Transferir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}