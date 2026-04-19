import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  minimumRole?: AppRole;
}

export default function ProtectedRoute({ children, minimumRole = "viewer" }: ProtectedRouteProps) {
  const { session, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Role hierarchy check
  const roleOrder: AppRole[] = ["viewer", "operator", "admin"];
  const userRoleIndex = role ? roleOrder.indexOf(role) : -1;
  const requiredRoleIndex = roleOrder.indexOf(minimumRole);

  if (userRoleIndex < requiredRoleIndex) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <p className="text-lg font-medium text-foreground">Access denied</p>
          <p className="text-sm text-muted-foreground">
            You need <span className="font-medium">{minimumRole}</span> access to view this page.
          </p>
          <p className="text-xs text-muted-foreground">Contact your admin to update your role.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
