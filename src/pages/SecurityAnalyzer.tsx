import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  CheckCircle2,
  FileWarning,
  KeyRound,
  Loader2,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db, normalizeDoc } from "@/lib/firebase";

interface CollectedLog {
  id: string;
  message: string;
  labels: Record<string, string> | null;
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

interface AccessEntry {
  id: string;
  principal: string;
  access: string;
  resource: string;
  action: "granted" | "revoked" | "used" | "created";
  source: "policy-delta" | "authorization-info" | "resource-ticket" | "log-labels";
  risk: "high" | "medium" | "low";
  actor?: string | null;
  lastSeen: string;
  evidence: string;
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
      const snap = await getDocs(query(collection(db, "collected_logs"), orderBy("timestamp", "desc"), limit(100)));
      return snap.docs.map(d => normalizeDoc<CollectedLog>(d));
    },
  });

  const { data: alerts = [], isLoading: alertsLoading } = useQuery({
    queryKey: ["security-alerts"],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, "triggered_alerts"), orderBy("triggered_at", "desc"), limit(50)));
      return snap.docs.map(d => normalizeDoc<TriggeredAlert>(d));
    },
  });

  const { data: resources = [], isLoading: resourcesLoading } = useQuery({
    queryKey: ["security-resources"],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, "jira_resource_tickets"), orderBy("created_at", "desc"), limit(100)));
      return snap.docs.map(d => normalizeDoc<JiraResourceTicket>(d));
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

  const accessInventory = useMemo<AccessEntry[]>(() => {
    const entries: AccessEntry[] = [];
    const normalizeRisk = (access: string, action: AccessEntry["action"]): AccessEntry["risk"] => {
      const lowered = access.toLowerCase();
      if (
        lowered.includes("owner") ||
        lowered.includes("admin") ||
        lowered.includes("iam.serviceaccountkey") ||
        lowered.includes("setiampolicy")
      ) {
        return "high";
      }

      if (action === "granted" || lowered.includes("editor") || lowered.includes("write")) {
        return "medium";
      }

      return "low";
    };

    const addEntry = (entry: Omit<AccessEntry, "id" | "risk">) => {
      const risk = normalizeRisk(entry.access, entry.action);
      const id = [
        entry.principal,
        entry.access,
        entry.resource,
        entry.action,
        entry.lastSeen,
      ].join("|");

      entries.push({ ...entry, id, risk });
    };

    const getNestedValue = (value: unknown, path: string[]): unknown => {
      let current = value;
      for (const segment of path) {
        if (!current || typeof current !== "object" || !(segment in current)) {
          return null;
        }
        current = (current as Record<string, unknown>)[segment];
      }
      return current;
    };

    const parseJson = (message: string): Record<string, unknown> | null => {
      const trimmed = message.trim();
      if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
        return null;
      }

      try {
        return JSON.parse(trimmed) as Record<string, unknown>;
      } catch {
        return null;
      }
    };

    const getString = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

    logs.forEach((log) => {
      const parsed = parseJson(log.message);
      const labels = log.labels ?? {};
      const actor =
        getString(labels.principalEmail) ||
        getString(labels["protoPayload.authenticationInfo.principalEmail"]) ||
        getString(getNestedValue(parsed, ["protoPayload", "authenticationInfo", "principalEmail"]));
      const resource =
        getString(labels.resourceName) ||
        getString(labels["protoPayload.resourceName"]) ||
        getString(getNestedValue(parsed, ["protoPayload", "resourceName"])) ||
        getString(getNestedValue(parsed, ["resource", "type"])) ||
        log.namespace ||
        "unknown resource";

      const serviceData =
        getNestedValue(parsed, ["protoPayload", "serviceData"]) ||
        getNestedValue(parsed, ["serviceData"]);
      const policyDelta =
        getNestedValue(serviceData, ["policyDelta"]) ||
        getNestedValue(parsed, ["protoPayload", "policyDelta"]) ||
        getNestedValue(parsed, ["policyDelta"]);
      const bindingDeltas = getNestedValue(policyDelta, ["bindingDeltas"]);

      if (Array.isArray(bindingDeltas)) {
        bindingDeltas.forEach((delta, index) => {
          const deltaRecord = delta as Record<string, unknown>;
          const member = getString(deltaRecord.member);
          const role = getString(deltaRecord.role);
          const actionText = getString(deltaRecord.action)?.toLowerCase();
          if (!member || !role) {
            return;
          }

          addEntry({
            principal: member.replace(/^(user|group|serviceAccount):/, ""),
            access: role,
            resource,
            action: actionText === "remove" ? "revoked" : "granted",
            source: "policy-delta",
            actor,
            lastSeen: log.timestamp,
            evidence: `IAM policy delta from log ${log.id}${index ? ` #${index + 1}` : ""}`,
          });
        });
      }

      const authorizationInfo = getNestedValue(parsed, ["protoPayload", "authorizationInfo"]);
      if (Array.isArray(authorizationInfo) && actor) {
        authorizationInfo.slice(0, 8).forEach((info, index) => {
          const infoRecord = info as Record<string, unknown>;
          const permission = getString(infoRecord.permission);
          const authResource = getString(infoRecord.resource) || resource;
          const granted = infoRecord.granted;
          if (!permission || granted === false) {
            return;
          }

          addEntry({
            principal: actor,
            access: permission,
            resource: authResource,
            action: "used",
            source: "authorization-info",
            actor,
            lastSeen: log.timestamp,
            evidence: `Granted authorizationInfo entry from log ${log.id}${index ? ` #${index + 1}` : ""}`,
          });
        });
      }

      const labelPrincipal = getString(labels.member) || getString(labels.principal) || actor;
      const labelRole = getString(labels.role) || getString(labels.permission);
      if (labelPrincipal && labelRole) {
        addEntry({
          principal: labelPrincipal.replace(/^(user|group|serviceAccount):/, ""),
          access: labelRole,
          resource,
          action: "used",
          source: "log-labels",
          actor,
          lastSeen: log.timestamp,
          evidence: `Access labels from log ${log.id}`,
        });
      }
    });

    resources.forEach((resource) => {
      const principal = resource.creator_email;
      if (!principal) {
        return;
      }

      addEntry({
        principal,
        access: `created ${resource.resource_type}`,
        resource: resource.resource_name,
        action: "created",
        source: "resource-ticket",
        actor: principal,
        lastSeen: resource.created_at,
        evidence: `Detected resource ticket ${resource.id}`,
      });
    });

    const deduped = new Map<string, AccessEntry>();
    entries.forEach((entry) => {
      const key = `${entry.principal}|${entry.access}|${entry.resource}|${entry.action}`;
      const current = deduped.get(key);
      if (!current || new Date(entry.lastSeen) > new Date(current.lastSeen)) {
        deduped.set(key, entry);
      }
    });

    return Array.from(deduped.values()).sort(
      (left, right) => new Date(right.lastSeen).getTime() - new Date(left.lastSeen).getTime(),
    );
  }, [logs, resources]);

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
  const principalsWithAccess = new Set(accessInventory.map((entry) => entry.principal)).size;
  const highRiskAccess = accessInventory.filter((entry) => entry.risk === "high").length;
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

  const renderAccessInventory = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading access inventory...
        </div>
      );
    }

    if (accessInventory.length === 0) {
      return (
        <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          No access inventory has been detected yet. Ingest structured cloud audit logs with IAM policy deltas or authorizationInfo entries to populate this table.
        </div>
      );
    }

    return (
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="grid grid-cols-[1.2fr_1.2fr_1.3fr_0.7fr_0.8fr] gap-3 border-b border-border bg-secondary px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Principal</span>
          <span>Access</span>
          <span>Resource</span>
          <span>Signal</span>
          <span>Last Seen</span>
        </div>
        <div className="divide-y divide-border">
          {accessInventory.slice(0, 50).map((entry) => (
            <div
              key={entry.id}
              className="grid grid-cols-[1.2fr_1.2fr_1.3fr_0.7fr_0.8fr] gap-3 px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{entry.principal}</p>
                {entry.actor && entry.actor !== entry.principal ? (
                  <p className="truncate text-xs text-muted-foreground">Actor: {entry.actor}</p>
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="truncate text-foreground">{entry.access}</p>
                <div className="mt-1 flex gap-1">
                  <Badge variant={entry.risk === "high" ? "destructive" : "outline"}>{entry.risk}</Badge>
                </div>
              </div>
              <p className="min-w-0 truncate text-muted-foreground">{entry.resource}</p>
              <div className="space-y-1">
                <Badge variant="secondary">{entry.action}</Badge>
                <p className="text-xs text-muted-foreground">{entry.source}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(entry.lastSeen), { addSuffix: true })}
                </p>
                <p className="truncate text-xs text-muted-foreground">{entry.evidence}</p>
              </div>
            </div>
          ))}
        </div>
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

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Known Principals</CardTitle>
            <UserRound className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{principalsWithAccess}</div>
            <p className="text-xs text-muted-foreground">People or service accounts seen in access signals</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">High-Risk Access</CardTitle>
            <KeyRound className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{highRiskAccess}</div>
            <p className="text-xs text-muted-foreground">Owner, admin, IAM policy, or key-management access signals</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="access">
        <TabsList>
          <TabsTrigger value="access">Who Has Access</TabsTrigger>
          <TabsTrigger value="coverage">Coverage</TabsTrigger>
          <TabsTrigger value="iam">IAM & Access</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
          <TabsTrigger value="network">Network</TabsTrigger>
          <TabsTrigger value="certificates">Certificates</TabsTrigger>
        </TabsList>

        <TabsContent value="access" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Who Has What Access</CardTitle>
              <CardDescription>
                Principal-to-role and principal-to-permission inventory inferred from policy deltas, authorization logs, and resource creation records.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderAccessInventory()}
            </CardContent>
          </Card>
        </TabsContent>

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
