import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Save, Ticket, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";

interface JiraAutomationSettings {
  id: string;
  enabled: boolean;
  jira_base_url: string | null;
  jira_project_key: string | null;
  issue_type: string;
  due_days: number;
}

interface JiraResourceTicket {
  id: string;
  resource_type: string;
  resource_name: string;
  creator_name: string | null;
  creator_email: string | null;
  summary: string;
  due_date: string;
  status: "pending" | "created" | "failed" | "skipped";
  jira_issue_key: string | null;
  jira_issue_url: string | null;
  error_message: string | null;
  created_at: string;
}

const issueTypes = ["Task", "Story", "Bug", "Incident"];

export default function JiraAutomation() {
  const queryClient = useQueryClient();
  const [formState, setFormState] = useState<JiraAutomationSettings | null>(null);

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["jira-automation-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jira_automation_settings")
        .select("id, enabled, jira_base_url, jira_project_key, issue_type, due_days")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return (data as JiraAutomationSettings | null) ?? null;
    },
  });

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ["jira-resource-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jira_resource_tickets")
        .select("id, resource_type, resource_name, creator_name, creator_email, summary, due_date, status, jira_issue_key, jira_issue_url, error_message, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        throw error;
      }

      return data as JiraResourceTicket[];
    },
  });

  useEffect(() => {
    if (settings) {
      setFormState(settings);
    }
  }, [settings]);

  useEffect(() => {
    const channel = supabase
      .channel("jira-automation-page")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jira_automation_settings" },
        () => queryClient.invalidateQueries({ queryKey: ["jira-automation-settings"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jira_resource_tickets" },
        () => queryClient.invalidateQueries({ queryKey: ["jira-resource-tickets"] }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const saveSettings = useMutation({
    mutationFn: async (nextSettings: JiraAutomationSettings) => {
      const { error } = await supabase
        .from("jira_automation_settings")
        .update({
          enabled: nextSettings.enabled,
          jira_base_url: nextSettings.jira_base_url,
          jira_project_key: nextSettings.jira_project_key,
          issue_type: nextSettings.issue_type,
          due_days: nextSettings.due_days,
        })
        .eq("id", nextSettings.id);

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jira-automation-settings"] });
      toast.success("Jira automation settings saved");
    },
    onError: (error: Error) => {
      toast.error(`Failed to save Jira settings: ${error.message}`);
    },
  });

  const summary = useMemo(() => {
    const created = tickets.filter((ticket) => ticket.status === "created").length;
    const failed = tickets.filter((ticket) => ticket.status === "failed").length;
    const pending = tickets.filter((ticket) => ticket.status === "pending").length;
    return { created, failed, pending };
  }, [tickets]);

  const normalizedBaseUrl = formState?.jira_base_url?.trim().replace(/\/+$/, "") ?? "";
  const normalizedProjectKey = formState?.jira_project_key?.trim().toUpperCase() ?? "";
  const settingsIssues = [
    !normalizedBaseUrl ? "Jira base URL is required." : null,
    normalizedBaseUrl && !/^https:\/\/.+/i.test(normalizedBaseUrl)
      ? "Jira base URL should start with https://"
      : null,
    !normalizedProjectKey ? "Jira project key is required." : null,
    formState && formState.due_days < 2 ? "Due days should be at least 2 for this workflow." : null,
  ].filter(Boolean) as string[];

  const canSaveSettings = Boolean(formState) && settingsIssues.length === 0;

  const getStatusBadge = (status: JiraResourceTicket["status"]) => {
    switch (status) {
      case "created":
        return <Badge className="bg-success text-success-foreground">Created</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "pending":
        return <Badge className="bg-warning text-warning-foreground">Pending</Badge>;
      default:
        return <Badge variant="secondary">Skipped</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Jira Automation</h1>
        <p className="mt-2 text-muted-foreground">
          Auto-create Jira tickets when Google Cloud resource creation events are detected from ingested logs.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tickets Created</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{summary.created}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{summary.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Failures</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{summary.failed}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <Card>
          <CardHeader>
            <CardTitle>Automation Settings</CardTitle>
            <CardDescription>
              Configure the Jira project and default ticket behavior. Jira API credentials still need to be provided via environment variables.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {settingsLoading || !formState ? (
              <div className="py-6 text-sm text-muted-foreground">Loading Jira configuration...</div>
            ) : (
              <>
                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div>
                    <p className="font-medium text-foreground">Enable automation</p>
                    <p className="text-sm text-muted-foreground">Automatically create Jira tickets from new-resource log events.</p>
                  </div>
                  <Switch
                    checked={formState.enabled}
                    onCheckedChange={(checked) => setFormState({ ...formState, enabled: checked })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="jira_base_url">Jira Base URL</Label>
                  <Input
                    id="jira_base_url"
                    placeholder="https://your-company.atlassian.net"
                    value={formState.jira_base_url ?? ""}
                    onChange={(event) =>
                      setFormState({ ...formState, jira_base_url: event.target.value.trim() })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="jira_project_key">Jira Project Key</Label>
                  <Input
                    id="jira_project_key"
                    placeholder="OPS"
                    value={formState.jira_project_key ?? ""}
                    onChange={(event) =>
                      setFormState({
                        ...formState,
                        jira_project_key: event.target.value.toUpperCase().trim(),
                      })
                    }
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Issue Type</Label>
                    <Select
                      value={formState.issue_type}
                      onValueChange={(value) => setFormState({ ...formState, issue_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {issueTypes.map((issueType) => (
                          <SelectItem key={issueType} value={issueType}>
                            {issueType}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="due_days">Due Days</Label>
                    <Input
                      id="due_days"
                      type="number"
                      min="2"
                      value={formState.due_days}
                      onChange={(event) =>
                        setFormState({
                          ...formState,
                          due_days: Math.max(2, Number(event.target.value) || 2),
                        })
                      }
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-border p-4">
                  <p className="font-medium text-foreground">Best-practice checklist</p>
                  <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                    <p>1. Use an HTTPS Jira base URL and a dedicated project key for automation.</p>
                    <p>2. Keep due date at 2 days or more to avoid immediate SLA churn.</p>
                    <p>3. Provide `JIRA_API_EMAIL` and `JIRA_API_TOKEN` in the edge function environment before enabling automation.</p>
                    <p>4. Feed structured Google Cloud audit logs so creator and resource mapping stay accurate.</p>
                  </div>
                </div>

                {settingsIssues.length > 0 ? (
                  <div className="rounded-lg border border-warning/40 bg-warning/5 p-4 text-sm text-warning-foreground">
                    {settingsIssues.map((issue) => (
                      <p key={issue}>{issue}</p>
                    ))}
                  </div>
                ) : null}

                <Button
                  className="w-full"
                  onClick={() =>
                    saveSettings.mutate({
                      ...formState,
                      jira_base_url: normalizedBaseUrl,
                      jira_project_key: normalizedProjectKey,
                    })
                  }
                  disabled={saveSettings.isPending || !canSaveSettings}
                >
                  {saveSettings.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save Settings
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detected Resource Tickets</CardTitle>
            <CardDescription>
              Recent Jira automation activity from Google Cloud resource creation logs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {ticketsLoading ? (
              <div className="py-6 text-sm text-muted-foreground">Loading detected ticket events...</div>
            ) : tickets.length > 0 ? (
              <div className="space-y-4">
                {tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="rounded-lg border border-border p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-foreground">{ticket.summary}</p>
                          {getStatusBadge(ticket.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Resource: {ticket.resource_type} / {ticket.resource_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Creator: {ticket.creator_email || ticket.creator_name || "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Due {ticket.due_date} · Detected {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                        </p>
                        {!ticket.creator_email && !ticket.creator_name ? (
                          <p className="text-xs text-warning">
                            Creator could not be resolved from the source log, so Jira assignee lookup may fail.
                          </p>
                        ) : null}
                        {ticket.error_message ? (
                          <p className="text-xs text-destructive">{ticket.error_message}</p>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2">
                        {ticket.jira_issue_url ? (
                          <a
                            href={ticket.jira_issue_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                          >
                            <Ticket className="h-4 w-4" />
                            {ticket.jira_issue_key || "Open Issue"}
                          </a>
                        ) : (
                          <Badge variant="outline">No Jira issue yet</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                No resource-creation tickets have been detected yet. Ingest Google Cloud audit-style creation logs to start the automation.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
