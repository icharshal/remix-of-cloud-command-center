import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import {
  AlertCircle,
  BarChart3,
  Database,
  DollarSign,
  FileText,
  Radio,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

interface CollectedLog {
  id: string;
  pod_name: string | null;
  namespace: string | null;
  timestamp: string;
  log_level: string | null;
}

interface CollectedMetric {
  id: string;
  metric_name: string;
  metric_type: string;
  namespace: string | null;
  pod_name: string | null;
  timestamp: string;
  value: number;
}

interface TriggeredAlert {
  id: string;
  severity: string;
  namespace: string | null;
  triggered_at: string;
  status: string;
}

interface MonitoringAgent {
  id: string;
  status: string;
  last_heartbeat: string | null;
}

const rangeDaysMap: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export default function CostDashboard() {
  const [timeRange, setTimeRange] = useState("30d");
  const queryClient = useQueryClient();
  const days = rangeDaysMap[timeRange] ?? 30;
  const windowStart = subDays(new Date(), days).toISOString();

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["cost-dashboard-logs", timeRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collected_logs")
        .select("id, pod_name, namespace, timestamp, log_level")
        .gte("timestamp", windowStart)
        .order("timestamp", { ascending: false })
        .limit(2000);

      if (error) {
        throw error;
      }

      return data as CollectedLog[];
    },
  });

  const { data: metrics = [], isLoading: metricsLoading } = useQuery({
    queryKey: ["cost-dashboard-metrics", timeRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collected_metrics")
        .select("id, metric_name, metric_type, namespace, pod_name, timestamp, value")
        .gte("timestamp", windowStart)
        .order("timestamp", { ascending: false })
        .limit(3000);

      if (error) {
        throw error;
      }

      return data as CollectedMetric[];
    },
  });

  const { data: alerts = [], isLoading: alertsLoading } = useQuery({
    queryKey: ["cost-dashboard-alerts", timeRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("triggered_alerts")
        .select("id, severity, namespace, triggered_at, status")
        .gte("triggered_at", windowStart)
        .order("triggered_at", { ascending: false })
        .limit(1000);

      if (error) {
        throw error;
      }

      return data as TriggeredAlert[];
    },
  });

  const { data: agents = [], isLoading: agentsLoading } = useQuery({
    queryKey: ["cost-dashboard-agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monitoring_agents")
        .select("id, status, last_heartbeat")
        .order("last_heartbeat", { ascending: false });

      if (error) {
        throw error;
      }

      return data as MonitoringAgent[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("cost-dashboard-signals")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "collected_logs" },
        () => queryClient.invalidateQueries({ queryKey: ["cost-dashboard-logs"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "collected_metrics" },
        () => queryClient.invalidateQueries({ queryKey: ["cost-dashboard-metrics"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "triggered_alerts" },
        () => queryClient.invalidateQueries({ queryKey: ["cost-dashboard-alerts"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "monitoring_agents" },
        () => queryClient.invalidateQueries({ queryKey: ["cost-dashboard-agents"] }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const activeAgents = agents.filter((agent) => agent.status === "active").length;
  const activeAlerts = alerts.filter((alert) => alert.status === "active").length;
  const criticalAlerts = alerts.filter((alert) => alert.severity === "critical").length;
  const errorLogs = logs.filter((log) => log.log_level?.toUpperCase() === "ERROR").length;

  const dailySignals = useMemo(() => {
    const buckets = new Map<string, { day: string; logs: number; metrics: number; alerts: number }>();

    for (let index = days - 1; index >= 0; index -= 1) {
      const date = subDays(new Date(), index);
      const key = format(date, "yyyy-MM-dd");
      buckets.set(key, { day: format(date, days > 30 ? "MMM d" : "dd MMM"), logs: 0, metrics: 0, alerts: 0 });
    }

    logs.forEach((log) => {
      const key = format(new Date(log.timestamp), "yyyy-MM-dd");
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.logs += 1;
      }
    });

    metrics.forEach((metric) => {
      const key = format(new Date(metric.timestamp), "yyyy-MM-dd");
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.metrics += 1;
      }
    });

    alerts.forEach((alert) => {
      const key = format(new Date(alert.triggered_at), "yyyy-MM-dd");
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.alerts += 1;
      }
    });

    return Array.from(buckets.values());
  }, [alerts, days, logs, metrics]);

  const namespaceBreakdown = useMemo(() => {
    const counts = new Map<string, number>();

    metrics.forEach((metric) => {
      const key = metric.namespace || "unassigned";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    logs.forEach((log) => {
      const key = log.namespace || "unassigned";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([name, value], index) => ({
        name,
        value,
        color: `hsl(var(--chart-${(index % 5) + 1}))`,
      }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 6);
  }, [logs, metrics]);

  const noisyPods = useMemo(() => {
    const counts = new Map<string, { logs: number; alerts: number }>();

    logs.forEach((log) => {
      const key = log.pod_name || "unassigned";
      const current = counts.get(key) ?? { logs: 0, alerts: 0 };
      counts.set(key, { ...current, logs: current.logs + 1 });
    });

    alerts.forEach((alert) => {
      const key = alert.namespace || "unassigned";
      const current = counts.get(key) ?? { logs: 0, alerts: 0 };
      counts.set(key, { ...current, alerts: current.alerts + 1 });
    });

    return Array.from(counts.entries())
      .map(([name, value]) => ({
        name,
        logs: value.logs,
        alerts: value.alerts,
        score: value.logs + value.alerts * 5,
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, 6);
  }, [alerts, logs]);

  const averageMetricSamplesPerDay =
    dailySignals.length > 0
      ? Math.round(dailySignals.reduce((sum, day) => sum + day.metrics, 0) / dailySignals.length)
      : 0;

  const loading = logsLoading || metricsLoading || alertsLoading || agentsLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Cost Dashboard</h1>
          <p className="mt-2 text-muted-foreground">
            Live cost signals from workload activity while billing export is still disconnected.
          </p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-warning/40 bg-warning/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-warning" />
            Billing Source Not Connected
          </CardTitle>
          <CardDescription>
            This page is now live, but it is currently powered by operational activity from Supabase tables, not by GCP Billing Export.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">Honest mode</Badge>
          <span>Connect BigQuery billing export or a billing ingestion table to unlock real spend, budget, and forecast numbers.</span>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Telemetry Volume</CardTitle>
            <Database className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{metrics.length}</div>
            <p className="text-xs text-muted-foreground">Metric samples in the selected window</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Log Churn</CardTitle>
            <FileText className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{logs.length}</div>
            <p className="text-xs text-muted-foreground">{errorLogs} error logs in the selected window</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Alert Pressure</CardTitle>
            <TrendingUp className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{activeAlerts}</div>
            <p className="text-xs text-muted-foreground">{criticalAlerts} critical alerts raised in the selected window</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Agents</CardTitle>
            <Radio className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{activeAgents}</div>
            <p className="text-xs text-muted-foreground">Workloads currently reporting telemetry</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Operational Activity Trend</CardTitle>
            <CardDescription>
              Use telemetry and alert volume as a proxy for platform cost pressure.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                Loading activity signals...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailySignals}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="metrics" stroke="hsl(var(--primary))" strokeWidth={2} name="Metric samples" />
                  <Line type="monotone" dataKey="logs" stroke="hsl(var(--warning))" strokeWidth={2} name="Logs" />
                  <Line type="monotone" dataKey="alerts" stroke="hsl(var(--destructive))" strokeWidth={2} name="Alerts" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Namespace Activity Mix</CardTitle>
            <CardDescription>
              Higher signal concentration often points to higher compute or troubleshooting cost.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {namespaceBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={namespaceBreakdown}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name}: ${Math.round(percent * 100)}%`}
                  >
                    {namespaceBreakdown.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value} signals`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                No namespace activity has been collected yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Hotspots To Review</CardTitle>
            <CardDescription>
              These workloads are generating the most operational noise in the selected window.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {noisyPods.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={noisyPods}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tickFormatter={(value) => (value.length > 12 ? `${value.slice(0, 12)}...` : value)} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="logs" fill="hsl(var(--warning))" name="Logs" />
                  <Bar dataKey="alerts" fill="hsl(var(--destructive))" name="Alerts" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[320px] items-center justify-center text-muted-foreground">
                No hotspot data available yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>FinOps Readiness</CardTitle>
            <CardDescription>
              What you can act on now, and what still needs billing integration.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">Average metric samples per day</p>
                  <p className="text-sm text-muted-foreground">Useful proxy for telemetry ingestion footprint</p>
                </div>
                <Badge variant="secondary">{averageMetricSamplesPerDay}/day</Badge>
              </div>
            </div>

            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">Billing export status</p>
                  <p className="text-sm text-muted-foreground">No BigQuery billing export or spend table is configured in this app</p>
                </div>
                <Badge variant="outline">Missing</Badge>
              </div>
            </div>

            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">Budget tracking</p>
                  <p className="text-sm text-muted-foreground">Real budget burn, forecast, and service-level dollars are not yet available</p>
                </div>
                <Badge variant="outline">Pending</Badge>
              </div>
            </div>

            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <p className="font-medium text-foreground">Best next upgrade</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Add a billing ingestion source, then join spend by project, service, and namespace to convert these operational signals into real FinOps views.
              </p>
            </div>

            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <p className="font-medium text-foreground">Current mode</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Live operational analytics are enabled now, even though exact cloud spend is not.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
