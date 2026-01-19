import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Copy, Download, FileCode } from "lucide-react";

export default function CICDBuilder() {
  const [pipelineType, setPipelineType] = useState<"cloudbuild" | "github">("cloudbuild");
  const [projectId, setProjectId] = useState("");
  const [repository, setRepository] = useState("");
  const [branch, setBranch] = useState("main");
  const [features, setFeatures] = useState({
    build: true,
    test: false,
    docker: false,
    deploy: false,
  });
  const [generatedConfig, setGeneratedConfig] = useState("");

  const generateCloudBuild = () => {
    let config = `# Cloud Build configuration
# Project: ${projectId}

steps:
`;

    if (features.build) {
      config += `  # Build step
  - name: 'gcr.io/cloud-builders/npm'
    args: ['install']
  - name: 'gcr.io/cloud-builders/npm'
    args: ['run', 'build']

`;
    }

    if (features.test) {
      config += `  # Test step
  - name: 'gcr.io/cloud-builders/npm'
    args: ['run', 'test']

`;
    }

    if (features.docker) {
      config += `  # Docker build
  - name: 'gcr.io/cloud-builders/docker'
    args: [
      'build',
      '-t', 'gcr.io/${projectId}/\${_SERVICE_NAME}:\${SHORT_SHA}',
      '-t', 'gcr.io/${projectId}/\${_SERVICE_NAME}:latest',
      '.'
    ]
  
  # Push to Container Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/${projectId}/\${_SERVICE_NAME}:\${SHORT_SHA}']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/${projectId}/\${_SERVICE_NAME}:latest']

`;
    }

    if (features.deploy) {
      config += `  # Deploy to GKE
  - name: 'gcr.io/cloud-builders/gke-deploy'
    args:
      - run
      - --filename=kubernetes/
      - --image=gcr.io/${projectId}/\${_SERVICE_NAME}:\${SHORT_SHA}
      - --location=\${_GKE_LOCATION}
      - --cluster=\${_GKE_CLUSTER}

`;
    }

    config += `# Build options
options:
  logging: CLOUD_LOGGING_ONLY
  machineType: 'N1_HIGHCPU_8'

# Substitutions
substitutions:
  _SERVICE_NAME: 'app'
  _GKE_LOCATION: 'us-central1'
  _GKE_CLUSTER: 'production-cluster'

# Images to push
images:
  - 'gcr.io/${projectId}/\${_SERVICE_NAME}:\${SHORT_SHA}'
  - 'gcr.io/${projectId}/\${_SERVICE_NAME}:latest'
`;

    return config;
  };

  const generateGitHubActions = () => {
    let config = `# GitHub Actions CI/CD Pipeline
# Repository: ${repository}

name: CI/CD Pipeline

on:
  push:
    branches: [ ${branch} ]
  pull_request:
    branches: [ ${branch} ]

env:
  PROJECT_ID: ${projectId}
  GKE_CLUSTER: production-cluster
  GKE_ZONE: us-central1
  IMAGE_NAME: app

jobs:
`;

    if (features.build) {
      config += `  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build application
        run: npm run build
      
      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: build
          path: dist/

`;
    }

    if (features.test) {
      config += `  test:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test

`;
    }

    if (features.docker) {
      config += `  docker:
    runs-on: ubuntu-latest
    needs: ${features.test ? "test" : "build"}
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v1
        with:
          service_account_key: \${{ secrets.GCP_SA_KEY }}
          project_id: \${{ env.PROJECT_ID }}
      
      - name: Configure Docker for GCR
        run: gcloud auth configure-docker
      
      - name: Build Docker image
        run: |
          docker build -t gcr.io/\$PROJECT_ID/\$IMAGE_NAME:\$GITHUB_SHA \\
                       -t gcr.io/\$PROJECT_ID/\$IMAGE_NAME:latest .
      
      - name: Push to Container Registry
        run: |
          docker push gcr.io/\$PROJECT_ID/\$IMAGE_NAME:\$GITHUB_SHA
          docker push gcr.io/\$PROJECT_ID/\$IMAGE_NAME:latest

`;
    }

    if (features.deploy) {
      config += `  deploy:
    runs-on: ubuntu-latest
    needs: docker
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v1
        with:
          service_account_key: \${{ secrets.GCP_SA_KEY }}
          project_id: \${{ env.PROJECT_ID }}
      
      - name: Get GKE credentials
        run: |
          gcloud container clusters get-credentials \$GKE_CLUSTER \\
            --zone \$GKE_ZONE --project \$PROJECT_ID
      
      - name: Deploy to GKE
        run: |
          kubectl set image deployment/app \\
            app=gcr.io/\$PROJECT_ID/\$IMAGE_NAME:\$GITHUB_SHA
          kubectl rollout status deployment/app
`;
    }

    return config;
  };

  const handleGenerate = () => {
    if (!projectId) {
      toast.error("Please enter a project ID");
      return;
    }

    if (pipelineType === "github" && !repository) {
      toast.error("Please enter a repository name");
      return;
    }

    const config = pipelineType === "cloudbuild" ? generateCloudBuild() : generateGitHubActions();
    setGeneratedConfig(config);
    toast.success("Pipeline configuration generated!");
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedConfig);
    toast.success("Copied to clipboard!");
  };

  const downloadFile = () => {
    const filename = pipelineType === "cloudbuild" ? "cloudbuild.yaml" : ".github/workflows/ci-cd.yml";
    const blob = new Blob([generatedConfig], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    toast.success("File downloaded!");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">CI/CD Pipeline Builder</h1>
        <p className="mt-2 text-muted-foreground">
          Generate Cloud Build or GitHub Actions configurations for your projects
        </p>
      </div>

      <Tabs value={pipelineType} onValueChange={(v) => setPipelineType(v as any)}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="cloudbuild">Cloud Build</TabsTrigger>
          <TabsTrigger value="github">GitHub Actions</TabsTrigger>
        </TabsList>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Configuration Form */}
          <Card>
            <CardHeader>
              <CardTitle>Pipeline Configuration</CardTitle>
              <CardDescription>Configure your CI/CD pipeline settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="projectId">GCP Project ID</Label>
                <Input
                  id="projectId"
                  placeholder="my-gcp-project"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                />
              </div>

              {pipelineType === "github" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="repository">Repository</Label>
                    <Input
                      id="repository"
                      placeholder="username/repo"
                      value={repository}
                      onChange={(e) => setRepository(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="branch">Branch</Label>
                    <Input
                      id="branch"
                      placeholder="main"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="space-y-4">
                <Label>Pipeline Steps</Label>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="build"
                    checked={features.build}
                    onCheckedChange={(checked) =>
                      setFeatures({ ...features, build: checked as boolean })
                    }
                  />
                  <label
                    htmlFor="build"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Build Application
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="test"
                    checked={features.test}
                    onCheckedChange={(checked) =>
                      setFeatures({ ...features, test: checked as boolean })
                    }
                  />
                  <label
                    htmlFor="test"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Run Tests
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="docker"
                    checked={features.docker}
                    onCheckedChange={(checked) =>
                      setFeatures({ ...features, docker: checked as boolean })
                    }
                  />
                  <label
                    htmlFor="docker"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Build & Push Docker Image
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="deploy"
                    checked={features.deploy}
                    onCheckedChange={(checked) =>
                      setFeatures({ ...features, deploy: checked as boolean })
                    }
                  />
                  <label
                    htmlFor="deploy"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Deploy to GKE
                  </label>
                </div>
              </div>

              <Button onClick={handleGenerate} className="w-full">
                <FileCode className="mr-2 h-4 w-4" />
                Generate Pipeline Configuration
              </Button>
            </CardContent>
          </Card>

          {/* Generated Configuration */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Generated Configuration</CardTitle>
                  <CardDescription>
                    {pipelineType === "cloudbuild" ? "cloudbuild.yaml" : ".github/workflows/ci-cd.yml"}
                  </CardDescription>
                </div>
                {generatedConfig && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={copyToClipboard}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={downloadFile}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {generatedConfig ? (
                <pre className="h-[500px] overflow-auto rounded-lg bg-secondary p-4 text-xs">
                  <code>{generatedConfig}</code>
                </pre>
              ) : (
                <div className="flex h-[500px] items-center justify-center rounded-lg border-2 border-dashed border-border">
                  <p className="text-muted-foreground">Configure and generate your pipeline</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </Tabs>

      {/* Dockerfile Generator */}
      <Card>
        <CardHeader>
          <CardTitle>Sample Dockerfile</CardTitle>
          <CardDescription>Multi-stage Dockerfile for Node.js applications</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-auto rounded-lg bg-secondary p-4 text-xs">
            <code>{`# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

EXPOSE 8080

CMD ["node", "dist/server.js"]`}</code>
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
