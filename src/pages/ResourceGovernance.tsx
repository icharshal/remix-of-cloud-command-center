import { useEffect, useMemo, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, differenceInHours, differenceInMinutes, isPast, parseISO, addDays, format } from "date-fns";
import {
  AlertCircle, CheckCircle2, Clock, Trash2, RefreshCw,
  Timer, ShieldCheck, Boxes, TrendingUp, ExternalLink,
  CalendarClock, User, Tag, ChevronDown, ChevronUp, History,
  Filter, Search,
} from "lucide-react";
import { toast } from "sonner";

import { collection, query, orderBy, limit, where, getDocs, updateDoc, addDoc, doc, onSnapshot } from "firebase/firestore";
import { db, normalizeDoc } from "@/lib/firebase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ValidityStatus = "active" | "extended" | "expired" | "approved" | "deleted";
type ActionType = "created" | "extended" | "approved" | "deleted" | "expired" | "comment";

interface ResourceTicket {
  id: string;
  resource_type: string;
  resource_name: string;
  creator_name: string | null;
  creator_email: string | null;
  summary: string;
  due_date: string;
  extended_due_date: string | null;
  validity_status: ValidityStatus;
  extension_reason: string | null;
  extension_requested_by: string | null;
  extension_requested_at: string | null;
  approved_by: string | null;
  deleted_by: string | null;
  jira_issue_key: string | null;
  jira_issue_url: string | null;
  status: string;
  gcp_project_id: string | null;
  gcp_region: string | null;
  gcp_resource_url: string | null;
  created_at: string;
}

interface ResourceAction {
  id: string;
  ticket_id: string;
  action: ActionType;
  actor_email: string | null;
  actor_name: string | null;
  reason: string | null;
  old_due_date: string | null;
  new_due_date: string | null;
  created_at: string;
}

// ── Countdown component ──────────────────────────────────────
function Countdown({ dueDate, status }: { dueDate: string; status: ValidityStatus }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (status === "approved") return <span className="text-xs font-medium text-success">Approved ✓</span>;
  if (status === "deleted") return <span className="text-xs font-medium text-muted-foreground">Deleted</span>;

  const deadline = parseISO(dueDate);
  if (isPast(deadline)) {
    return <span className="text-xs font-medium text-destructive">Expired</span>;
  }

  const hoursLeft = differenceInHours(deadline, now);
  const minutesLeft = differenceInMinutes(deadline, now) % 60;

  const color = hoursLeft < 6
    ? "text-destructive"
    : hoursLeft < 24
      ? "text-warning"
      : "text-success";

  return (
    <span className={`text-xs font-medium tabular-nums ${color}`}>
      {hoursLeft > 48
        ? `${Math.floor(hoursLeft / 24)}d left`
        : hoursLeft > 0
          ? `${hoursLeft}h ${minutesLeft}m left`
          : `${minutesLeft}m left`}
    </span>
  );
}

