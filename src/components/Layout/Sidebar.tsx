import { NavLink, useLocation } from "react-router-dom";
import { 
  Home, 
  MessageSquare, 
  Users, 
  Target, 
  Settings, 
  Bug,
  Building2,
  LogOut,
  Brain,
  Bot
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Mensagens Oficial', href: '/mensagens/oficial', icon: MessageSquare },
  { name: 'Acompanhar Vendedores', href: '/mensagens/vendedores', icon: Users },
  { name: 'WhatsApp Clone', href: '/whatsapp-clone', icon: MessageSquare },
  { name: 'Leads', href: '/leads', icon: Target },
  { name: 'Visão do Dono', href: '/visao-dono', icon: Brain },
  { name: 'Agentes de IA', href: '/agentes-ia', icon: Bot },
  { name: 'Configurações', href: '/configuracoes', icon: Settings },
  { name: 'Debug', href: '/debug', icon: Bug },
];

export function Sidebar() {
  const location = useLocation();
  // Temporarily remove useAuth to fix the error
  // const { profile, signOut } = useAuth();

  return (
    <div className="w-64 h-screen bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo/Header */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center space-x-3">
          <Building2 className="h-8 w-8 text-sidebar-primary" />
          <div>
            <h1 className="text-lg font-bold text-sidebar-foreground">Drystore</h1>
            <p className="text-sm text-sidebar-accent">Atendimento WhatsApp</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href || 
            (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
          
          return (
            <NavLink
              key={item.name}
              to={item.href}
              className={cn(
                "flex items-center space-x-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-accent hover:bg-sidebar-accent/10 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 bg-sidebar-primary rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-sidebar-primary-foreground">AD</span>
            </div>
            <div>
              <p className="text-sm font-medium text-sidebar-foreground">Admin</p>
              <p className="text-xs text-sidebar-accent">admin@drystore.com</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="text-sidebar-accent hover:text-sidebar-foreground">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}