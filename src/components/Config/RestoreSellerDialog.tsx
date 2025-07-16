import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RotateCcw, User } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type Seller = Tables<"sellers">;

interface RestoreSellerDialogProps {
  open: boolean;
  onClose: () => void;
  onRestore: () => void;
  onCreateNew: () => void;
  seller: Seller;
}

export function RestoreSellerDialog({ 
  open, 
  onClose, 
  onRestore, 
  onCreateNew, 
  seller 
}: RestoreSellerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-amber-600" />
            Vendedor Excluído Encontrado
          </DialogTitle>
          <DialogDescription>
            Já existe um vendedor excluído com este telefone. O que deseja fazer?
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
          <Avatar className="h-12 w-12">
            <AvatarImage src={seller.avatar_url || undefined} />
            <AvatarFallback>
              <User className="h-6 w-6" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h4 className="font-semibold">{seller.name}</h4>
            <p className="text-sm text-muted-foreground">{seller.phone_number}</p>
            <p className="text-sm text-muted-foreground">{seller.email}</p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={onCreateNew}
            className="w-full sm:w-auto"
          >
            Criar Novo Vendedor
          </Button>
          <Button 
            onClick={onRestore}
            className="w-full sm:w-auto"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Restaurar Vendedor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}