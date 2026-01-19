import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Cloud,
  GitBranch,
  Rocket,
  Activity,
  DollarSign,
  Shield,
  Database,
  MessageSquare,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";

const tools = [
  {
    title: "Terraform Generator",
    description: "Generate infrastructure code for VPC, GKE, Cloud SQL, and more",
    icon: Cloud,
    path: "/terraform",
    color: "text-primary",
    status: "ready",
  },
  {
    title: "CI/CD Pipeline Builder",
    description: "Create Cloud Build and GitHub Actions workflows instantly",
    icon: GitBranch,
    path: "/cicd",
    color: "text-accent",
    status: "ready",
  },
  {
    title: "Deployment Manager",
    description: "Deploy to GKE, Cloud Run, or Compute Engine with ease",
    icon: Rocket,
    path: "/deployment",
    color: "text-success",
    status: "ready",
  },
  {
    title: "GKE Dashboard",
    description: "Monitor pods, nodes, logs, and autoscaling metrics",
    icon: Activity,
    path: "/gke",
    color: "text-primary",
    status: "ready",
  },
  {
    title: "Cost Dashboard",
    description: "Analyze spending across all GCP services",
    icon: DollarSign,
    path: "/costs",
    color: "text-warning",
    status: "ready",
  },
  {
    title: "Security Analyzer",
    description: "Audit IAM, storage access, and SSL certificates",
    icon: Shield,
    path: "/security",
    color: "text-destructive",
    status: "ready",
  },
  {
    title: "Backup Automation",
    description: "Automate Cloud SQL exports and bucket synchronization",
    icon: Database,
    path: "/backup",
    color: "text-accent",
    status: "ready",
  },
  {
    title: "ChatOps Integration",
    description: "Connect with Slack and Microsoft Teams",
    icon: MessageSquare,
    path: "/chatops",
    color: "text-primary",
    status: "ready",
  },
];

const recentActivity = [
  { action: "Terraform template generated", resource: "VPC Network", time: "2 min ago", status: "success" },
  { action: "GKE cluster scaled", resource: "production-cluster", time: "15 min ago", status: "success" },
  { action: "Security scan completed", resource: "IAM Policies", time: "1 hour ago", status: "warning" },
  { action: "Backup completed", resource: "postgres-db", time: "3 hours ago", status: "success" },
];

const stats = [
  { label: "Active Deployments", value: "12", trend: "+2", icon: Rocket },
  { label: "Monthly Cost", value: "$2,847", trend: "-8%", icon: DollarSign },
  { label: "Security Issues", value: "3", trend: "-2", icon: Shield },
  { label: "Automation Jobs", value: "28", trend: "+5", icon: Activity },
];

export default function Dashboard() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground">DevOps Automation Hub</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Streamline your GCP infrastructure, deployments, and operations
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                <div className="flex items-center text-xs text-success">
                  <TrendingUp className="mr-1 h-3 w-3" />
                  {stat.trend} from last month
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tools Grid */}
      <div>
        <h2 className="mb-4 text-2xl font-semibold text-foreground">DevOps Tools</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {tools.map((tool, index) => {
            const Icon = tool.icon;
            return (
              <Card key={index} className="transition-all hover:shadow-lg">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <Icon className={`h-8 w-8 ${tool.color}`} />
                    <Badge variant={tool.status === "ready" ? "default" : "secondary"}>
                      {tool.status}
                    </Badge>
                  </div>
                  <CardTitle className="text-foreground">{tool.title}</CardTitle>
                  <CardDescription>{tool.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link to={tool.path}>
                    <Button variant="outline" className="w-full group">
                      Launch Tool
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest actions across your infrastructure</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center justify-between border-b border-border pb-4 last:border-0 last:pb-0">
                <div className="flex items-center gap-3">
                  {activity.status === "success" ? (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-warning" />
                  )}
                  <div>
                    <p className="font-medium text-foreground">{activity.action}</p>
                    <p className="text-sm text-muted-foreground">{activity.resource}</p>
                  </div>
                </div>
                <span className="text-sm text-muted-foreground">{activity.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
