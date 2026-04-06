import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Bell,
  CheckCircle2,
  Cloud,
  DollarSign,
  FileText,
  GitBranch,
  Radio,
  Shield,
  FlaskConical,
  Ticket,
  Boxes,
  Clock,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MonitoringAgent {
  id: string;
  agent_name: string;
  status: string;
  last_heartbeat: string | null;
  created_at: string;
}

interface TriggeredAlert {
  id: string;
  message: string;
  severity: string;
  status: string;
  triggered_at: string;
  pod_name: string | null;
  node_name: string | null;
  namespace: string | null;
}

interface CollectedLog {
  id: string;
  message: string;
  log_level: string | null;
  pod_name: string | null;
  namespace: string | null;
  timestamp: string;
}

interface CollectedEvent {
  id: string;
  reason: string;
  event_type: string;
  involved_object: string | null;
  namespace: string | null;
  created_at: string;
}

interface AlertRule {
  id: string;
  enabled: boolean;
}

interface JiraResourceTicket {
  id: string;
  resource_type: string;
  resource_name: string;
  creator_email: string | null;
  creator_name: string | null;
  due_date: string;
  status: string;
  jira_issue_key: string | null;
  created_at: string;
}

interface DerivedResource {
  id: string;
  resource_type: string;
  resource_name: string;
  creator_email: string | null;
  creator_name: string | null;
  due_date: string;
  status: string;
  jira_issue_key: string | null;
  created_at: string;
}

type OverviewCard = {
  label: string;
  value: string;
  detail: string;
  icon: typeof Boxes;
  href?: string;
  onClick?: () => void;
  tone: string;
};

const tools = [
  {
    title: "GKE Dashboard",
    description: "Inspect live pods, nodes, logs, and cluster events",
    icon: Activity,
    path: "/gke",
    accent: "text-primary",
  },
  {
    title: "Jira Automation",
    description: "Raise Jira tickets from detected Google Cloud resource creation logs",
    icon: Ticket,
    path: "/jira-automation",
    accent: "text-warning",
  },
];

const labTools = [
  {
    title: "Cost Signals",
    description: "Use operational activity as a proxy for spend until billing export is connected",
    icon: DollarSign,
    path: "/costs",
  },
  {
    title: "Terraform Generator",
    description: "Prototype infrastructure code and module scaffolds",
    icon: Cloud,
    path: "/terraform",
  },
  {
    title: "CI/CD Builder",
    description: "Generate starter delivery configurations for experiments",
    icon: GitBranch,
    path: "/cicd",
  },
  {
    title: "Security Analyzer",
    description: "Explore security-oriented views that still need backend hardening",
    icon: Shield,
    path: "/security",
  },
];

type ActivityItem = {
  id: string;
  title: string;
  resource: string;
  time: string;
  status: "success" | "warning";
  href: string;
};

