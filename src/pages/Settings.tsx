import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Settings as SettingsIcon,
  Database,
  Ticket,
  Bell,
  CheckCircle2,
  XCircle,
  Loader2,
  Save,
  RefreshCw,
  Info,
  ExternalLink,
  Eye,
  EyeOff,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

interface JiraSettings {
  id: string;
  enabled: boolean;
  jira_base_url: string | null;
  jira_project_key: string | null;
  issue_type: string;
  due_days: number;
}

interface NotificationChannel {
  id: string;
  name: string;
  type: string;
  config: Record<string, string>;
  enabled: boolean;
  created_at: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export default function Settings() {
  const queryClient = useQueryClient();
  const [supabaseStatus, setSupabaseStatus] = useState<"idle" | "checking" | "ok" | "error">("idle");
  const [jiraForm, setJiraForm] = useState<Partial<JiraSettings>>({});
  const [showAnonKey, setShowAnonKey] = useState(false);

  // ── Jira settings ──────────────────────────────────────────
  const { data: jiraSettings, isLoading: jiraLoading } = useQuery({
    queryKey: ["settings-jira"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jira_automation_settings")
        .select("id, enabled, jira_base_url, jira_project_key, issue_type, due_days")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as JiraSettings | null;
    },
  });

  const { data: channels = [], isLoading: channelsLoading } = useQuery({
    queryKey: ["settings-channels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_channels")
        .select("id, name, type, config, enabled, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as NotificationChannel[];
    },
  });

  useEffect(() => {
    if (jiraSettings) setJiraForm(jiraSettings);
  }, [jiraSettings]);

  const saveJiraMutation = useMutation({
    mutationFn: async (values: Partial<JiraSettings>) => {
      if (jiraSettings?.id) {
        const { error } = await supabase
          .from("jira_automation_settings")
          .update(values)
          .eq("id", jiraSettings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("jira_automation_settings")
          .insert({ ...values, enabled: values.enabled ?? false, issue_type: values.issue_type ?? "Task", due_days: values.due_days ?? 2 });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Jira settings saved");
      queryClient.invalidateQueries({ queryKey: ["settings-jira"] });
      queryClient.invalidateQueries({ queryKey: ["jira-automation-settings"] });
    },
    onError: (err: Error) => toast.error(`Save failed: ${err.message}`),
  });

  const toggleChannelMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("notification_channels")
        .update({ enabled })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings-channels"] }),
    onError: (err: Error) => toast.error(`Update failed: ${err.message}`),
  });

  // ── Supabase connection check ──────────────────────────────
  const checkSupabase = async () => {
    setSupabaseStatus("checking");
    try {
      const { error } = await supabase.from("monitoring_agents").select("id").limit(1);
      setSupabaseStatus(error ? "error" : "ok");
    } catch {
      setSupabaseStatus("error");
    }
  };

  const maskedKey = SUPABASE_ANON_KEY
    ? `${SUPABASE_ANON_KEY.slice(0, 12)}${"•".repeat(20)}${SUPABASE_ANON_KEY.slice(-6)}`
    : "Not set";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="mt-1 text-muted-foreground">
            Configure integrations, notifications, and platform behaviour.
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <SettingsIcon className="h-3 w-3" />
          Configuration
        </Badge>
      </div>

      <Tabs defaultValue="connections">
        <TabsList>
          <TabsTrigger value="connections">
            <Database className="mr-1.5 h-3.5 w-3.5" />
            Connections
          </TabsTrigger>
          <TabsTrigger value="jira">
            <Ticket className="mr-1.5 h-3.5 w-3.5" />
            Jira
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="mr-1.5 h-3.5 w-3.5" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="about">
            <Info className="mr-1.5 h-3.5 w-3.5" />
            About
          </TabsTrigger>
        </TabsList>

        {/* ── Connections tab ─────────────────────────────────── */}
        <TabsContent value="connections" className="space-y-4 mt-4">
          {/* Supabase */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Supabase
                  </CardTitle>
                  <CardDescription>Database, realtime, and Edge Functions</CardDescription>
                </div>
                {supabaseStatus === "ok" && (
                  <Badge className="bg-success/10 text-success gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Connected
                  </Badge>
                )}
                {supabaseStatus === "error" && (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="h-3 w-3" /> Failed
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Project URL</Label>
                <div className="flex items-center gap-2">
                  <Input value={SUPABASE_URL ?? "Not set"} readOnly className="font-mono text-xs" />
                  {SUPABASE_URL && (
                    <a href={SUPABASE_URL.replace("/rest/v1", "")} target="_blank" rel="noreferrer">
                      <Button variant="outline" size="icon">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Anon Key</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={showAnonKey ? (SUPABASE_ANON_KEY ?? "Not set") : maskedKey}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button variant="outline" size="icon" onClick={() => setShowAnonKey(!showAnonKey)}>
                    {showAnonKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Set via <code className="rounded bg-muted px-1">VITE_SUPABASE_PUBLISHABLE_KEY</code> environment variable.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={checkSupabase}
                disabled={supabaseStatus === "checking"}
              >
                {supabaseStatus === "checking" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Test Connection
              </Button>
            </CardContent>
          </Card>

          {/* GCP — placeholder for Sprint 2 */}
          <Card className="border-dashed opacity-60">
            <CardHeader>
              <CardTitle className="text-muted-foreground">Google Cloud Platform</CardTitle>
              <CardDescription>
                Project ID, service account, and audit log sink — coming in Sprint 2.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="outline">Sprint 2</Badge>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Jira tab ────────────────────────────────────────── */}
        <TabsContent value="jira" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Ticket className="h-4 w-4" />
                    Jira Automation
                  </CardTitle>
                  <CardDescription>
                    Automatically create Jira tickets when GCP resources are detected
                  </CardDescription>
                </div>
                <Switch
                  checked={jiraForm.enabled ?? false}
                  onCheckedChange={(checked) => setJiraForm((f) => ({ ...f, enabled: checked }))}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {jiraLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Jira Base URL</Label>
                      <Input
                        placeholder="https://your-org.atlassian.net"
                        value={jiraForm.jira_base_url ?? ""}
                        onChange={(e) => setJiraForm((f) => ({ ...f, jira_base_url: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Project Key</Label>
                      <Input
                        placeholder="DEVOPS"
                        value={jiraForm.jira_project_key ?? ""}
                        onChange={(e) => setJiraForm((f) => ({ ...f, jira_project_key: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Issue Type</Label>
                      <Select
                        value={jiraForm.issue_type ?? "Task"}
                        onValueChange={(v) => setJiraForm((f) => ({ ...f, issue_type: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["Task", "Story", "Bug", "Incident"].map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Due Days (after detection)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={30}
                        value={jiraForm.due_days ?? 2}
                        onChange={(e) => setJiraForm((f) => ({ ...f, due_days: Number(e.target.value) }))}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                    <p className="font-medium mb-1">⚠ Jira API token</p>
                    <p>The API token is stored in your Supabase Edge Function secrets, not here. To update it, go to your Supabase dashboard → Edge Functions → Secrets and set <code className="rounded bg-amber-100 dark:bg-amber-900 px-1">JIRA_API_TOKEN</code>.</p>
                  </div>

                  <Button
                    onClick={() => saveJiraMutation.mutate(jiraForm)}
                    disabled={saveJiraMutation.isPending}
                  >
                    {saveJiraMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save Jira Settings
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Notifications tab ────────────────────────────────── */}
        <TabsContent value="notifications" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Notification Channels
              </CardTitle>
              <CardDescription>
                Manage where alerts and resource detection events are sent
              </CardDescription>
            </CardHeader>
            <CardContent>
              {channelsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading channels...
                </div>
              ) : channels.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  No notification channels configured yet. Add them from the{" "}
                  <a href="/alerts" className="text-primary underline">Alerting page</a>.
                </div>
              ) : (
                <div className="space-y-3">
                  {channels.map((ch) => (
                    <div
                      key={ch.id}
                      className="flex items-center justify-between rounded-lg border border-border p-4"
                    >
                      <div className="space-y-0.5">
                        <p className="font-medium text-foreground">{ch.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{ch.type}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={ch.enabled ? "default" : "secondary"}>
                          {ch.enabled ? "Active" : "Paused"}
                        </Badge>
                        <Switch
                          checked={ch.enabled}
                          onCheckedChange={(enabled) =>
                            toggleChannelMutation.mutate({ id: ch.id, enabled })
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── About tab ────────────────────────────────────────── */}
        <TabsContent value="about" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>DevOps Automation Hub</CardTitle>
              <CardDescription>Cloud Command Center — Evonence</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { label: "Version", value: "Sprint 1" },
                  { label: "Stack", value: "React + Vite + Supabase" },
                  { label: "Deployment", value: "Vercel" },
                  { label: "Database", value: "Supabase (PostgreSQL)" },
                  { label: "Realtime", value: "Supabase Realtime" },
                  { label: "Edge Functions", value: "check-alerts, monitoring-ingest" },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-md bg-muted/40 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Sprint Roadmap</p>
                <div className="space-y-1.5 text-sm text-muted-foreground">
                  {[
                    { sprint: "Sprint 1", label: "RLS fix, nav cleanup, Vercel deploy", done: true },
                    { sprint: "Sprint 2", label: "Resource Cleanup page, Project Selector, Audit Log pipeline", done: false },
                    { sprint: "Sprint 3", label: "Real GKE API, pod restart, alert dedup", done: false },
                    { sprint: "Sprint 4", label: "Auth (Google SSO), mobile layout, bundle pruning", done: false },
                  ].map(({ sprint, label, done }) => (
                    <div key={sprint} className="flex items-start gap-2">
                      {done ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      ) : (
                        <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-border" />
                      )}
                      <span>
                        <span className="font-medium text-foreground">{sprint}</span> — {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
