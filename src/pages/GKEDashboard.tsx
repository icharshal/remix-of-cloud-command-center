import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { 
  Activity, CheckCircle2, AlertCircle, XCircle, Server, Cpu, HardDrive, 
  RefreshCw, Terminal, TrendingUp, Scale, Clock, Search, Filter,
  ArrowUpRight, ArrowDownRight, Minus, Loader2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";

interface CollectedLog {
  id: string;
  agent_id: string;
  pod_name: string | null;
  container_name: string | null;
  namespace: string | null;
  log_level: string | null;
  message: string;
  timestamp: string;
  source: string | null;
}

interface CollectedEvent {
  id: string;
  agent_id: string;
  event_type: string;
  reason: string;
  message: string;
  namespace: string | null;
  involved_object: string | null;
  first_timestamp: string | null;
  last_timestamp: string | null;
  count: number | null;
  created_at: string;
}

interface CollectedMetric {
  id: string;
  agent_id: string;
  metric_name: string;
  metric_type: string;
  value: number;
  unit: string | null;
  pod_name: string | null;
  container_name: string | null;
  namespace: string | null;
  node_name: string | null;
  timestamp: string;
}

interface MonitoringAgent {
  id: string;
  agent_id: string;
  agent_name: string;
  agent_type: string;
  status: string;
  cluster_name: string | null;
  namespace: string | null;
  node_name: string | null;
  ip_address: string | null;
  last_heartbeat: string | null;
  metadata: Record<string, unknown> | null;
}

const chartConfig = {
  cpu: { label: "CPU", color: "hsl(var(--primary))" },
  memory: { label: "Memory", color: "hsl(var(--warning))" },
  usage: { label: "Usage", color: "hsl(var(--accent))" },
};

export default function GKEDashboard() {
  const [logFilter, setLogFilter] = useState("");
  const [logLevel, setLogLevel] = useState<string>("all");
  const [selectedPod, setSelectedPod] = useState<string>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  // Fetch logs with realtime updates
  const { data: logs = [], refetch: refetchLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['collected-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collected_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as CollectedLog[];
    },
  });

  // Fetch events with realtime updates
  const { data: events = [], refetch: refetchEvents, isLoading: eventsLoading } = useQuery({
    queryKey: ['collected-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collected_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as CollectedEvent[];
    },
  });

  // Fetch metrics with realtime updates
  const { data: metrics = [], refetch: refetchMetrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['collected-metrics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collected_metrics')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as CollectedMetric[];
    },
  });

  // Fetch agents
  const { data: agents = [], refetch: refetchAgents, isLoading: agentsLoading } = useQuery({
    queryKey: ['monitoring-agents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('monitoring_agents')
        .select('*')
        .order('last_heartbeat', { ascending: false });
      if (error) throw error;
      return data as MonitoringAgent[];
    },
  });

  // Set up realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('gke-dashboard-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'collected_logs' },
        () => refetchLogs()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'collected_events' },
        () => refetchEvents()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'collected_metrics' },
        () => refetchMetrics()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'monitoring_agents' },
        () => refetchAgents()
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetchLogs, refetchEvents, refetchMetrics, refetchAgents]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refetchLogs(), refetchEvents(), refetchMetrics(), refetchAgents()]);
    setIsRefreshing(false);
  };

  // Get unique pods from logs
  const uniquePods = [...new Set(logs.filter(l => l.pod_name).map(l => l.pod_name!))];

  // Filter logs
  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.message.toLowerCase().includes(logFilter.toLowerCase()) ||
                          (log.pod_name?.toLowerCase().includes(logFilter.toLowerCase()) ?? false);
    const matchesLevel = logLevel === "all" || log.log_level?.toUpperCase() === logLevel;
    const matchesPod = selectedPod === "all" || log.pod_name === selectedPod;
    return matchesSearch && matchesLevel && matchesPod;
  });

  // Calculate cluster stats from metrics
  const latestCpuMetrics = metrics.filter(m => m.metric_name.includes('cpu'));
  const latestMemoryMetrics = metrics.filter(m => m.metric_name.includes('memory'));
  
  const avgCpu = latestCpuMetrics.length > 0 
    ? Math.round(latestCpuMetrics.reduce((acc, m) => acc + Number(m.value), 0) / latestCpuMetrics.length)
    : 0;
  
  const avgMemory = latestMemoryMetrics.length > 0
    ? Math.round(latestMemoryMetrics.reduce((acc, m) => acc + Number(m.value), 0) / latestMemoryMetrics.length)
    : 0;

  // Process metrics for charts
  const processMetricsForChart = () => {
    const timeGroups: Record<string, { cpu: number[]; memory: number[] }> = {};
    
    metrics.forEach(metric => {
      const timeKey = format(new Date(metric.timestamp), 'HH:mm');
      if (!timeGroups[timeKey]) {
        timeGroups[timeKey] = { cpu: [], memory: [] };
      }
      if (metric.metric_name.includes('cpu')) {
        timeGroups[timeKey].cpu.push(Number(metric.value));
      }
      if (metric.metric_name.includes('memory')) {
        timeGroups[timeKey].memory.push(Number(metric.value));
      }
    });

    return Object.entries(timeGroups)
      .map(([time, values]) => ({
        time,
        cpu: values.cpu.length > 0 ? Math.round(values.cpu.reduce((a, b) => a + b, 0) / values.cpu.length) : 0,
        memory: values.memory.length > 0 ? Math.round(values.memory.reduce((a, b) => a + b, 0) / values.memory.length) : 0,
      }))
      .slice(-10);
  };

  const chartData = processMetricsForChart();

  // Get unique nodes from agents
  const nodes = agents.filter(a => a.node_name).map(a => ({
    name: a.node_name || a.agent_name,
    status: a.status === 'active' ? 'Ready' : 'NotReady',
    zone: a.cluster_name || 'unknown',
    lastHeartbeat: a.last_heartbeat,
  }));

  // Get pods from metrics
  const podsFromMetrics = [...new Set(metrics.filter(m => m.pod_name).map(m => m.pod_name!))];
  const podsList = podsFromMetrics.map(podName => {
    const podMetrics = metrics.filter(m => m.pod_name === podName);
    const cpuMetric = podMetrics.find(m => m.metric_name.includes('cpu'));
    const memMetric = podMetrics.find(m => m.metric_name.includes('memory'));
    return {
      name: podName,
      namespace: podMetrics[0]?.namespace || 'default',
      status: 'Running',
      cpu: cpuMetric ? `${Math.round(Number(cpuMetric.value))}${cpuMetric.unit || 'm'}` : 'N/A',
      memory: memMetric ? `${Math.round(Number(memMetric.value))}${memMetric.unit || 'Mi'}` : 'N/A',
    };
  });

  const getLogLevelColor = (level: string | null) => {
    switch (level?.toUpperCase()) {
      case "ERROR": return "text-destructive";
      case "WARN": case "WARNING": return "text-warning";
      case "INFO": return "text-primary";
      case "DEBUG": return "text-muted-foreground";
      default: return "text-foreground";
    }
  };

  const activeAgents = agents.filter(a => a.status === 'active').length;
  const totalPods = podsList.length || uniquePods.length;
  const hasData = logs.length > 0 || events.length > 0 || metrics.length > 0;

  const isLoading = logsLoading || eventsLoading || metricsLoading || agentsLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">GKE Dashboard</h1>
          <div className="mt-2 flex items-center gap-3">
            <p className="text-muted-foreground">
              Live monitoring from {agents.length} registered agent{agents.length !== 1 ? 's' : ''}
            </p>
            <Badge variant={realtimeConnected ? "default" : "secondary"} className="gap-1">
              <span className={`h-2 w-2 rounded-full ${realtimeConnected ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'}`} />
              {realtimeConnected ? 'Live' : 'Connecting...'}
            </Badge>
          </div>
        </div>
        <Button variant="outline" className="gap-2" onClick={handleRefresh} disabled={isRefreshing}>
          {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {/* Cluster Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Agents Status</CardTitle>
            <Activity className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{activeAgents}/{agents.length}</div>
            <Badge variant={activeAgents > 0 ? "default" : "secondary"} className="mt-2">
              {activeAgents > 0 ? 'Agents Active' : 'No Active Agents'}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Pods Tracked</CardTitle>
            <Server className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalPods}</div>
            <p className="text-xs text-muted-foreground">{logs.length} log entries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg CPU Usage</CardTitle>
            <Cpu className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{avgCpu}%</div>
            <Progress value={avgCpu} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Memory Usage</CardTitle>
            <HardDrive className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{avgMemory}%</div>
            <Progress value={avgMemory} className="mt-2 h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Resource Usage Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5" />
              CPU Usage Over Time
            </CardTitle>
            <CardDescription>
              {chartData.length > 0 ? 'CPU utilization from collected metrics' : 'No metrics data available'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="time" className="text-xs" />
                    <YAxis className="text-xs" unit="%" />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="cpu" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Deploy a monitoring agent to see live metrics
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Memory Usage Over Time
            </CardTitle>
            <CardDescription>
              {chartData.length > 0 ? 'Memory utilization from collected metrics' : 'No metrics data available'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="time" className="text-xs" />
                    <YAxis className="text-xs" unit="%" />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Area type="monotone" dataKey="memory" stroke="hsl(var(--warning))" fill="hsl(var(--warning) / 0.2)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Deploy a monitoring agent to see live metrics
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="pods" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pods">Pods</TabsTrigger>
          <TabsTrigger value="nodes">Nodes</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
        </TabsList>

        <TabsContent value="pods" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pods</CardTitle>
              <CardDescription>
                {podsList.length > 0 ? 'Pods tracked from monitoring agents' : 'No pod data collected yet'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : podsList.length > 0 ? (
                <div className="space-y-4">
                  {podsList.map((pod, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between border-b border-border pb-4 last:border-0 last:pb-0"
                    >
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-success" />
                        <div>
                          <p className="font-medium text-foreground">{pod.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {pod.namespace} | CPU: {pod.cpu} | Memory: {pod.memory}
                          </p>
                        </div>
                      </div>
                      <Badge variant="default">{pod.status}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No pod data available. Deploy a monitoring agent to collect pod metrics.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="nodes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Nodes</CardTitle>
              <CardDescription>
                {nodes.length > 0 ? 'Nodes from registered agents' : 'No node data available'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : nodes.length > 0 ? (
                <div className="space-y-4">
                  {nodes.map((node, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between border-b border-border pb-4 last:border-0 last:pb-0"
                    >
                      <div className="flex items-center gap-3">
                        <Server className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium text-foreground">{node.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Cluster: {node.zone} | Last seen: {node.lastHeartbeat ? formatDistanceToNow(new Date(node.lastHeartbeat), { addSuffix: true }) : 'Never'}
                          </p>
                        </div>
                      </div>
                      <Badge variant={node.status === 'Ready' ? "default" : "secondary"}>{node.status}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No node data available. Deploy a monitoring agent with node information.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Terminal className="h-5 w-5" />
                    Container Logs
                  </CardTitle>
                  <CardDescription>
                    {logs.length > 0 ? `${logs.length} logs collected from agents` : 'No logs collected yet'}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search logs..." 
                      className="pl-8 w-[200px]"
                      value={logFilter}
                      onChange={(e) => setLogFilter(e.target.value)}
                    />
                  </div>
                  <Select value={logLevel} onValueChange={setLogLevel}>
                    <SelectTrigger className="w-[120px]">
                      <Filter className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="Level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Levels</SelectItem>
                      <SelectItem value="ERROR">Error</SelectItem>
                      <SelectItem value="WARN">Warning</SelectItem>
                      <SelectItem value="INFO">Info</SelectItem>
                      <SelectItem value="DEBUG">Debug</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={selectedPod} onValueChange={setSelectedPod}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="All Pods" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Pods</SelectItem>
                      {uniquePods.map((pod) => (
                        <SelectItem key={pod} value={pod}>{pod.length > 25 ? pod.substring(0, 25) + '...' : pod}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredLogs.length > 0 ? (
                <ScrollArea className="h-[400px] rounded-md border bg-muted/30 p-4">
                  <div className="space-y-2 font-mono text-sm">
                    {filteredLogs.map((log) => (
                      <div key={log.id} className="flex flex-wrap gap-2 border-b border-border/50 pb-2 last:border-0">
                        <span className="text-muted-foreground text-xs whitespace-nowrap">
                          {format(new Date(log.timestamp), 'HH:mm:ss')}
                        </span>
                        <Badge variant="outline" className={`text-xs ${getLogLevelColor(log.log_level)}`}>
                          {log.log_level?.toUpperCase() || 'LOG'}
                        </Badge>
                        {log.pod_name && (
                          <span className="text-primary text-xs">[{log.pod_name.length > 20 ? log.pod_name.substring(0, 20) + '...' : log.pod_name}]</span>
                        )}
                        <span className="text-foreground break-all">{log.message}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="h-[400px] flex items-center justify-center text-muted-foreground border rounded-md bg-muted/30">
                  {logs.length === 0 ? 'No logs collected. Deploy a monitoring agent to start collecting logs.' : 'No logs match your filters.'}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Events</CardTitle>
              <CardDescription>
                {events.length > 0 ? `${events.length} events collected` : 'No events collected yet'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {eventsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : events.length > 0 ? (
                <div className="space-y-4">
                  {events.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-3 border-b border-border pb-4 last:border-0 last:pb-0"
                    >
                      {event.event_type === "Normal" ? (
                        <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
                      ) : (
                        <AlertCircle className="mt-0.5 h-5 w-5 text-warning" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground">{event.reason}</p>
                            {event.namespace && (
                              <Badge variant="outline" className="text-xs">{event.namespace}</Badge>
                            )}
                            {event.count && event.count > 1 && (
                              <Badge variant="secondary" className="text-xs">x{event.count}</Badge>
                            )}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{event.message}</p>
                        {event.involved_object && (
                          <p className="text-xs text-muted-foreground mt-1">Object: {event.involved_object}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No events collected. Deploy a monitoring agent to start collecting cluster events.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Registered Agents
              </CardTitle>
              <CardDescription>
                {agents.length > 0 ? `${activeAgents} of ${agents.length} agents active` : 'No agents registered'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {agentsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : agents.length > 0 ? (
                <div className="space-y-4">
                  {agents.map((agent) => (
                    <div
                      key={agent.id}
                      className="flex items-center justify-between border-b border-border pb-4 last:border-0 last:pb-0"
                    >
                      <div className="flex items-center gap-3">
                        {agent.status === 'active' ? (
                          <CheckCircle2 className="h-5 w-5 text-success" />
                        ) : (
                          <XCircle className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div>
                          <p className="font-medium text-foreground">{agent.agent_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {agent.agent_type} | {agent.cluster_name || 'No cluster'} 
                            {agent.node_name && ` | Node: ${agent.node_name}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ID: {agent.agent_id} | IP: {agent.ip_address || 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={agent.status === 'active' ? "default" : "secondary"}>
                          {agent.status}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {agent.last_heartbeat 
                            ? formatDistanceToNow(new Date(agent.last_heartbeat), { addSuffix: true })
                            : 'Never seen'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No agents registered. Go to Monitoring Agent page to deploy an agent.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
