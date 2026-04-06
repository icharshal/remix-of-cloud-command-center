import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  CheckCircle2,
  FileWarning,
  Loader2,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

interface CollectedLog {
  id: string;
  message: string;
  log_level: string | null;
  source: string | null;
  namespace: string | null;
  timestamp: string;
}

interface TriggeredAlert {
  id: string;
  message: string;
  severity: string;
  status: string;
  triggered_at: string;
}

interface JiraResourceTicket {
  id: string;
  resource_type: string;
  resource_name: string;
  creator_email: string | null;
  status: string;
  created_at: string;
  metadata: {
    service_name?: string;
    method_name?: string;
  } | null;
}

interface Finding {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  recommendation: string;
  timestamp?: string;
}

const getSeverityBadge = (severity: Finding["severity"]) => {
  const variant =
    severity === "high" ? "destructive" : severity === "medium" ? "secondary" : "default";

  return (
    <Badge variant={variant}>
      {severity}
    </Badge>
  );
};

export default function SecurityAnalyzer() {
  const queryClient = useQueryClient();

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["security-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collected_logs")
        .select("id, message, log_level, source, namespace, timestamp")
        .order("timestamp", { ascending: false })
        .limit(100);

      if (error) {
        throw error;
      }

      return data as CollectedLog[];
    },
  });

  const { data: alerts = [], isLoading: alertsLoading } = useQuery({
    queryKey: ["security-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("triggered_alerts")
        .select("id, message, severity, status, triggered_at")
        .order("triggered_at", { ascending: false })
        .limit(50);

      if (error) {
        throw error;
      }

      return data as TriggeredAlert[];
    },
  });

  const { data: resources = [], isLoading: resourcesLoading } = useQuery({
    queryKey: ["security-resources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jira_resource_tickets")
        .select("id, resource_type, resource_name, creator_email, status, created_at, metadata")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        throw error;
      }

      return data as JiraResourceTicket[];
    },
  });

  const handleScan = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["security-logs"] }),
      queryClient.invalidateQueries({ queryKey: ["security-alerts"] }),
      queryClient.invalidateQueries({ queryKey: ["security-resources"] }),
    ]);
    toast.success("Security signals refreshed");
  };

  const iamFindings = useMemo<Finding[]>(() => {
    const fromLogs = logs
      .filter((log) => {
        const text = `${log.message} ${log.source ?? ""}`.toLowerCase();
        return text.includes("iam") || text.includes("owner role") || text.includes("service account");
      })
      .slice(0, 5)
      .map((log) => ({
        id: `iam-log-${log.id}`,
        severity: log.message.toLowerCase().includes("owner") ? "high" : "medium",
        title: "IAM-related activity detected",
        description: log.message,
        recommendation: "Review the referenced IAM change and confirm least-privilege access is still enforced.",
        timestamp: log.timestamp,
      }));

    const missingCreator = resources
      .filter((resource) => !resource.creator_email)
      .slice(0, 3)
      .map((resource) => ({
        id: `iam-resource-${resource.id}`,
        severity: "low" as const,
        title: "Unattributed resource creation",
        description: `${resource.resource_name} was created without a resolved creator identity in the audit trail.`,
        recommendation: "Ensure Google Cloud audit logs preserve principalEmail so ownership and review assignment stay reliable.",
        timestamp: resource.created_at,
      }));

    return [...fromLogs, ...missingCreator];
  }, [logs, resources]);

  const storageFindings = useMemo<Finding[]>(() => {
    const bucketCreations = resources
      .filter((resource) => resource.resource_type.includes("bucket"))
      .slice(0, 5)
      .map((resource) => ({
        id: `storage-${resource.id}`,
        severity: resource.status === "failed" ? "high" : "low",
        title: "Cloud Storage bucket created",
        description: `${resource.resource_name} was created${resource.creator_email ? ` by ${resource.creator_email}` : ""}.`,
        recommendation: "Verify uniform bucket-level access, public access settings, versioning, and retention rules for this bucket.",
        timestamp: resource.created_at,
      }));

    const publicHints = logs
      .filter((log) => {
        const text = log.message.toLowerCase();
        return text.includes("allusers") || text.includes("public") || text.includes("bucket");
      })
      .slice(0, 3)
      .map((log) => ({
        id: `storage-log-${log.id}`,
        severity: "medium" as const,
        title: "Bucket access signal detected",
        description: log.message,
        recommendation: "Review bucket IAM bindings and public exposure settings for the resource mentioned in this log.",
        timestamp: log.timestamp,
      }));

    return [...bucketCreations, ...publicHints];
  }, [logs, resources]);

  const networkFindings = useMemo<Finding[]>(() => {
    const resourceSignals = resources
      .filter((resource) => {
        const type = resource.resource_type.toLowerCase();
        return type.includes("network") || type.includes("firewall");
      })
      .slice(0, 5)
      .map((resource) => ({
        id: `network-${resource.id}`,
        severity: "medium" as const,
        title: "Network-related resource created",
        description: `${resource.resource_type} ${resource.resource_name} was detected from Google Cloud logs.`,
        recommendation: "Review ingress rules, source ranges, and whether the resource should be internet-accessible.",
        timestamp: resource.created_at,
      }));

    const permissiveLogs = logs
      .filter((log) => {
        const text = log.message.toLowerCase();
        return text.includes("0.0.0.0/0") || text.includes("firewall") || text.includes("ingress");
      })
      .slice(0, 3)
      .map((log) => ({
        id: `network-log-${log.id}`,
        severity: "high" as const,
        title: "Potentially permissive network change",
        description: log.message,
        recommendation: "Check whether the network rule is broader than intended, especially if it exposes 0.0.0.0/0.",
        timestamp: log.timestamp,
      }));

    return [...resourceSignals, ...permissiveLogs];
  }, [logs, resources]);

  const certificateFindings = useMemo<Finding[]>(() => {
    const certLogs = logs
      .filter((log) => {
        const text = log.message.toLowerCase();
        return text.includes("ssl") || text.includes("certificate") || text.includes("tls") || text.includes("expired");
      })
      .slice(0, 5)
      .map((log) => ({
        id: `cert-${log.id}`,
        severity: log.message.toLowerCase().includes("expired") ? "high" : "medium",
        title: "Certificate-related signal detected",
        description: log.message,
        recommendation: "Review certificate validity, issuer trust, and renewal automation for the service referenced here.",
        timestamp: log.timestamp,
      }));

    return certLogs;
  }, [logs]);

  const coverageFindings = useMemo<Finding[]>(() => {
    const items: Finding[] = [];

    if (logs.length < 10) {
      items.push({
        id: "coverage-low-log-volume",
        severity: "medium",
        title: "Low security log coverage",
        description: `Only ${logs.length} recent log entries are available, which is too little for a trustworthy security view.`,
        recommendation: "Increase audit log ingestion or automate Cloud Logging replay into monitoring-ingest so findings are based on real volume.",
      });
    }

    if (resources.length === 0) {
      items.push({
        id: "coverage-no-resources",
        severity: "medium",
        title: "No detected resource inventory",
        description: "No created resources have been detected from Google Cloud logs yet.",
        recommendation: "Feed structured Google Cloud audit logs into the app so resource creation events can be reviewed here.",
      });
    }

    if (alerts.length === 0) {
      items.push({
        id: "coverage-no-alerts",
        severity: "low",
        title: "No linked alert signal",
        description: "Security view has no triggered alerts to correlate with logs and resource changes.",
        recommendation: "Add alert rules for IAM, network, or suspicious resource activity so security issues surface automatically.",
      });
    }

    return items;
  }, [alerts.length, logs.length, resources.length]);

  const allFindings = [
    ...iamFindings,
    ...storageFindings,
    ...networkFindings,
    ...certificateFindings,
    ...coverageFindings,
  ];

  const highSeverity = allFindings.filter((finding) => finding.severity === "high").length;
  const mediumSeverity = allFindings.filter((finding) => finding.severity === "medium").length;
  const loading = logsLoading || alertsLoading || resourcesLoading;

  const renderFindings = (findings: Finding[], emptyMessage: string) => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading security signals...
        </div>
      );
    }

    if (findings.length === 0) {
      return (
        <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {findings.map((finding) => (
          <div
            key={finding.id}
            className="space-y-2 border-b border-border pb-6 last:border-0 last:pb-0"
          >
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                {getSeverityBadge(finding.severity)}
                <h3 className="font-semibold text-foreground">{finding.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground">{finding.description}</p>
              {finding.timestamp ? (
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(finding.timestamp), { addSuffix: true })}
                </p>
              ) : null}
            </div>
            <div className="rounded-lg bg-secondary p-3">
              <p className="text-sm">
                <span className="font-medium">Recommendation:</span> {finding.recommendation}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Security Analyzer</h1>
          <p className="mt-2 text-muted-foreground">
            Live security signals derived from ingested logs, alerts, and detected Google Cloud resources.
          </p>
        </div>
        <Button onClick={handleScan} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh Signals
        </Button>
      </div>

      <Card className="border-warning/40 bg-warning/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileWarning className="h-5 w-5 text-warning" />
            Honest Security Mode
          </CardTitle>
          <CardDescription>
            This page now reflects real signals from the app, but it is not yet a full Google Cloud security scanner.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Findings are inferred from ingested logs, alerts, and created-resource records. The strongest next upgrade is direct audit-log ingestion with richer security-specific rules.
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Findings</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{allFindings.length}</div>
            <p className="text-xs text-muted-foreground">Live findings and coverage gaps</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">High Severity</CardTitle>
            <ShieldAlert className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{highSeverity}</div>
            <p className="text-xs text-muted-foreground">Needs immediate review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Medium Severity</CardTitle>
            <AlertCircle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{mediumSeverity}</div>
            <p className="text-xs text-muted-foreground">Worth following up soon</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Signal Health</CardTitle>
            {coverageFindings.length === 0 ? (
              <ShieldCheck className="h-4 w-4 text-success" />
            ) : (
              <AlertCircle className="h-4 w-4 text-warning" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {coverageFindings.length === 0 ? "Good" : "Partial"}
            </div>
            <p className="text-xs text-muted-foreground">
              {logs.length} logs, {resources.length} resources, {alerts.length} alerts available
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="coverage">
        <TabsList>
          <TabsTrigger value="coverage">Coverage</TabsTrigger>
          <TabsTrigger value="iam">IAM & Access</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
          <TabsTrigger value="network">Network</TabsTrigger>
          <TabsTrigger value="certificates">Certificates</TabsTrigger>
        </TabsList>

        <TabsContent value="coverage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Coverage Gaps</CardTitle>
              <CardDescription>
                Gaps in the current telemetry and security signal quality.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderFindings(
                coverageFindings,
                "Security coverage looks healthy for the currently ingested dataset.",
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="iam" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>IAM & Access Signals</CardTitle>
              <CardDescription>
                Identity-related findings derived from audit logs and resource ownership gaps.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderFindings(
                iamFindings,
                "No IAM-related findings detected from the current log set.",
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="storage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Storage Security Signals</CardTitle>
              <CardDescription>
                Bucket-related activity and access hints from detected resources and logs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderFindings(
                storageFindings,
                "No storage-specific findings detected yet.",
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="network" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Network Security Signals</CardTitle>
              <CardDescription>
                Firewall, ingress, and network-related resource creation findings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderFindings(
                networkFindings,
                "No network-related findings detected from the current dataset.",
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="certificates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Certificate Signals</CardTitle>
              <CardDescription>
                SSL and certificate hints found in logs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderFindings(
                certificateFindings,
                "No certificate-related logs have been detected yet.",
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
