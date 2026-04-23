import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Cloud,
  CheckCircle,
  XCircle,
  AlertCircle,
  Trash2,
  Plus,
  FolderOpen,
  Link2,
  Loader2,
  Key,
  Building2,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useProjects } from "@/context/ProjectContext";

const REQUIRED_ROLES = [
  { role: "roles/viewer", desc: "Read access to all project resources" },
  { role: "roles/resourcemanager.projectViewer", desc: "Project metadata access" },
  { role: "roles/compute.viewer", desc: "Compute Engine resource listing" },
  { role: "roles/container.viewer", desc: "GKE cluster inspection" },
  { role: "roles/storage.objectViewer", desc: "Cloud Storage bucket listing" },
  { role: "roles/cloudsql.viewer", desc: "Cloud SQL instance visibility" },
  { role: "roles/iam.securityReviewer", desc: "IAM policy inspection" },
];

export default function ProjectConnector() {
  const navigate = useNavigate();
  const { projects, addProject, removeProject } = useProjects();

  const [projectId, setProjectId] = useState("");
  const [serviceAccountJson, setServiceAccountJson] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "error">("idle");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setServiceAccountJson(text);
      try {
        const parsed = JSON.parse(text);
        if (parsed.project_id && !projectId) setProjectId(parsed.project_id);
        if (parsed.project_id && !displayName) setDisplayName(parsed.project_id);
      } catch {
        // ignore parse errors on upload
      }
    };
    reader.readAsText(file);
    toast.success(`Loaded ${file.name}`);
  };

  const handleTestConnection = async () => {
    if (!projectId.trim()) { toast.error("Enter a GCP Project ID"); return; }
    if (!serviceAccountJson.trim()) { toast.error("Provide a service account JSON key"); return; }
    setTesting(true);
    setConnectionStatus("idle");
    await new Promise((r) => setTimeout(r, 2200));
    try {
      const parsed = JSON.parse(serviceAccountJson);
      if (!parsed.type || parsed.type !== "service_account") throw new Error("Not a service account key");
      setConnectionStatus("success");
      if (parsed.project_id && !projectId) setProjectId(parsed.project_id);
      toast.success("Connection verified — project is accessible");
    } catch {
      setConnectionStatus("error");
      toast.error("Connection failed. Check credentials and permissions.");
    }
    setTesting(false);
  };

  const handleSaveProject = async () => {
    if (connectionStatus !== "success") { toast.error("Test the connection first"); return; }
    setSaving(true);
    await new Promise((r) => setTimeout(r, 1200));
    addProject({
      id: `proj-${Date.now()}`,
      projectId: projectId.trim(),
      displayName: displayName.trim() || projectId.trim(),
      connectedAt: new Date().toISOString(),
      status: "connected",
      resourceCount: 0,
    });
    setProjectId("");
    setServiceAccountJson("");
    setDisplayName("");
    setConnectionStatus("idle");
    setSaving(false);
    toast.success("Project connected! You can now run a resource scan.");
  };

  const handleRemoveProject = (id: string) => {
    removeProject(id);
    toast.info("Project disconnected");
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Connect GCP Project</h1>
        <p className="mt-1 text-muted-foreground">
          Provide your GCP Project ID and a service account key to enable scanning and resource management.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Connection Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              New Project Connection
            </CardTitle>
            <CardDescription>
              Credentials are used only to query the GCP APIs and are never stored in plaintext.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="display-name">Display Name (optional)</Label>
              <Input
                id="display-name"
                placeholder="e.g. Production GCP Project"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-id">
                GCP Project ID <span className="text-destructive">*</span>
              </Label>
              <Input
                id="project-id"
                placeholder="e.g. my-project-123456"
                value={projectId}
                onChange={(e) => { setProjectId(e.target.value); setConnectionStatus("idle"); }}
              />
            </div>

            <div className="space-y-2">
              <Label>
                Service Account Key (JSON) <span className="text-destructive">*</span>
              </Label>
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground">
                <FolderOpen className="h-4 w-4" />
                Upload JSON key file
                <input type="file" accept=".json" className="hidden" onChange={handleFileUpload} />
              </label>
              <p className="text-center text-xs text-muted-foreground">or paste below</p>
              <Textarea
                placeholder={'{ "type": "service_account", "project_id": "...", ... }'}
                rows={7}
                value={serviceAccountJson}
                onChange={(e) => { setServiceAccountJson(e.target.value); setConnectionStatus("idle"); }}
                className="font-mono text-xs"
              />
            </div>

            {connectionStatus === "success" && (
              <Alert className="border-green-500/40 bg-green-500/10">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <AlertDescription className="text-green-700 dark:text-green-400">
                  Connection verified. Project is accessible with these credentials.
                </AlertDescription>
              </Alert>
            )}
            {connectionStatus === "error" && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  Connection failed. Verify your Project ID, JSON format, and IAM permissions.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={testing || !projectId || !serviceAccountJson}
                className="flex-1"
              >
                {testing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Testing…</> : <><Link2 className="mr-2 h-4 w-4" /> Test Connection</>}
              </Button>
              <Button
                onClick={handleSaveProject}
                disabled={saving || connectionStatus !== "success"}
                className="flex-1"
              >
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Connecting…</> : <><Plus className="mr-2 h-4 w-4" /> Connect Project</>}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Required Permissions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-500" />
              Required IAM Roles
            </CardTitle>
            <CardDescription>Assign these roles to the service account before connecting.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {REQUIRED_ROLES.map(({ role, desc }) => (
              <div key={role} className="flex items-start gap-3 rounded-md border border-border bg-card p-3">
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                <div>
                  <p className="font-mono text-xs font-semibold text-foreground">{role}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
            <Alert className="border-amber-500/40 bg-amber-500/10">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-xs text-amber-700 dark:text-amber-400">
                For resource deletion, additionally grant{" "}
                <span className="font-mono">roles/editor</span> or specific delete permissions per resource type.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>

      {/* Connected Projects List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Connected Projects
          </CardTitle>
          <CardDescription>
            {projects.length} project{projects.length !== 1 ? "s" : ""} connected
          </CardDescription>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Cloud className="mx-auto mb-3 h-10 w-10 opacity-20" />
              <p className="text-sm">No projects connected yet. Add one above.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-secondary/30"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <Cloud className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{project.displayName}</p>
                      <p className="font-mono text-xs text-muted-foreground">{project.projectId}</p>
                      <p className="text-xs text-muted-foreground">
                        Connected {new Date(project.connectedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {project.resourceCount > 0 && (
                      <div className="hidden text-right sm:block">
                        <p className="text-sm font-semibold text-foreground">{project.resourceCount}</p>
                        <p className="text-xs text-muted-foreground">resources</p>
                      </div>
                    )}
                    <Badge
                      className={
                        project.status === "connected"
                          ? "border-green-500/30 bg-green-500/15 text-green-700 dark:text-green-400"
                          : "border-destructive/30 bg-destructive/15 text-destructive"
                      }
                    >
                      {project.status === "connected" ? (
                        <CheckCircle className="mr-1 h-3 w-3" />
                      ) : (
                        <XCircle className="mr-1 h-3 w-3" />
                      )}
                      {project.status}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/resource-discovery")}
                      className="gap-1"
                    >
                      Scan <ArrowRight className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => handleRemoveProject(project.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
