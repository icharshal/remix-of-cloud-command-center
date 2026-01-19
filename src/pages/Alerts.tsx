import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Bell, Plus, Trash2, AlertTriangle, AlertCircle, Info, CheckCircle2,
  Clock, Play, Loader2, X, BarChart3, Calendar
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import NotificationChannels from "@/components/NotificationChannels";
import AlertHistoryDashboard from "@/components/AlertHistoryDashboard";
import CronJobManager from "@/components/CronJobManager";

interface AlertRule {
  id: string;
  name: string;
  description: string | null;
  metric_name: string;
  condition: string;
  threshold: number;
  severity: string;
  enabled: boolean;
  cooldown_minutes: number;
  created_at: string;
}

interface TriggeredAlert {
  id: string;
  rule_id: string | null;
  metric_value: number;
  threshold: number;
  agent_id: string | null;
  pod_name: string | null;
  node_name: string | null;
  namespace: string | null;
  message: string;
  severity: string;
  status: string;
  triggered_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
}

const defaultRule = {
  name: "",
  description: "",
  metric_name: "cpu",
  condition: "greater_than",
  threshold: 80,
  severity: "warning",
  cooldown_minutes: 5,
};

export default function Alerts() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newRule, setNewRule] = useState(defaultRule);
  const [isChecking, setIsChecking] = useState(false);
  const queryClient = useQueryClient();

  // Fetch alert rules
  const { data: rules = [], isLoading: rulesLoading } = useQuery({
    queryKey: ['alert-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alert_rules')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as AlertRule[];
    },
  });

  // Fetch triggered alerts
  const { data: alerts = [], isLoading: alertsLoading, refetch: refetchAlerts } = useQuery({
    queryKey: ['triggered-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('triggered_alerts')
        .select('*')
        .order('triggered_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as TriggeredAlert[];
    },
  });

  // Set up realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('alerts-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alert_rules' },
        () => queryClient.invalidateQueries({ queryKey: ['alert-rules'] })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'triggered_alerts' },
        () => queryClient.invalidateQueries({ queryKey: ['triggered-alerts'] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Create rule mutation
  const createRule = useMutation({
    mutationFn: async (rule: typeof defaultRule) => {
      const { error } = await supabase.from('alert_rules').insert({
        name: rule.name,
        description: rule.description || null,
        metric_name: rule.metric_name,
        condition: rule.condition,
        threshold: rule.threshold,
        severity: rule.severity,
        cooldown_minutes: rule.cooldown_minutes,
        enabled: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
      setIsDialogOpen(false);
      setNewRule(defaultRule);
      toast.success("Alert rule created");
    },
    onError: (error) => {
      toast.error("Failed to create rule: " + error.message);
    },
  });

  // Toggle rule mutation
  const toggleRule = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from('alert_rules')
        .update({ enabled })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
    },
  });

  // Delete rule mutation
  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('alert_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
      toast.success("Alert rule deleted");
    },
  });

  // Acknowledge alert mutation
  const acknowledgeAlert = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('triggered_alerts')
        .update({ status: 'acknowledged', acknowledged_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['triggered-alerts'] });
      toast.success("Alert acknowledged");
    },
  });

  // Resolve alert mutation
  const resolveAlert = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('triggered_alerts')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['triggered-alerts'] });
      toast.success("Alert resolved");
    },
  });

  // Check alerts manually
  const handleCheckAlerts = async () => {
    setIsChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-alerts');
      if (error) throw error;
      toast.success(`Checked ${data.rules_checked} rules, ${data.alerts_triggered} new alerts triggered`);
      refetchAlerts();
    } catch (error: unknown) {
      toast.error("Failed to check alerts: " + (error as Error).message);
    } finally {
      setIsChecking(false);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-warning" />;
      default: return <Info className="h-4 w-4 text-primary" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical': return <Badge variant="destructive">Critical</Badge>;
      case 'warning': return <Badge className="bg-warning text-warning-foreground">Warning</Badge>;
      default: return <Badge variant="secondary">Info</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge variant="destructive">Active</Badge>;
      case 'acknowledged': return <Badge className="bg-warning text-warning-foreground">Acknowledged</Badge>;
      case 'resolved': return <Badge variant="secondary">Resolved</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const activeAlerts = alerts.filter(a => a.status === 'active');
  const acknowledgedAlerts = alerts.filter(a => a.status === 'acknowledged');
  const resolvedAlerts = alerts.filter(a => a.status === 'resolved');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Alerting</h1>
          <p className="mt-2 text-muted-foreground">
            Configure alert rules and manage triggered alerts
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCheckAlerts} disabled={isChecking}>
            {isChecking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            Check Now
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Rule
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Alert Rule</DialogTitle>
                <DialogDescription>
                  Define conditions that will trigger alerts when metrics exceed thresholds.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Rule Name</Label>
                  <Input
                    id="name"
                    placeholder="High CPU Usage"
                    value={newRule.name}
                    onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    placeholder="Alert when CPU exceeds threshold"
                    value={newRule.description}
                    onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Metric</Label>
                    <Select value={newRule.metric_name} onValueChange={(v) => setNewRule({ ...newRule, metric_name: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cpu">CPU Usage</SelectItem>
                        <SelectItem value="memory">Memory Usage</SelectItem>
                        <SelectItem value="disk">Disk Usage</SelectItem>
                        <SelectItem value="network">Network</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Condition</Label>
                    <Select value={newRule.condition} onValueChange={(v) => setNewRule({ ...newRule, condition: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="greater_than">Greater than</SelectItem>
                        <SelectItem value="less_than">Less than</SelectItem>
                        <SelectItem value="equals">Equals</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="threshold">Threshold (%)</Label>
                    <Input
                      id="threshold"
                      type="number"
                      value={newRule.threshold}
                      onChange={(e) => setNewRule({ ...newRule, threshold: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Severity</Label>
                    <Select value={newRule.severity} onValueChange={(v) => setNewRule({ ...newRule, severity: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cooldown">Cooldown (minutes)</Label>
                  <Input
                    id="cooldown"
                    type="number"
                    value={newRule.cooldown_minutes}
                    onChange={(e) => setNewRule({ ...newRule, cooldown_minutes: Number(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum time between repeated alerts for the same resource
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={() => createRule.mutate(newRule)} disabled={!newRule.name || createRule.isPending}>
                  {createRule.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Create Rule
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{activeAlerts.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Acknowledged</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{acknowledgedAlerts.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Resolved (24h)</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{resolvedAlerts.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Alert Rules</CardTitle>
            <Bell className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{rules.length}</div>
            <p className="text-xs text-muted-foreground">{rules.filter(r => r.enabled).length} enabled</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="alerts" className="gap-2">
            Alerts
            {activeAlerts.length > 0 && (
              <Badge variant="destructive" className="ml-1">{activeAlerts.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            History
          </TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="scheduler" className="gap-2">
            <Calendar className="h-4 w-4" />
            Scheduler
          </TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Triggered Alerts</CardTitle>
              <CardDescription>
                {alerts.length > 0 ? `${alerts.length} alerts in history` : 'No alerts triggered yet'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {alertsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : alerts.length > 0 ? (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`flex items-start gap-3 border rounded-lg p-4 ${
                          alert.status === 'active' ? 'border-destructive/50 bg-destructive/5' : 
                          alert.status === 'acknowledged' ? 'border-warning/50 bg-warning/5' : 
                          'border-border'
                        }`}
                      >
                        {getSeverityIcon(alert.severity)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {getSeverityBadge(alert.severity)}
                            {getStatusBadge(alert.status)}
                            <span className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(alert.triggered_at), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="mt-1 font-medium text-foreground">{alert.message}</p>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            {alert.pod_name && <span>Pod: {alert.pod_name}</span>}
                            {alert.node_name && <span>Node: {alert.node_name}</span>}
                            {alert.namespace && <span>Namespace: {alert.namespace}</span>}
                          </div>
                        </div>
                        {alert.status === 'active' && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => acknowledgeAlert.mutate(alert.id)}
                            >
                              Acknowledge
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => resolveAlert.mutate(alert.id)}
                            >
                              Resolve
                            </Button>
                          </div>
                        )}
                        {alert.status === 'acknowledged' && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => resolveAlert.mutate(alert.id)}
                          >
                            Resolve
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No alerts have been triggered. Create alert rules and deploy monitoring agents to start receiving alerts.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <AlertHistoryDashboard />
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Alert Rules</CardTitle>
              <CardDescription>
                {rules.length > 0 ? `${rules.length} rules configured` : 'No alert rules configured'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rulesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : rules.length > 0 ? (
                <div className="space-y-4">
                  {rules.map((rule) => (
                    <div
                      key={rule.id}
                      className="flex items-center justify-between border rounded-lg p-4"
                    >
                      <div className="flex items-center gap-4">
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={(enabled) => toggleRule.mutate({ id: rule.id, enabled })}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground">{rule.name}</p>
                            {getSeverityBadge(rule.severity)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {rule.metric_name} {rule.condition.replace('_', ' ')} {rule.threshold}%
                            {rule.description && ` • ${rule.description}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Cooldown: {rule.cooldown_minutes}m • Created {formatDistanceToNow(new Date(rule.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteRule.mutate(rule.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No alert rules configured. Click "New Rule" to create your first alert rule.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduler" className="space-y-4">
          <CronJobManager />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <NotificationChannels />
        </TabsContent>
      </Tabs>
    </div>
  );
}
