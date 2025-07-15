import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusType = 'bot_attending' | 'waiting_evaluation' | 'sent_to_seller' | 'finished' | 'sold' | 'lost' | 'attending';

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusConfig = {
  bot_attending: {
    label: 'Atendimento Bot',
    className: 'bg-drystore-orange/10 text-drystore-orange border-drystore-orange/20'
  },
  waiting_evaluation: {
    label: 'Aguardando Avaliação',
    className: 'bg-drystore-warning/10 text-drystore-warning border-drystore-warning/20'
  },
  sent_to_seller: {
    label: 'Enviado ao Vendedor',
    className: 'bg-drystore-info/10 text-drystore-info border-drystore-info/20'
  },
  finished: {
    label: 'Finalizado',
    className: 'bg-drystore-success/10 text-drystore-success border-drystore-success/20'
  },
  sold: {
    label: 'Vendido',
    className: 'bg-drystore-success/10 text-drystore-success border-drystore-success/20'
  },
  lost: {
    label: 'Perdido',
    className: 'bg-drystore-error/10 text-drystore-error border-drystore-error/20'
  },
  attending: {
    label: 'Atendendo',
    className: 'bg-drystore-info/10 text-drystore-info border-drystore-info/20'
  }
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </Badge>
  );
}