import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Cloud,
  GitBranch,
  Activity,
  DollarSign,
  Shield,
  LayoutDashboard,
  Radio,
  Bell,
  FileText,
  Ticket,
} from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

const navSections = [
  {
    title: "Core",
    items: [
      { path: "/", icon: LayoutDashboard, label: "Dashboard" },
      { path: "/gke", icon: Activity, label: "GKE Dashboard" },
      { path: "/monitoring-agent", icon: Radio, label: "Monitoring Agent" },
      { path: "/alerts", icon: Bell, label: "Alerting" },
      { path: "/logs", icon: FileText, label: "Log Viewer" },
      { path: "/jira-automation", icon: Ticket, label: "Jira Automation" },
    ],
  },
  {
    title: "Labs",
    items: [
      { path: "/costs", icon: DollarSign, label: "Cost Signals" },
      { path: "/terraform", icon: Cloud, label: "Terraform Generator" },
      { path: "/cicd", icon: GitBranch, label: "CI/CD Builder" },
      { path: "/security", icon: Shield, label: "Security Analyzer" },
    ],
  },
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
        <nav className="space-y-5 p-4">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                {section.title}
              </p>
              {section.items.map((item) => {
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
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-8">{children}</div>
      </main>
    </div>
  );
}
