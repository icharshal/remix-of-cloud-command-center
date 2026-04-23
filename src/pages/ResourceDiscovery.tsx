import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  Trash2,
  AlertTriangle,
  Server,
  Database,
  HardDrive,
  Globe,
  Network,
  Lock,
  Loader2,
  Archive,
  ShieldAlert,
  Clock,
  ChevronDown,
  ChevronUp,
  Filter,
  Layers,
  CheckSquare,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type ResourceType =
  | "compute_instance"
  | "gcs_bucket"
  | "gke_cluster"
  | "cloud_sql"
  | "cloud_function"
  | "cloud_run"
  | "pubsub_topic"
  | "bigquery_dataset"
  | "vpc_network"
  | "service_account";

type ResourceAction = "untagged" | "retain" | "delete";
type ApprovalStatus = "pending" | "approved" | "executing" | "completed";

interface GCPResource {
  id: string;
  resourceType: ResourceType;
  name: string;
  location: string;
  createdAt: string;
  labels: Record<string, string>;
  status: "running" | "stopped" | "available" | "active";
  estimatedMonthlyCost: number;
  action: ResourceAction;
  approvalStatus: ApprovalStatus;
  metadata: Record<string, string>;
}

// ─── Static resource type metadata ────────────────────────────────────────────

const TYPE_META: Record<
  ResourceType,
  { label: string; icon: React.ElementType; colorClass: string }
> = {
  compute_instance: { label: "Compute Instance", icon: Server, colorClass: "text-blue-500" },
  gcs_bucket: { label: "Cloud Storage", icon: HardDrive, colorClass: "text-orange-500" },
  gke_cluster: { label: "GKE Cluster", icon: Layers, colorClass: "text-green-500" },
  cloud_sql: { label: "Cloud SQL", icon: Database, colorClass: "text-purple-500" },
  cloud_function: { label: "Cloud Function", icon: Server, colorClass: "text-yellow-500" },
  cloud_run: { label: "Cloud Run", icon: Globe, colorClass: "text-teal-500" },
  pubsub_topic: { label: "Pub/Sub Topic", icon: Network, colorClass: "text-indigo-500" },
  bigquery_dataset: { label: "BigQuery Dataset", icon: Database, colorClass: "text-cyan-500" },
  vpc_network: { label: "VPC Network", icon: Network, colorClass: "text-slate-500" },
  service_account: { label: "Service Account", icon: Lock, colorClass: "text-red-500" },
};

// ─── Mock resource dataset ────────────────────────────────────────────────────

