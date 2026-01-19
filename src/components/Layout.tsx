import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Cloud,
  GitBranch,
  Rocket,
  Activity,
  DollarSign,
  Shield,
  Database,
  MessageSquare,
  LayoutDashboard,
  Radio,
  Bell,
} from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/terraform", icon: Cloud, label: "Terraform Generator" },
  { path: "/cicd", icon: GitBranch, label: "CI/CD Builder" },
  { path: "/deployment", icon: Rocket, label: "Deployment Manager" },
  { path: "/gke", icon: Activity, label: "GKE Dashboard" },
  { path: "/costs", icon: DollarSign, label: "Cost Analysis" },
  { path: "/security", icon: Shield, label: "Security Analyzer" },
  { path: "/backup", icon: Database, label: "Backup Automation" },
  { path: "/chatops", icon: MessageSquare, label: "ChatOps" },
  { path: "/monitoring-agent", icon: Radio, label: "Monitoring Agent" },
  { path: "/alerts", icon: Bell, label: "Alerting" },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card">
        <div className="flex h-16 items-center border-b border-border px-6">
          <Cloud className="h-6 w-6 text-primary" />
          <span className="ml-2 text-lg font-bold text-foreground">DevOps Hub</span>
        </div>
        <nav className="space-y-1 p-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-8">{children}</div>
      </main>
    </div>
  );
}