// ── Status badge ─────────────────────────────────────────────
function StatusBadge({ status }: { status: ValidityStatus }) {
  const map: Record<ValidityStatus, { label: string; className: string }> = {
    active:   { label: "Active",    className: "bg-blue-50 text-blue-700 border-blue-200" },
    extended: { label: "Extended",  className: "bg-amber-50 text-amber-700 border-amber-200" },
    expired:  { label: "Expired",   className: "bg-red-50 text-red-700 border-red-200" },
    approved: { label: "Approved",  className: "bg-green-50 text-green-700 border-green-200" },
    deleted:  { label: "Deleted",   className: "bg-gray-50 text-gray-500 border-gray-200" },
  };
  const { label, className } = map[status] ?? map.active;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

export default function ResourceGovernance() {
  const queryClient = useQueryClient();

  // Modal state
  const [extendTarget, setExtendTarget] = useState<ResourceTicket | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ResourceTicket | null>(null);
  const [historyTarget, setHistoryTarget] = useState<ResourceTicket | null>(null);

  // Extension form
  const [extendDays, setExtendDays] = useState(2);
  const [extendReason, setExtendReason] = useState("");
  const [extendRequesterName, setExtendRequesterName] = useState("");
  const [extendRequesterEmail, setExtendRequesterEmail] = useState("");

  // Delete form
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteActorEmail, setDeleteActorEmail] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | ValidityStatus>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Data fetching ──────────────────────────────────────────
  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["resource-governance-tickets"],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, "jira_resource_tickets"), orderBy("created_at", "desc"), limit(200)));
      return snap.docs.map(d => normalizeDoc<ResourceTicket>(d));
    },
  });

  const { data: actions = [] } = useQuery({
    queryKey: ["resource-actions", historyTarget?.id],
    enabled: !!historyTarget,
    queryFn: async () => {
      const snap = await getDocs(
        query(collection(db, "resource_actions"), where("ticket_id", "==", historyTarget!.id), orderBy("created_at", "desc"))
      );
      return snap.docs.map(d => normalizeDoc<ResourceAction>(d));
    },
  });

  useEffect(() => {
    const unsubs = [
      onSnapshot(query(collection(db, "jira_resource_tickets"), orderBy("created_at", "desc"), limit(200)),
        () => queryClient.invalidateQueries({ queryKey: ["resource-governance-tickets"] })),
      onSnapshot(query(collection(db, "resource_actions"), orderBy("created_at", "desc")),
        () => queryClient.invalidateQueries({ queryKey: ["resource-actions"] })),
    ];
    return () => unsubs.forEach(u => u());
  }, [queryClient]);

  // ── Metrics ────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const total = tickets.length;
    const active = tickets.filter(t => t.validity_status === "active").length;
    const extended = tickets.filter(t => t.validity_status === "extended").length;
    const expired = tickets.filter(t => t.validity_status === "expired").length;
    const approved = tickets.filter(t => t.validity_status === "approved").length;
    const deleted = tickets.filter(t => t.validity_status === "deleted").length;
    const expiringSoon = tickets.filter(t => {
      if (!["active", "extended"].includes(t.validity_status)) return false;
      const deadline = parseISO(t.extended_due_date ?? t.due_date);
      return !isPast(deadline) && differenceInHours(deadline, new Date()) < 24;
    }).length;
    return { total, active, extended, expired, approved, deleted, expiringSoon };
  }, [tickets]);

  // ── Filtered tickets ───────────────────────────────────────
  const filtered = useMemo(() => {
    return tickets.filter(t => {
      const matchStatus = filterStatus === "all" || t.validity_status === filterStatus;
      const q = search.toLowerCase();
      const matchSearch = !q ||
        t.resource_name.toLowerCase().includes(q) ||
        t.resource_type.toLowerCase().includes(q) ||
        (t.creator_email ?? "").toLowerCase().includes(q) ||
        (t.creator_name ?? "").toLowerCase().includes(q) ||
        (t.gcp_project_id ?? "").toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [tickets, filterStatus, search]);

  // ── Mutations ──────────────────────────────────────────────
  const logAction = useCallback(async (
    ticketId: string,
    action: ActionType,
    opts: { actorEmail?: string; actorName?: string; reason?: string; oldDue?: string; newDue?: string }
  ) => {
    await addDoc(collection(db, "resource_actions"), {
      ticket_id: ticketId,
      action,
      actor_email: opts.actorEmail ?? null,
      actor_name: opts.actorName ?? null,
      reason: opts.reason ?? null,
      old_due_date: opts.oldDue ?? null,
      new_due_date: opts.newDue ?? null,
      created_at: new Date().toISOString(),
    });
  }, []);

  const extendMutation = useMutation({
    mutationFn: async () => {
      if (!extendTarget) return;
      const currentDue = extendTarget.extended_due_date ?? extendTarget.due_date;
      const newDue = format(addDays(parseISO(currentDue), extendDays), "yyyy-MM-dd");
      await updateDoc(doc(db, "jira_resource_tickets", extendTarget.id), {
        validity_status: "extended",
        extended_due_date: newDue,
        extension_reason: extendReason,
        extension_requested_by: extendRequesterEmail || extendRequesterName || "unknown",
        extension_requested_at: new Date().toISOString(),
      });
      await logAction(extendTarget.id, "extended", {
        actorEmail: extendRequesterEmail,
        actorName: extendRequesterName,
        reason: extendReason,
        oldDue: currentDue,
        newDue,
      });
    },
    onSuccess: () => {
      toast.success("Extension requested successfully");
      setExtendTarget(null);
      setExtendReason("");
      setExtendRequesterName("");
      setExtendRequesterEmail("");
      queryClient.invalidateQueries({ queryKey: ["resource-governance-tickets"] });
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const approveMutation = useMutation({
    mutationFn: async (ticket: ResourceTicket) => {
      await updateDoc(doc(db, "jira_resource_tickets", ticket.id), {
        validity_status: "approved",
        approved_by: "admin",
        approved_at: new Date().toISOString(),
      });
      await logAction(ticket.id, "approved", { actorName: "admin" });
    },
    onSuccess: () => {
      toast.success("Resource approved to keep");
      queryClient.invalidateQueries({ queryKey: ["resource-governance-tickets"] });
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  // Track whether GCP deletion was attempted
  const [deleteMode, setDeleteMode] = useState<"gcp" | "mark-only">("gcp");

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) return;

      if (deleteMode === "gcp") {
        const gcpDeleteUrl = import.meta.env.VITE_GCP_DELETE_URL as string;
        if (!gcpDeleteUrl) throw new Error("VITE_GCP_DELETE_URL not configured");
        const res = await fetch(gcpDeleteUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ticket_id: deleteTarget.id,
            resource_type: deleteTarget.resource_type,
            resource_name: deleteTarget.resource_name,
            gcp_project_id: deleteTarget.gcp_project_id ?? "",
            gcp_region: deleteTarget.gcp_region ?? "us-central1",
            actor_email: deleteActorEmail,
            reason: deleteReason,
          }),
        });
        const result = await res.json() as { success?: boolean; error?: string; message?: string };
        if (!res.ok || result.error) throw new Error(result.error ?? "GCP deletion failed");
        // Update Firestore after successful GCP deletion
        await updateDoc(doc(db, "jira_resource_tickets", deleteTarget.id), {
          validity_status: "deleted",
          deleted_by: deleteActorEmail || "admin",
          deleted_at: new Date().toISOString(),
        });
        await logAction(deleteTarget.id, "deleted", { actorEmail: deleteActorEmail, reason: deleteReason });
        return result;
      } else {
        await updateDoc(doc(db, "jira_resource_tickets", deleteTarget.id), {
          validity_status: "deleted",
          deleted_by: deleteActorEmail || "admin",
          deleted_at: new Date().toISOString(),
        });
        await logAction(deleteTarget.id, "deleted", {
          actorEmail: deleteActorEmail,
          reason: `[Mark only — no GCP API call] ${deleteReason}`,
        });
      }
    },
    onSuccess: (result) => {
      const msg = deleteMode === "gcp"
        ? `Deleted from GCP: ${(result as { message?: string })?.message ?? deleteTarget?.resource_name}`
        : "Resource marked as deleted in portal";
      toast.success(msg);
      setDeleteTarget(null);
      setDeleteReason("");
      setDeleteActorEmail("");
      queryClient.invalidateQueries({ queryKey: ["resource-governance-tickets"] });
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  // ── Render ─────────────────────────────────────────────────
  const effectiveDue = (t: ResourceTicket) => t.extended_due_date ?? t.due_date;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Resource Governance</h1>
          <p className="mt-1 text-muted-foreground">
            All GCP resources detected from audit logs — review, extend, or delete.
          </p>
        </div>
        <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["resource-governance-tickets"] })}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Metrics bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {[
          { label: "Total",         value: metrics.total,        icon: Boxes,        color: "text-foreground" },
          { label: "Active",        value: metrics.active,       icon: CheckCircle2, color: "text-blue-600" },
          { label: "Extended",      value: metrics.extended,     icon: CalendarClock,color: "text-amber-600" },
          { label: "Expiring <24h", value: metrics.expiringSoon, icon: Timer,        color: "text-orange-600" },
          { label: "Expired",       value: metrics.expired,      icon: AlertCircle,  color: "text-destructive" },
          { label: "Approved",      value: metrics.approved,     icon: ShieldCheck,  color: "text-success" },
          { label: "Deleted",       value: metrics.deleted,      icon: Trash2,       color: "text-muted-foreground" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="shadow-none">
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
              <span className="text-xs text-muted-foreground">{label}</span>
              <Icon className={`h-3.5 w-3.5 ${color}`} />
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by resource, creator, project..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={v => setFilterStatus(v as typeof filterStatus)}>
          <SelectTrigger className="w-40">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="extended">Extended</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="deleted">Deleted</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filtered.length} resources</span>
      </div>

      {/* Resource cards */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading resources...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          {tickets.length === 0
            ? "No GCP resources detected yet. Resources appear here as soon as audit logs are ingested."
            : "No resources match the current filter."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(ticket => {
            const isExpanded = expandedId === ticket.id;
            const deadline = effectiveDue(ticket);
            const isOverdue = isPast(parseISO(deadline)) && !["approved", "deleted"].includes(ticket.validity_status);

            return (
              <Card
                key={ticket.id}
                className={`shadow-none transition-all ${isOverdue ? "border-destructive/40 bg-destructive/5" : ""}`}
              >
                {/* Main row */}
                <div className="flex items-start gap-4 p-4">
                  {/* Type icon */}
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                  </div>

                  {/* Core info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground truncate">{ticket.resource_name}</span>
                      <Badge variant="outline" className="text-xs">{ticket.resource_type}</Badge>
                      <StatusBadge status={ticket.validity_status} />
                      {ticket.jira_issue_key && (
                        <a href={ticket.jira_issue_url ?? "#"} target="_blank" rel="noreferrer"
                          className="text-xs text-primary underline underline-offset-2">
                          {ticket.jira_issue_key}
                        </a>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {ticket.creator_email ?? ticket.creator_name ?? "Unknown creator"}
                      </span>
                      {ticket.gcp_project_id && (
                        <span className="flex items-center gap-1">
                          <Boxes className="h-3 w-3" />
                          {ticket.gcp_project_id}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Detected {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarClock className="h-3 w-3" />
                        Due {deadline}
                        {ticket.extended_due_date && (
                          <span className="text-amber-600">(extended)</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Countdown + actions */}
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Countdown dueDate={deadline} status={ticket.validity_status} />
                    <div className="flex items-center gap-1.5">
                      {/* Extend */}
                      {["active", "extended"].includes(ticket.validity_status) && (
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => setExtendTarget(ticket)}>
                          <CalendarClock className="mr-1 h-3 w-3" />
                          Extend
                        </Button>
                      )}
                      {/* Approve */}
                      {["active", "extended", "expired"].includes(ticket.validity_status) && (
                        <Button size="sm" variant="outline" className="h-7 text-xs text-success border-success/30 hover:bg-success/10"
                          onClick={() => approveMutation.mutate(ticket)}>
                          <ShieldCheck className="mr-1 h-3 w-3" />
                          Approve
                        </Button>
                      )}
                      {/* Delete */}
                      {ticket.validity_status !== "deleted" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={() => setDeleteTarget(ticket)}>
                          <Trash2 className="mr-1 h-3 w-3" />
                          Delete
                        </Button>
                      )}
                      {/* History */}
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                        onClick={() => setHistoryTarget(ticket)}>
                        <History className="h-3.5 w-3.5" />
                      </Button>
                      {/* Expand */}
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                        onClick={() => setExpandedId(isExpanded ? null : ticket.id)}>
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-border mx-4 mb-4 pt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                    {[
                      { label: "Resource type",   value: ticket.resource_type },
                      { label: "Creator email",   value: ticket.creator_email ?? "—" },
                      { label: "GCP project",     value: ticket.gcp_project_id ?? "—" },
                      { label: "Region",          value: ticket.gcp_region ?? "—" },
                      { label: "Original due",    value: ticket.due_date },
                      { label: "Extended due",    value: ticket.extended_due_date ?? "—" },
                      { label: "Extension by",    value: ticket.extension_requested_by ?? "—" },
                      { label: "Extension reason",value: ticket.extension_reason ?? "—" },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-md bg-muted/40 p-2.5">
                        <p className="uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
                        <p className="font-medium text-foreground break-all">{value}</p>
                      </div>
                    ))}
                    {ticket.gcp_resource_url && (
                      <div className="sm:col-span-2 rounded-md bg-muted/40 p-2.5">
                        <p className="uppercase tracking-wide text-muted-foreground mb-1">GCP resource URL</p>
                        <a href={ticket.gcp_resource_url} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-primary underline underline-offset-2 break-all">
                          {ticket.gcp_resource_url}
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Extension modal ─────────────────────────────────── */}
      <Dialog open={!!extendTarget} onOpenChange={open => !open && setExtendTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request extension</DialogTitle>
            <DialogDescription>
              Extend the validity of <span className="font-medium text-foreground">{extendTarget?.resource_name}</span>.
              Current due date: <span className="font-medium text-foreground">{effectiveDue(extendTarget!)}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Your name</Label>
                <Input placeholder="e.g. Harshal" value={extendRequesterName}
                  onChange={e => setExtendRequesterName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Your email</Label>
                <Input placeholder="you@evonence.com" value={extendRequesterEmail}
                  onChange={e => setExtendRequesterEmail(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Extend by (days)</Label>
              <Select value={String(extendDays)} onValueChange={v => setExtendDays(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 5, 7, 14, 30].map(d => (
                    <SelectItem key={d} value={String(d)}>{d} day{d > 1 ? "s" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {extendTarget && (
                <p className="text-xs text-muted-foreground">
                  New due date: <span className="font-medium text-foreground">
                    {format(addDays(parseISO(effectiveDue(extendTarget)), extendDays), "yyyy-MM-dd")}
                  </span>
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Reason for extension <span className="text-destructive">*</span></Label>
              <Textarea
                placeholder="e.g. Still running load tests on this VM, need 2 more days before teardown."
                value={extendReason}
                onChange={e => setExtendReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendTarget(null)}>Cancel</Button>
            <Button
              onClick={() => extendMutation.mutate()}
              disabled={extendMutation.isPending || !extendReason.trim()}
            >
              {extendMutation.isPending ? "Submitting..." : "Submit extension request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation modal ────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) { setDeleteTarget(null); setDeleteMode("gcp"); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete resource</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{deleteTarget?.resource_name}</span>
              {" "}({deleteTarget?.resource_type})
              {deleteTarget?.gcp_project_id && (
                <span className="text-muted-foreground"> · {deleteTarget.gcp_project_id}</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">

            {/* Delete mode selector */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDeleteMode("gcp")}
                className={`rounded-lg border p-3 text-left text-xs transition-colors ${
                  deleteMode === "gcp"
                    ? "border-destructive bg-destructive/5 text-destructive"
                    : "border-border text-muted-foreground hover:border-border/80"
                }`}
              >
                <p className="font-medium mb-0.5">Delete from GCP</p>
                <p className="opacity-75">Calls GCP API — actually removes the resource</p>
              </button>
              <button
                type="button"
                onClick={() => setDeleteMode("mark-only")}
                className={`rounded-lg border p-3 text-left text-xs transition-colors ${
                  deleteMode === "mark-only"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:border-border/80"
                }`}
              >
                <p className="font-medium mb-0.5">Mark as deleted</p>
                <p className="opacity-75">Portal only — resource stays in GCP</p>
              </button>
            </div>

            {deleteMode === "gcp" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200 space-y-1">
                <p className="font-medium">Requires GCP service account</p>
                <p>Make sure <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">GCP_SERVICE_ACCOUNT_JSON</code> is set in Supabase Edge Function secrets with delete permissions on this resource type.</p>
                {!deleteTarget?.gcp_project_id && (
                  <p className="text-destructive font-medium">⚠ No GCP project ID on this resource — deletion may fail.</p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Your email (audit log)</Label>
              <Input placeholder="you@evonence.com" value={deleteActorEmail}
                onChange={e => setDeleteActorEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Reason <span className="text-destructive">*</span></Label>
              <Textarea placeholder="e.g. Resource no longer needed after sprint completion."
                value={deleteReason}
                onChange={e => setDeleteReason(e.target.value)}
                rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteMode("gcp"); }}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending || !deleteReason.trim()}
            >
              {deleteMutation.isPending
                ? deleteMode === "gcp" ? "Deleting from GCP..." : "Processing..."
                : deleteMode === "gcp" ? "Delete from GCP" : "Mark as deleted"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Audit history modal ──────────────────────────────── */}
      <Dialog open={!!historyTarget} onOpenChange={open => !open && setHistoryTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Audit history</DialogTitle>
            <DialogDescription>
              All actions taken on <span className="font-medium text-foreground">{historyTarget?.resource_name}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-3 py-2">
            {actions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No actions recorded yet.</p>
            ) : actions.map(action => (
              <div key={action.id} className="flex gap-3 text-sm">
                <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-border mt-2" />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium capitalize text-foreground">{action.action}</span>
                    {action.actor_email && (
                      <span className="text-xs text-muted-foreground">by {action.actor_email}</span>
                    )}
                  </div>
                  {action.reason && <p className="text-xs text-muted-foreground">{action.reason}</p>}
                  {action.new_due_date && (
                    <p className="text-xs text-muted-foreground">
                      Due: {action.old_due_date} → {action.new_due_date}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(action.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