const parseResourceFromLog = (log: CollectedLog): DerivedResource | null => {
  const message = log.message.trim();
  if (!message.startsWith("{") || !message.endsWith("}")) {
    return null;
  }

  try {
    const parsed = JSON.parse(message) as {
      protoPayload?: {
        authenticationInfo?: { principalEmail?: string };
        methodName?: string;
        resourceName?: string;
      };
      resource?: {
        type?: string;
        labels?: { bucket_name?: string; instance_id?: string; cluster_name?: string };
      };
      timestamp?: string;
    };

    const methodName = parsed.protoPayload?.methodName ?? "";
    if (!/create|insert|provision|deploy|runinstances/i.test(methodName)) {
      return null;
    }

    const resourceType = parsed.resource?.type ?? "gcp_resource";
    const resourceName =
      parsed.resource?.labels?.bucket_name ||
      parsed.resource?.labels?.instance_id ||
      parsed.resource?.labels?.cluster_name ||
      parsed.protoPayload?.resourceName;

    if (!resourceName) {
      return null;
    }

    const createdAt = parsed.timestamp ?? log.timestamp;
    const dueDate = new Date(new Date(createdAt).getTime() + 2 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    return {
      id: `derived-${log.id}`,
      resource_type: resourceType,
      resource_name: resourceName,
      creator_email: parsed.protoPayload?.authenticationInfo?.principalEmail ?? null,
      creator_name: null,
      due_date: dueDate,
      status: "detected",
      jira_issue_key: null,
      created_at: createdAt,
    };
  } catch {
    return null;
  }
};

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [resourcesDialogOpen, setResourcesDialogOpen] = useState(false);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);

  const { data: agents = [], isLoading: agentsLoading } = useQuery({
    queryKey: ["dashboard-agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monitoring_agents")
        .select("id, agent_name, status, last_heartbeat, created_at")
        .order("last_heartbeat", { ascending: false });

      if (error) {
        throw error;
      }

      return data as MonitoringAgent[];
    },
  });

  const { data: alerts = [], isLoading: alertsLoading } = useQuery({
    queryKey: ["dashboard-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("triggered_alerts")
        .select("id, message, severity, status, triggered_at, pod_name, node_name, namespace")
        .order("triggered_at", { ascending: false })
        .limit(8);

      if (error) {
        throw error;
      }

      return data as TriggeredAlert[];
    },
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["dashboard-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collected_logs")
        .select("id, message, log_level, pod_name, namespace, timestamp")
        .order("timestamp", { ascending: false })
        .limit(8);

      if (error) {
        throw error;
      }

      return data as CollectedLog[];
    },
  });

  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["dashboard-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collected_events")
        .select("id, reason, event_type, involved_object, namespace, created_at")
        .order("created_at", { ascending: false })
        .limit(8);

      if (error) {
        throw error;
      }

      return data as CollectedEvent[];
    },
  });

  const { data: rules = [], isLoading: rulesLoading } = useQuery({
    queryKey: ["dashboard-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alert_rules")
        .select("id, enabled")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return data as AlertRule[];
    },
  });

  const { data: resources = [], isLoading: resourcesLoading } = useQuery({
    queryKey: ["dashboard-created-resources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jira_resource_tickets")
        .select("id, resource_type, resource_name, creator_email, creator_name, due_date, status, jira_issue_key, created_at")
        .order("created_at", { ascending: false })
        .limit(8);

      if (!error && data) {
        return data as DerivedResource[];
      }

      const { data: fallbackLogs, error: fallbackError } = await supabase
        .from("collected_logs")
        .select("id, message, log_level, pod_name, namespace, timestamp")
        .order("timestamp", { ascending: false })
        .limit(25);

      if (fallbackError) {
        throw fallbackError;
      }

      return ((fallbackLogs as CollectedLog[]) ?? [])
        .map(parseResourceFromLog)
        .filter((resource): resource is DerivedResource => resource !== null)
        .slice(0, 8);
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("dashboard-overview")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "monitoring_agents" },
        () => queryClient.invalidateQueries({ queryKey: ["dashboard-agents"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "triggered_alerts" },
        () => queryClient.invalidateQueries({ queryKey: ["dashboard-alerts"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "collected_logs" },
        () => queryClient.invalidateQueries({ queryKey: ["dashboard-logs"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "collected_events" },
        () => queryClient.invalidateQueries({ queryKey: ["dashboard-events"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alert_rules" },
        () => queryClient.invalidateQueries({ queryKey: ["dashboard-rules"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jira_resource_tickets" },
        () => queryClient.invalidateQueries({ queryKey: ["dashboard-created-resources"] }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const activeAgents = agents.filter((agent) => agent.status === "active").length;
  const activeAlerts = alerts.filter((alert) => alert.status === "active").length;
  const criticalAlerts = alerts.filter(
    (alert) => alert.status === "active" && alert.severity === "critical",
  ).length;
  const enabledRules = rules.filter((rule) => rule.enabled).length;
  const resourcesToday = resources.filter((resource) => {
    const created = new Date(resource.created_at);
    const now = new Date();
    return (
      created.getUTCFullYear() === now.getUTCFullYear() &&
      created.getUTCMonth() === now.getUTCMonth() &&
      created.getUTCDate() === now.getUTCDate()
    );
  }).length;
  const pendingReview = resources.filter((resource) =>
    ["pending", "failed", "skipped", "detected"].includes(resource.status),
  ).length;
  const selectedResource =
    resources.find((resource) => resource.id === selectedResourceId) ?? resources[0] ?? null;

  const recentActivity = useMemo<ActivityItem[]>(() => {
    const resourceItems = resources.slice(0, 3).map((resource) => ({
      id: `resource-${resource.id}`,
      title: "Resource created",
      resource: `${resource.resource_type}: ${resource.resource_name}`,
      time: resource.created_at,
      status: resource.status === "created" ? "success" : "warning",
      href: "/jira-automation",
    }));

    const alertItems = alerts.slice(0, 3).map((alert) => ({
      id: `alert-${alert.id}`,
      title: alert.status === "resolved" ? "Alert resolved" : "Alert triggered",
      resource: alert.message,
      time: alert.triggered_at,
      status: alert.status === "resolved" ? "success" : "warning",
      href: "/alerts",
    }));

    const logItems = logs.slice(0, 2).map((log) => ({
      id: `log-${log.id}`,
      title: `${log.log_level?.toUpperCase() || "LOG"} log captured`,
      resource: log.pod_name || log.namespace || "Runtime log stream",
      time: log.timestamp,
      status: log.log_level?.toUpperCase() === "ERROR" ? "warning" : "success",
      href: "/logs",
    }));

    const eventItems = events.slice(0, 2).map((event) => ({
      id: `event-${event.id}`,
      title: `${event.event_type} cluster event`,
      resource: event.involved_object || event.reason,
      time: event.created_at,
      status: event.event_type === "Warning" ? "warning" : "success",
      href: "/gke",
    }));

    const agentItems = agents.slice(0, 2).map((agent) => ({
      id: `agent-${agent.id}`,
      title: agent.status === "active" ? "Agent heartbeat received" : "Agent registered",
      resource: agent.agent_name,
      time: agent.last_heartbeat || agent.created_at,
      status: agent.status === "active" ? "success" : "warning",
      href: "/monitoring-agent",
    }));

    return [...resourceItems, ...alertItems, ...logItems, ...eventItems, ...agentItems]
      .sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime())
      .slice(0, 6);
  }, [agents, alerts, events, logs, resources]);

  const overviewCards: OverviewCard[] = [
    {
      label: "Resources Detected",
      value: String(resources.length),
      detail:
        resources.length > 0
          ? `${resources[0].resource_type}: ${resources[0].resource_name}`
          : resourcesToday > 0
            ? `${resourcesToday} created today from Google Cloud logs`
            : "No created resources detected yet",
      icon: Boxes,
      onClick: () => {
        setSelectedResourceId(resources[0]?.id ?? null);
        setResourcesDialogOpen(true);
      },
      tone: resources.length > 0 ? "text-primary" : "text-muted-foreground",
    },
    {
      label: "Pending Review",
      value: String(pendingReview),
      detail: pendingReview > 0 ? "Detected resources still need follow-up" : "No pending resource reviews right now",
      icon: Clock,
      href: "/jira-automation",
      tone: pendingReview > 0 ? "text-warning" : "text-success",
    },
    {
      label: "Active Agents",
      value: agents.length === 0 ? "0" : `${activeAgents}/${agents.length}`,
      detail: agents.length === 0 ? "Deploy a monitoring agent to start ingestion" : "Sending live telemetry to the platform",
      icon: Radio,
      href: "/monitoring-agent",
      tone: activeAgents > 0 ? "text-success" : "text-muted-foreground",
    },
    {
      label: "Open Alerts",
      value: String(activeAlerts),
      detail: criticalAlerts > 0 ? `${criticalAlerts} critical alerts need attention` : "No critical alerts in the current snapshot",
      icon: Bell,
      href: "/alerts",
      tone: activeAlerts > 0 ? "text-warning" : "text-success",
    },
    {
      label: "Enabled Rules",
      value: String(enabledRules),
      detail: rules.length > 0 ? `${rules.length - enabledRules} rules currently paused` : "No alert rules configured yet",
      icon: Activity,
      href: "/alerts",
      tone: enabledRules > 0 ? "text-primary" : "text-muted-foreground",
    },
  ];

  const loading =
    agentsLoading || alertsLoading || logsLoading || eventsLoading || rulesLoading || resourcesLoading;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-4xl font-bold text-foreground">DevOps Automation Hub</h1>
          <p className="mt-2 text-lg text-muted-foreground">
            Live control plane for monitoring, alerting, and delivery workflows.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={activeAlerts > 0 ? "destructive" : "secondary"}>
            {activeAlerts > 0 ? `${activeAlerts} active alerts` : "No active alerts"}
          </Badge>
          <Badge variant={activeAgents > 0 ? "default" : "secondary"}>
            {activeAgents > 0 ? "Telemetry live" : "Waiting for agents"}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overviewCards.map((card) => {
          const Icon = card.icon;
          const cardBody = (
            <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.label}
                </CardTitle>
                <Icon className={`h-4 w-4 ${card.tone}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{card.value}</div>
                <p className="mt-2 text-xs text-muted-foreground">{card.detail}</p>
              </CardContent>
            </Card>
          );

          if (card.onClick) {
            return (
              <button
                key={card.label}
                type="button"
                onClick={card.onClick}
                className="text-left"
              >
                {cardBody}
              </button>
            );
          }

          return (
            <Link key={card.label} to={card.href ?? "/"}>
              {cardBody}
            </Link>
          );
        })}
      </div>

      <Dialog open={resourcesDialogOpen} onOpenChange={setResourcesDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Detected Resources</DialogTitle>
            <DialogDescription>
              Inspect the exact Google Cloud resources detected from audit logs without leaving the dashboard.
            </DialogDescription>
          </DialogHeader>
          {resources.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
              <div className="space-y-3">
                {resources.map((resource) => (
                  <button
                    key={resource.id}
                    type="button"
                    onClick={() => setSelectedResourceId(resource.id)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      selectedResource?.id === resource.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <p className="font-medium text-foreground">{resource.resource_name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{resource.resource_type}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(resource.created_at), { addSuffix: true })}
                    </p>
                  </button>
                ))}
              </div>
              {selectedResource ? (
                <div className="space-y-4 rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-semibold text-foreground">
                      {selectedResource.resource_name}
                    </h3>
                    <Badge variant="outline">{selectedResource.resource_type}</Badge>
                    <Badge
                      variant={
                        selectedResource.status === "created"
                          ? "secondary"
                          : selectedResource.status === "failed"
                            ? "destructive"
                            : "outline"
                      }
                    >
                      {selectedResource.status}
                    </Badge>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-md bg-muted/40 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Creator
                      </p>
                      <p className="mt-1 text-sm text-foreground">
                        {selectedResource.creator_email ||
                          selectedResource.creator_name ||
                          "Unknown"}
                      </p>
                    </div>
                    <div className="rounded-md bg-muted/40 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Due Date
                      </p>
                      <p className="mt-1 text-sm text-foreground">{selectedResource.due_date}</p>
                    </div>
                    <div className="rounded-md bg-muted/40 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Detected
                      </p>
                      <p className="mt-1 text-sm text-foreground">
                        {new Date(selectedResource.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-md bg-muted/40 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Ticket
                      </p>
                      <p className="mt-1 text-sm text-foreground">
                        {selectedResource.jira_issue_key ?? "Not created"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-md border border-dashed border-border p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Resource Identifier
                    </p>
                    <p className="mt-1 break-all text-sm text-foreground">
                      {selectedResource.resource_name}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link to="/jira-automation">
                      <Button variant="outline">Open Jira Automation</Button>
                    </Link>
                    <Link to="/logs">
                      <Button variant="ghost">Inspect Logs</Button>
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              No created resources have been detected yet.
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Operational Tools</CardTitle>
            <CardDescription>
              Start from the area that needs attention right now.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {tools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Card key={tool.path} className="border-border/60 shadow-none">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <Icon className={`h-8 w-8 ${tool.accent}`} />
                        <Badge variant="secondary">Available</Badge>
                      </div>
                      <CardTitle className="text-foreground">{tool.title}</CardTitle>
                      <CardDescription>{tool.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Link to={tool.path}>
                        <Button variant="outline" className="w-full group">
                          Open
                          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Latest signals from alerts, logs, agents, and cluster events.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-sm text-muted-foreground">
                Loading live overview data...
              </div>
            ) : recentActivity.length > 0 ? (
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <Link
                    key={activity.id}
                    to={activity.href}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-3">
                      {activity.status === "success" ? (
                        <CheckCircle2 className="h-5 w-5 text-success" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-warning" />
                      )}
                      <div>
                        <p className="font-medium text-foreground">{activity.title}</p>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {activity.resource}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(activity.time), { addSuffix: true })}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                No operational activity yet. Deploy an agent or create an alert rule to populate the live feed.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Created Resources</CardTitle>
          <CardDescription>
            New Google Cloud resources detected from ingested audit logs, with review status and due dates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {resourcesLoading ? (
            <div className="py-8 text-sm text-muted-foreground">Loading detected resources...</div>
          ) : resources.length > 0 ? (
            <div className="space-y-4">
              {resources.map((resource) => (
                <Link
                  key={resource.id}
                  to="/jira-automation"
                  className="flex flex-col gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-muted/40 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{resource.resource_name}</p>
                      <Badge variant="outline">{resource.resource_type}</Badge>
                      <Badge
                        variant={
                          resource.status === "created"
                            ? "secondary"
                            : resource.status === "failed"
                              ? "destructive"
                              : "outline"
                        }
                      >
                        {resource.status}
                      </Badge>
                      {resource.jira_issue_key ? (
                        <Badge className="bg-success text-success-foreground">
                          {resource.jira_issue_key}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Creator: {resource.creator_email || resource.creator_name || "Unknown"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Detected {formatDistanceToNow(new Date(resource.created_at), { addSuffix: true })} · Due {resource.due_date}
                    </p>
                  </div>
                  <Button variant="outline" className="shrink-0">
                    Open Review
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              No created resources have been detected yet. Once Google Cloud audit logs are ingested, they will appear here directly.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Labs</CardTitle>
          </div>
          <CardDescription>
            Secondary tools that are still useful, but not part of the app's core incident workflow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {labTools.map((tool) => {
              const Icon = tool.icon;
              return (
                <Card key={tool.path} className="border-border/60 shadow-none">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <Icon className="h-8 w-8 text-muted-foreground" />
                      <Badge variant="outline">Labs</Badge>
                    </div>
                    <CardTitle className="text-foreground">{tool.title}</CardTitle>
                    <CardDescription>{tool.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Link to={tool.path}>
                      <Button variant="outline" className="w-full group">
                        Open
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