const MOCK_RESOURCES: GCPResource[] = [
  { id: "r1", resourceType: "compute_instance", name: "web-server-prod-001", location: "us-central1-a", createdAt: "2026-01-15T10:00:00Z", labels: { env: "production", team: "web" }, status: "running", estimatedMonthlyCost: 120.5, action: "untagged", approvalStatus: "pending", metadata: { machineType: "n1-standard-4", diskSizeGb: "100" } },
  { id: "r2", resourceType: "compute_instance", name: "dev-server-old-001", location: "us-east1-b", createdAt: "2025-06-10T08:00:00Z", labels: { env: "dev" }, status: "stopped", estimatedMonthlyCost: 45.2, action: "untagged", approvalStatus: "pending", metadata: { machineType: "n1-standard-2", diskSizeGb: "50" } },
  { id: "r3", resourceType: "compute_instance", name: "test-instance-temp", location: "us-west1-a", createdAt: "2026-03-01T12:00:00Z", labels: { env: "test" }, status: "stopped", estimatedMonthlyCost: 22.8, action: "untagged", approvalStatus: "pending", metadata: { machineType: "e2-medium", diskSizeGb: "20" } },
  { id: "r4", resourceType: "gcs_bucket", name: "prod-backup-2024-archives", location: "us", createdAt: "2024-12-01T00:00:00Z", labels: { team: "ops" }, status: "available", estimatedMonthlyCost: 8.4, action: "untagged", approvalStatus: "pending", metadata: { storageClass: "NEARLINE", sizeGb: "234" } },
  { id: "r5", resourceType: "gcs_bucket", name: "temp-data-dump-jan2026", location: "us-central1", createdAt: "2026-01-05T00:00:00Z", labels: {}, status: "available", estimatedMonthlyCost: 3.1, action: "untagged", approvalStatus: "pending", metadata: { storageClass: "STANDARD", sizeGb: "45" } },
  { id: "r6", resourceType: "gcs_bucket", name: "logs-export-archive", location: "us", createdAt: "2025-03-20T00:00:00Z", labels: { team: "platform" }, status: "available", estimatedMonthlyCost: 15.6, action: "untagged", approvalStatus: "pending", metadata: { storageClass: "COLDLINE", sizeGb: "890" } },
  { id: "r7", resourceType: "gke_cluster", name: "prod-cluster-v2", location: "us-central1", createdAt: "2026-02-01T00:00:00Z", labels: { env: "production" }, status: "running", estimatedMonthlyCost: 450, action: "untagged", approvalStatus: "pending", metadata: { nodeCount: "5", k8sVersion: "1.29" } },
  { id: "r8", resourceType: "gke_cluster", name: "staging-cluster-old", location: "us-east1", createdAt: "2025-04-15T00:00:00Z", labels: { env: "staging" }, status: "running", estimatedMonthlyCost: 180, action: "untagged", approvalStatus: "pending", metadata: { nodeCount: "2", k8sVersion: "1.27" } },
  { id: "r9", resourceType: "cloud_sql", name: "prod-postgres-main", location: "us-central1", createdAt: "2026-01-10T00:00:00Z", labels: { env: "production", db: "postgres" }, status: "running", estimatedMonthlyCost: 220, action: "untagged", approvalStatus: "pending", metadata: { version: "POSTGRES_15", tier: "db-n1-standard-4" } },
  { id: "r10", resourceType: "cloud_sql", name: "dev-mysql-temp", location: "us-central1", createdAt: "2026-03-15T00:00:00Z", labels: { env: "dev" }, status: "stopped", estimatedMonthlyCost: 35, action: "untagged", approvalStatus: "pending", metadata: { version: "MYSQL_8_0", tier: "db-f1-micro" } },
  { id: "r11", resourceType: "cloud_function", name: "process-webhook-v1", location: "us-central1", createdAt: "2025-11-20T00:00:00Z", labels: { team: "backend" }, status: "active", estimatedMonthlyCost: 2.3, action: "untagged", approvalStatus: "pending", metadata: { runtime: "nodejs18", memory: "256MB" } },
  { id: "r12", resourceType: "cloud_function", name: "legacy-notification-sender", location: "us-east1", createdAt: "2025-01-05T00:00:00Z", labels: {}, status: "active", estimatedMonthlyCost: 0.8, action: "untagged", approvalStatus: "pending", metadata: { runtime: "python39", memory: "128MB" } },
  { id: "r13", resourceType: "cloud_run", name: "api-service-v2", location: "us-central1", createdAt: "2026-02-15T00:00:00Z", labels: { env: "production" }, status: "active", estimatedMonthlyCost: 65, action: "untagged", approvalStatus: "pending", metadata: { maxInstances: "10", cpu: "2" } },
  { id: "r14", resourceType: "cloud_run", name: "batch-processor-deprecated", location: "us-west1", createdAt: "2025-07-01T00:00:00Z", labels: { status: "deprecated" }, status: "active", estimatedMonthlyCost: 12.4, action: "untagged", approvalStatus: "pending", metadata: { maxInstances: "2", cpu: "1" } },
  { id: "r15", resourceType: "pubsub_topic", name: "events-ingestion-main", location: "global", createdAt: "2026-01-20T00:00:00Z", labels: { team: "platform" }, status: "active", estimatedMonthlyCost: 4.5, action: "untagged", approvalStatus: "pending", metadata: { messageRetentionDays: "7" } },
  { id: "r16", resourceType: "bigquery_dataset", name: "analytics_prod", location: "us", createdAt: "2025-09-01T00:00:00Z", labels: { team: "data" }, status: "active", estimatedMonthlyCost: 88, action: "untagged", approvalStatus: "pending", metadata: { tableCount: "24", sizeGb: "1240" } },
  { id: "r17", resourceType: "bigquery_dataset", name: "temp_exports_q4_2025", location: "us", createdAt: "2025-10-01T00:00:00Z", labels: {}, status: "active", estimatedMonthlyCost: 12, action: "untagged", approvalStatus: "pending", metadata: { tableCount: "3", sizeGb: "180" } },
  { id: "r18", resourceType: "vpc_network", name: "legacy-vpc-dev", location: "global", createdAt: "2025-01-10T00:00:00Z", labels: { env: "dev" }, status: "active", estimatedMonthlyCost: 0, action: "untagged", approvalStatus: "pending", metadata: { subnetCount: "3" } },
  { id: "r19", resourceType: "service_account", name: "old-deploy-sa@project.iam", location: "global", createdAt: "2024-08-01T00:00:00Z", labels: {}, status: "active", estimatedMonthlyCost: 0, action: "untagged", approvalStatus: "pending", metadata: { keyCount: "2" } },
  { id: "r20", resourceType: "service_account", name: "legacy-batch-runner@project.iam", location: "global", createdAt: "2024-03-15T00:00:00Z", labels: { env: "dev" }, status: "active", estimatedMonthlyCost: 0, action: "untagged", approvalStatus: "pending", metadata: { keyCount: "1" } },
];

