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
} from "lucide-react";

import { collection, query, orderBy, limit, getDocs, addDoc, updateDoc, doc } from "firebase/firestore";
import { db, normalizeDoc } from "@/lib/firebase";
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

const FIREBASE_PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID as string;

export default function Settings() {
  const queryClient = useQueryClient();
  const [firestoreStatus, setFirestoreStatus] = useState<"idle" | "checking" | "ok" | "error">("idle");
  const [jiraForm, setJiraForm] = useState<Partial<JiraSettings>>({});

  const { data: jiraSettings, isLoading: jiraLoading } = useQuery({
    queryKey: ["settings-jira"],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, "jira_automation_settings"), orderBy("created_at", "desc"), limit(1)));
      if (snap.empty) return null;
      return normalizeDoc<JiraSettings>(snap.docs[0]);
    },
  });

  const { data: channels = [], isLoading: channelsLoading } = useQuery({
    queryKey: ["settings-channels"],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, "notification_channels"), orderBy("created_at", "desc")));
      return snap.docs.map(d => normalizeDoc<NotificationChannel>(d));
    },
  });

  useEffect(() => {
    if (jiraSettings) setJiraForm(jiraSettings);
  }, [jiraSettings]);

  const saveJiraMutation = useMutation({
    mutationFn: async (values: Partial<JiraSettings>) => {
      if (jiraSettings?.id) {
        await updateDoc(doc(db, "jira_automation_settings", jiraSettings.id), values as Record<string, unknown>);
      } else {
        await addDoc(collection(db, "jira_automation_settings"), {
          ...values,
          enabled: values.enabled ?? false,
          issue_type: values.issue_type ?? "Task",
          due_days: values.due_days ?? 2,
          created_at: new Date().toISOString(),
        });
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
      await updateDoc(doc(db, "notification_channels", id), { enabled });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings-channels"] }),
    onError: (err: Error) => toast.error(`Update failed: ${err.message}`),
  });

  const checkFirestore = async () => {
    setFirestoreStatus("checking");
    try {
      await getDocs(query(collection(db, "monitoring_agents"), limit(1)));
      setFirestoreStatus("ok");
    } catch {
      setFirestoreStatus("error");
    }
  };

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
          {/* Firestore */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Firestore
                  </CardTitle>
                  <CardDescription>Google Cloud Firestore — database and realtime</CardDescription>
                </div>
                {firestoreStatus === "ok" && (
                  <Badge className="bg-success/10 text-success gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Connected
                  </Badge>
                )}
                {firestoreStatus === "error" && (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="h-3 w-3" /> Failed
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Firebase Project ID</Label>
                <div className="flex items-center gap-2">
                  <Input value={FIREBASE_PROJECT_ID ?? "Not set"} readOnly className="font-mono text-xs" />
                  {FIREBASE_PROJECT_ID && (
                    <a href={`https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}`} target="_blank" rel="noreferrer">
                      <Button variant="outline" size="icon">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Set via <code className="rounded bg-muted px-1">VITE_FIREBASE_PROJECT_ID</code> environment variable.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={checkFirestore}
                disabled={firestoreStatus === "checking"}
              >
                {firestoreStatus === "checking" ? (
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
                    <p>Set <code className="rounded bg-amber-100 dark:bg-amber-900 px-1">JIRA_API_TOKEN</code> as an environment variable in your Cloud Run service or Secret Manager.</p>
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
                  { label: "Stack", value: "React + Vite + Firestore" },
                  { label: "Deployment", value: "Cloud Run" },
                  { label: "Database", value: "Cloud Firestore" },
                  { label: "Realtime", value: "Firestore onSnapshot" },
                  { label: "Backend Services", value: "check-alerts, monitoring-ingest (Cloud Run)" },
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
