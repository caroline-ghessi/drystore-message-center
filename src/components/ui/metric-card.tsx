import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    type: 'increase' | 'decrease';
  };
  color?: 'orange' | 'blue' | 'green' | 'red';
  className?: string;
}

const colorVariants = {
  orange: "text-drystore-orange",
  blue: "text-drystore-info",
  green: "text-drystore-success",
  red: "text-drystore-error"
};

export function MetricCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  color = 'orange',
  className 
}: MetricCardProps) {
  return (
    <Card className={cn(
      "shadow-card hover:shadow-hover transition-all duration-300 animate-scale-in",
      className
    )}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground mb-1">
              {title}
            </p>
            <p className="text-3xl font-bold text-foreground">
              {value}
            </p>
            {trend && (
              <p className={cn(
                "text-sm mt-2 flex items-center space-x-1",
                trend.type === 'increase' ? 'text-drystore-success' : 'text-drystore-error'
              )}>
                <span>
                  {trend.type === 'increase' ? '↗' : '↘'} {Math.abs(trend.value)}%
                </span>
                <span className="text-muted-foreground">vs último período</span>
              </p>
            )}
          </div>
          <div className={cn(
            "h-12 w-12 rounded-lg bg-muted flex items-center justify-center",
            colorVariants[color]
          )}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}