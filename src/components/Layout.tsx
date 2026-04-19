import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Cloud,
  Activity,
  LayoutDashboard,
  Radio,
  Bell,
  FileText,
  Ticket,
  LogOut,
  UserCircle2,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/gke", icon: Activity, label: "GKE Dashboard" },
  { path: "/monitoring-agent", icon: Radio, label: "Monitoring Agent" },
  { path: "/alerts", icon: Bell, label: "Alerting" },
  { path: "/logs", icon: FileText, label: "Log Viewer" },
  { path: "/jira-automation", icon: Ticket, label: "Jira Automation" },
];

const roleBadgeColor: Record<string, string> = {
  admin:    "bg-primary/10 text-primary",
  operator: "bg-warning/10 text-warning",
  viewer:   "bg-muted text-muted-foreground",
};

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { user, role, signOut } = useAuth();

  const displayName = user?.user_metadata?.full_name ?? user?.email ?? "User";
  const avatarUrl   = user?.user_metadata?.avatar_url as string | undefined;

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r border-border bg-card">
        {/* Logo */}
        <div className="flex h-16 items-center border-b border-border px-6">
          <Cloud className="h-6 w-6 text-primary" />
          <span className="ml-2 text-lg font-bold text-foreground">DevOps Hub</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 p-4">
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
            Core
          </p>
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

        {/* User footer */}
        <div className="border-t border-border p-4 space-y-3">
          {/* Role badge */}
          {role && (
            <div className="flex items-center gap-2 px-1">
              <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
              <span className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                roleBadgeColor[role] ?? "bg-muted text-muted-foreground"
              )}>
                {role}
              </span>
            </div>
          )}

          {/* User info + sign out */}
          <div className="flex items-center gap-2">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="h-7 w-7 rounded-full object-cover"
              />
            ) : (
              <UserCircle2 className="h-7 w-7 text-muted-foreground" />
            )}
            <span className="flex-1 truncate text-xs text-muted-foreground" title={displayName}>
              {displayName}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={signOut}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign out</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-8">{children}</div>
      </main>
    </div>
  );
}