// ─── Helper utilities ─────────────────────────────────────────────────────────

function formatCost(n: number) {
  return n === 0 ? "—" : `$${n.toFixed(2)}/mo`;
}

function daysAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  return days === 0 ? "today" : `${days}d ago`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ActionBadge({ action }: { action: ResourceAction }) {
  if (action === "retain")
    return (
      <Badge className="border-green-500/30 bg-green-500/15 text-green-700 dark:text-green-400">
        <Archive className="mr-1 h-3 w-3" /> Retain
      </Badge>
    );
  if (action === "delete")
    return (
      <Badge className="border-red-500/30 bg-red-500/15 text-red-700 dark:text-red-400">
        <Trash2 className="mr-1 h-3 w-3" /> Delete
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Untagged
    </Badge>
  );
}

function StatusDot({ status }: { status: GCPResource["status"] }) {
  const color =
    status === "running" || status === "active"
      ? "bg-green-500"
      : status === "available"
      ? "bg-blue-500"
      : "bg-slate-400";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

function ResourceRow({
  resource,
  selected,
  onToggleSelect,
  onSetAction,
  expanded,
  onToggleExpand,
}: {
  resource: GCPResource;
  selected: boolean;
  onToggleSelect: () => void;
  onSetAction: (action: ResourceAction) => void;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const meta = TYPE_META[resource.resourceType];
  const Icon = meta.icon;

  return (
    <div className="border-b border-border last:border-b-0">
      <div className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/20">
        <Checkbox checked={selected} onCheckedChange={onToggleSelect} />
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary`}>
          <Icon className={`h-4 w-4 ${meta.colorClass}`} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{resource.name}</p>
          <p className="text-xs text-muted-foreground">
            {meta.label} · {resource.location} · created {daysAgo(resource.createdAt)}
          </p>
        </div>

        <div className="hidden items-center gap-1 sm:flex">
          <StatusDot status={resource.status} />
          <span className="text-xs capitalize text-muted-foreground">{resource.status}</span>
        </div>

        <div className="hidden w-24 text-right sm:block">
          <span className="text-sm font-medium text-foreground">
            {formatCost(resource.estimatedMonthlyCost)}
          </span>
        </div>

        <ActionBadge action={resource.action} />

        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={resource.action === "retain" ? "default" : "outline"}
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => onSetAction(resource.action === "retain" ? "untagged" : "retain")}
          >
            <Archive className="h-3 w-3" /> Retain
          </Button>
          <Button
            size="sm"
            variant={resource.action === "delete" ? "destructive" : "outline"}
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => onSetAction(resource.action === "delete" ? "untagged" : "delete")}
          >
            <Trash2 className="h-3 w-3" /> Delete
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleExpand}>
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 bg-secondary/10 px-14 py-3 text-xs sm:grid-cols-4">
          <div>
            <p className="font-medium text-muted-foreground">Type</p>
            <p className="text-foreground">{meta.label}</p>
          </div>
          <div>
            <p className="font-medium text-muted-foreground">Location</p>
            <p className="text-foreground">{resource.location}</p>
          </div>
          <div>
            <p className="font-medium text-muted-foreground">Created</p>
            <p className="text-foreground">{new Date(resource.createdAt).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="font-medium text-muted-foreground">Est. Cost</p>
            <p className="text-foreground">{formatCost(resource.estimatedMonthlyCost)}</p>
          </div>
          {Object.entries(resource.metadata).map(([k, v]) => (
            <div key={k}>
              <p className="font-medium capitalize text-muted-foreground">
                {k.replace(/([A-Z])/g, " $1")}
              </p>
              <p className="text-foreground">{v}</p>
            </div>
          ))}
          {Object.keys(resource.labels).length > 0 && (
            <div className="col-span-2">
              <p className="font-medium text-muted-foreground">Labels</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {Object.entries(resource.labels).map(([k, v]) => (
                  <Badge key={k} variant="secondary" className="text-xs">
                    {k}={v}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page component ──────────────────────────────────────────────────────

export default function ResourceDiscovery() {
  const [resources, setResources] = useState<GCPResource[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [selectedProject, setSelectedProject] = useState("my-prod-project-123456");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<ResourceType | "all">("all");
  const [filterAction, setFilterAction] = useState<ResourceAction | "all">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approvalProgress, setApprovalProgress] = useState(0);
  const [approvalDone, setApprovalDone] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  // ── Derived counts ──

  const taggedForDelete = resources.filter((r) => r.action === "delete");
  const taggedForRetain = resources.filter((r) => r.action === "retain");
  const untagged = resources.filter((r) => r.action === "untagged");
  const completed = resources.filter((r) => r.approvalStatus === "completed");
  const totalDeleteCost = taggedForDelete.reduce((s, r) => s + r.estimatedMonthlyCost, 0);

  // ── Filtered resource list for current tab ──

  const visibleResources = useMemo(() => {
    let list = resources;
    if (activeTab === "retain") list = taggedForRetain;
    else if (activeTab === "delete") list = taggedForDelete;
    else if (activeTab === "completed") list = completed;

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.resourceType.includes(q) ||
          r.location.includes(q)
      );
    }
    if (filterType !== "all") list = list.filter((r) => r.resourceType === filterType);
    if (filterAction !== "all") list = list.filter((r) => r.action === filterAction);
    return list;
  }, [resources, activeTab, search, filterType, filterAction, taggedForRetain, taggedForDelete, completed]);

  // ── Scan simulation ──

  const handleScan = async () => {
    setScanning(true);
    setScanProgress(0);
    setResources([]);
    setSelectedIds(new Set());
    setApprovalDone(false);

    const steps = [10, 25, 40, 55, 70, 82, 92, 100];
    for (const p of steps) {
      await new Promise((r) => setTimeout(r, 400));
      setScanProgress(p);
    }
    setResources(MOCK_RESOURCES.map((r) => ({ ...r, action: "untagged", approvalStatus: "pending" })));
    setScanning(false);
    setActiveTab("all");
    toast.success(`Discovered ${MOCK_RESOURCES.length} resources in ${selectedProject}`);
  };

  // ── Per-resource action ──

  const setResourceAction = (id: string, action: ResourceAction) => {
    setResources((prev) => prev.map((r) => (r.id === id ? { ...r, action } : r)));
  };

  // ── Bulk action on selected ──

  const bulkSetAction = (action: ResourceAction) => {
    if (selectedIds.size === 0) return;
    setResources((prev) =>
      prev.map((r) => (selectedIds.has(r.id) ? { ...r, action } : r))
    );
    toast.success(`Marked ${selectedIds.size} resource(s) as "${action}"`);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === visibleResources.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleResources.map((r) => r.id)));
    }
  };

  // ── Final approval execution ──

  const handleApprove = async () => {
    setApproving(true);
    setApprovalProgress(0);
    const total = taggedForDelete.length;
    for (let i = 1; i <= total; i++) {
      await new Promise((r) => setTimeout(r, 600));
      setApprovalProgress(Math.round((i / total) * 100));
    }
    setResources((prev) =>
      prev.map((r) =>
        r.action === "delete" ? { ...r, approvalStatus: "completed" } : r
      )
    );
    setApproving(false);
    setApprovalDone(true);
    toast.success(`${total} resource(s) have been deleted from ${selectedProject}`);
  };

  const closeApproval = () => {
    setApprovalOpen(false);
    setApprovalDone(false);
    setApprovalProgress(0);
    if (approvalDone) setActiveTab("completed");
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Resource Discovery</h1>
          <p className="mt-1 text-muted-foreground">
            Scan your GCP project, review resources, and approve deletions with a controlled workflow.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="my-prod-project-123456">my-prod-project-123456</SelectItem>
              <SelectItem value="staging-project-789">staging-project-789</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleScan} disabled={scanning} className="gap-2">
            {scanning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Scanning…
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" /> {resources.length ? "Re-scan" : "Start Scan"}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Scan progress */}
      {scanning && (
        <Card>
          <CardContent className="pt-6 pb-5">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Scanning {selectedProject}…</span>
              <span className="font-mono font-medium">{scanProgress}%</span>
            </div>
            <Progress value={scanProgress} className="h-2" />
            <p className="mt-2 text-xs text-muted-foreground">
              Querying Compute, GKE, Storage, SQL, Functions, Cloud Run, Pub/Sub, BigQuery, VPC, IAM…
            </p>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!scanning && resources.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <Layers className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <p className="text-lg font-semibold text-foreground">No resources discovered yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Select a connected project and click <strong>Start Scan</strong> to discover all GCP resources.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Resources UI */}
      {resources.length > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Total Resources", value: resources.length, icon: Layers, color: "text-primary" },
              { label: "Untagged", value: untagged.length, icon: Clock, color: "text-muted-foreground" },
              { label: "Retain", value: taggedForRetain.length, icon: Archive, color: "text-green-500" },
              { label: "Marked Delete", value: taggedForDelete.length, icon: Trash2, color: "text-red-500" },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label}>
                <CardContent className="flex items-center gap-3 pt-5 pb-4">
                  <Icon className={`h-6 w-6 ${color}`} />
                  <div>
                    <p className="text-2xl font-bold text-foreground">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Deletion summary + approval button */}
          {taggedForDelete.length > 0 && (
            <Alert className="border-amber-500/40 bg-amber-500/10">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              <AlertDescription className="flex items-center justify-between gap-4">
                <span className="text-amber-700 dark:text-amber-400">
                  <strong>{taggedForDelete.length} resource(s)</strong> marked for deletion — estimated savings{" "}
                  <strong>${totalDeleteCost.toFixed(2)}/mo</strong>. Review and approve to execute.
                </span>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setApprovalOpen(true)}
                  className="shrink-0"
                >
                  Review & Approve Deletions
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Tabs + filter bar */}
          <Card>
            <CardHeader className="pb-0">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <Tabs
                  value={activeTab}
                  onValueChange={(v) => {
                    setActiveTab(v);
                    setSelectedIds(new Set());
                  }}
                >
                  <TabsList>
                    <TabsTrigger value="all">All ({resources.length})</TabsTrigger>
                    <TabsTrigger value="retain">Retain ({taggedForRetain.length})</TabsTrigger>
                    <TabsTrigger value="delete">
                      Delete ({taggedForDelete.filter((r) => r.approvalStatus !== "completed").length})
                    </TabsTrigger>
                    {completed.length > 0 && (
                      <TabsTrigger value="completed">Deleted ({completed.length})</TabsTrigger>
                    )}
                  </TabsList>
                </Tabs>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search resources…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-8 w-44 pl-8 text-xs"
                    />
                  </div>
                  <Select value={filterType} onValueChange={(v) => setFilterType(v as ResourceType | "all")}>
                    <SelectTrigger className="h-8 w-44 text-xs">
                      <Filter className="mr-1 h-3 w-3" />
                      <SelectValue placeholder="Resource type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      {Object.entries(TYPE_META).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0 pt-3">
              {/* Bulk action toolbar */}
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-3 border-b border-border bg-secondary/30 px-4 py-2">
                  <CheckSquare className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{selectedIds.size} selected</span>
                  <Separator orientation="vertical" className="h-4" />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-xs"
                    onClick={() => bulkSetAction("retain")}
                  >
                    <Archive className="h-3 w-3" /> Mark Retain
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-xs text-destructive hover:bg-destructive/10"
                    onClick={() => bulkSetAction("delete")}
                  >
                    <Trash2 className="h-3 w-3" /> Mark Delete
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => bulkSetAction("untagged")}
                  >
                    Clear tag
                  </Button>
                </div>
              )}

              {/* Column header */}
              <div className="flex items-center gap-3 border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Checkbox
                  checked={
                    visibleResources.length > 0 && selectedIds.size === visibleResources.length
                  }
                  onCheckedChange={toggleSelectAll}
                />
                <span className="w-8" />
                <span className="flex-1">Resource</span>
                <span className="hidden w-20 sm:block">Status</span>
                <span className="hidden w-24 text-right sm:block">Cost/mo</span>
                <span className="w-20">Tag</span>
                <span className="w-32">Actions</span>
              </div>

              {visibleResources.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  No resources match the current filters.
                </div>
              ) : (
                <div>
                  {visibleResources.map((r) => (
                    <ResourceRow
                      key={r.id}
                      resource={r}
                      selected={selectedIds.has(r.id)}
                      onToggleSelect={() => toggleSelect(r.id)}
                      onSetAction={(action) => setResourceAction(r.id, action)}
                      expanded={expandedId === r.id}
                      onToggleExpand={() =>
                        setExpandedId((prev) => (prev === r.id ? null : r.id))
                      }
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ── Approval dialog ── */}
      <Dialog open={approvalOpen} onOpenChange={(o) => { if (!approving) { if (!o) closeApproval(); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Final Approval — Resource Deletion
            </DialogTitle>
            <DialogDescription>
              Review the resources below. Once approved, they will be permanently deleted from{" "}
              <strong>{selectedProject}</strong>. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {!approvalDone ? (
            <>
              {/* Resource list in dialog */}
              <div className="max-h-72 overflow-y-auto rounded-md border border-border">
                {taggedForDelete.filter((r) => r.approvalStatus !== "completed").map((r, i) => {
                  const meta = TYPE_META[r.resourceType];
                  const Icon = meta.icon;
                  return (
                    <div
                      key={r.id}
                      className={`flex items-center gap-3 px-4 py-3 text-sm ${
                        i !== 0 ? "border-t border-border" : ""
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${meta.colorClass}`} />
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium text-foreground">{r.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {meta.label} · {r.location}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatCost(r.estimatedMonthlyCost)}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <strong>{taggedForDelete.filter((r) => r.approvalStatus !== "completed").length} resource(s)</strong> will be deleted — saving{" "}
                <strong>${totalDeleteCost.toFixed(2)}/mo</strong>.
              </div>

              {approving && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Deleting resources…</span>
                    <span>{approvalProgress}%</span>
                  </div>
                  <Progress value={approvalProgress} className="h-1.5" />
                </div>
              )}

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={closeApproval} disabled={approving}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleApprove} disabled={approving}>
                  {approving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting…
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" /> Approve & Delete All
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="flex flex-col items-center py-6 text-center">
                <CheckCircle className="mb-3 h-14 w-14 text-green-500" />
                <p className="text-xl font-semibold text-foreground">Deletion Complete</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  All approved resources have been successfully deleted from{" "}
                  <strong>{selectedProject}</strong>.
                </p>
                <p className="mt-3 text-sm font-medium text-green-600 dark:text-green-400">
                  Estimated savings: ${totalDeleteCost.toFixed(2)}/month
                </p>
              </div>
              <DialogFooter>
                <Button onClick={closeApproval}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
