import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Rocket, CheckCircle2, Clock, XCircle, Download } from "lucide-react";

const deploymentHistory = [
  { id: 1, app: "frontend", version: "v2.1.0", target: "GKE", status: "success", time: "5 mins ago" },
  { id: 2, app: "backend", version: "v1.8.3", target: "Cloud Run", status: "success", time: "1 hour ago" },
  { id: 3, app: "api", version: "v3.0.1", target: "GKE", status: "failed", time: "3 hours ago" },
  { id: 4, app: "worker", version: "v1.2.0", target: "Compute Engine", status: "success", time: "1 day ago" },
];

export default function DeploymentManager() {
  const [deploymentTarget, setDeploymentTarget] = useState<"gke" | "cloudrun" | "vm">("gke");
  const [appName, setAppName] = useState("");
  const [imageName, setImageName] = useState("");
  const [version, setVersion] = useState("");

  const handleDeploy = () => {
    if (!appName || !imageName || !version) {
      toast.error("Please fill in all fields");
      return;
    }

    toast.success(`Deploying ${appName} ${version} to ${deploymentTarget.toUpperCase()}...`);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="h-5 w-5 text-success" />;
      case "running":
        return <Clock className="h-5 w-5 text-warning" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-destructive" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      success: "default",
      running: "secondary",
      failed: "destructive",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  const generateKubernetesManifest = () => {
    return `# Kubernetes Deployment Manifest
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${appName || "app"}
  labels:
    app: ${appName || "app"}
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ${appName || "app"}
  template:
    metadata:
      labels:
        app: ${appName || "app"}
    spec:
      containers:
      - name: ${appName || "app"}
        image: ${imageName || "gcr.io/project/app"}:${version || "latest"}
        ports:
        - containerPort: 8080
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        env:
        - name: NODE_ENV
          value: "production"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: ${appName || "app"}-service
spec:
  type: LoadBalancer
  selector:
    app: ${appName || "app"}
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8080
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ${appName || "app"}-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ${appName || "app"}
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70`;
  };

  const downloadManifest = () => {
    const manifest = generateKubernetesManifest();
    const blob = new Blob([manifest], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "deployment.yaml";
    a.click();
    toast.success("Manifest downloaded!");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Deployment Manager</h1>
        <p className="mt-2 text-muted-foreground">
          Deploy applications to GKE, Cloud Run, or Compute Engine
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Deployment Form */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>New Deployment</CardTitle>
              <CardDescription>Configure and deploy your application</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="target">Deployment Target</Label>
                <Select value={deploymentTarget} onValueChange={(v) => setDeploymentTarget(v as any)}>
                  <SelectTrigger id="target">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gke">Google Kubernetes Engine (GKE)</SelectItem>
                    <SelectItem value="cloudrun">Cloud Run</SelectItem>
                    <SelectItem value="vm">Compute Engine VM</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="appName">Application Name</Label>
                <Input
                  id="appName"
                  placeholder="my-app"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="imageName">Container Image</Label>
                <Input
                  id="imageName"
                  placeholder="gcr.io/project-id/app"
                  value={imageName}
                  onChange={(e) => setImageName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="version">Version/Tag</Label>
                <Input
                  id="version"
                  placeholder="v1.0.0 or latest"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                />
              </div>

              <Button onClick={handleDeploy} className="w-full">
                <Rocket className="mr-2 h-4 w-4" />
                Deploy Application
              </Button>
            </CardContent>
          </Card>

          {deploymentTarget === "gke" && (
            <Card>
              <CardHeader>
                <CardTitle>Kubernetes Manifest</CardTitle>
                <CardDescription>Generated deployment configuration</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={downloadManifest} variant="outline" className="w-full">
                  <Download className="mr-2 h-4 w-4" />
                  Download deployment.yaml
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Deployment History */}
        <Card>
          <CardHeader>
            <CardTitle>Deployment History</CardTitle>
            <CardDescription>Recent deployments across all targets</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {deploymentHistory.map((deployment) => (
                <div
                  key={deployment.id}
                  className="flex items-center justify-between border-b border-border pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(deployment.status)}
                    <div>
                      <p className="font-medium text-foreground">
                        {deployment.app} {deployment.version}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {deployment.target} • {deployment.time}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(deployment.status)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deployment Commands */}
      <Card>
        <CardHeader>
          <CardTitle>Manual Deployment Commands</CardTitle>
          <CardDescription>Command-line deployment instructions</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="gke">
            <TabsList>
              <TabsTrigger value="gke">GKE</TabsTrigger>
              <TabsTrigger value="cloudrun">Cloud Run</TabsTrigger>
              <TabsTrigger value="vm">Compute Engine</TabsTrigger>
            </TabsList>

            <TabsContent value="gke" className="space-y-4">
              <pre className="overflow-auto rounded-lg bg-secondary p-4 text-xs">
                <code>{`# Deploy to GKE
gcloud container clusters get-credentials CLUSTER_NAME --zone ZONE

# Apply Kubernetes manifests
kubectl apply -f deployment.yaml

# Check deployment status
kubectl rollout status deployment/${appName || "app"}

# View pods
kubectl get pods -l app=${appName || "app"}`}</code>
              </pre>
            </TabsContent>

            <TabsContent value="cloudrun" className="space-y-4">
              <pre className="overflow-auto rounded-lg bg-secondary p-4 text-xs">
                <code>{`# Deploy to Cloud Run
gcloud run deploy ${appName || "app"} \\
  --image ${imageName || "gcr.io/project/app"}:${version || "latest"} \\
  --platform managed \\
  --region us-central1 \\
  --allow-unauthenticated \\
  --memory 512Mi \\
  --cpu 1`}</code>
              </pre>
            </TabsContent>

            <TabsContent value="vm" className="space-y-4">
              <pre className="overflow-auto rounded-lg bg-secondary p-4 text-xs">
                <code>{`# Deploy to Compute Engine VM
# SSH into VM
gcloud compute ssh VM_NAME --zone ZONE

# Pull and run container
docker pull ${imageName || "gcr.io/project/app"}:${version || "latest"}
docker stop ${appName || "app"} || true
docker rm ${appName || "app"} || true
docker run -d \\
  --name ${appName || "app"} \\
  --restart always \\
  -p 80:8080 \\
  ${imageName || "gcr.io/project/app"}:${version || "latest"}`}</code>
              </pre>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
