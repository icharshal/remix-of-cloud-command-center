import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle2, XCircle, Shield, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const iamIssues = [
  {
    severity: "high",
    title: "Overly Permissive Service Account",
    description: "Service account 'app-sa@project.iam.gserviceaccount.com' has Owner role",
    recommendation: "Reduce to specific roles like Storage Admin, Cloud SQL Client",
  },
  {
    severity: "medium",
    title: "Unused Service Account",
    description: "Service account 'legacy-sa@project.iam.gserviceaccount.com' hasn't been used in 90 days",
    recommendation: "Consider disabling or deleting unused service accounts",
  },
  {
    severity: "low",
    title: "Public IAM Bindings",
    description: "2 resources have 'allUsers' or 'allAuthenticatedUsers' bindings",
    recommendation: "Review and restrict public access where not required",
  },
];

const storageIssues = [
  {
    severity: "high",
    title: "Public Bucket Access",
    description: "Bucket 'project-uploads' allows public read access",
    recommendation: "Enable uniform bucket-level access and remove 'allUsers' permissions",
  },
  {
    severity: "medium",
    title: "Bucket Without Versioning",
    description: "3 buckets don't have versioning enabled",
    recommendation: "Enable versioning for critical data buckets",
  },
  {
    severity: "medium",
    title: "Missing Encryption",
    description: "Bucket 'logs-archive' uses default encryption",
    recommendation: "Configure customer-managed encryption keys (CMEK)",
  },
];

const sslCertificates = [
  { domain: "app.example.com", expires: "45 days", status: "valid", issuer: "Let's Encrypt" },
  { domain: "api.example.com", expires: "12 days", status: "expiring", issuer: "Let's Encrypt" },
  { domain: "admin.example.com", expires: "3 days", status: "critical", issuer: "Let's Encrypt" },
  { domain: "legacy.example.com", expires: "expired", status: "expired", issuer: "Self-signed" },
];

const networkFindings = [
  {
    severity: "high",
    title: "Firewall Rule Too Permissive",
    description: "Rule 'allow-all-internal' allows all protocols from 0.0.0.0/0",
    recommendation: "Restrict to specific IP ranges and required ports only",
  },
  {
    severity: "medium",
    title: "No VPC Flow Logs",
    description: "VPC 'production-vpc' doesn't have flow logs enabled",
    recommendation: "Enable flow logs for security monitoring and troubleshooting",
  },
];

export default function SecurityAnalyzer() {
  const handleScan = () => {
    toast.success("Security scan initiated. This may take a few minutes...");
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
      case "critical":
        return "text-destructive";
      case "medium":
      case "expiring":
        return "text-warning";
      case "low":
      case "valid":
        return "text-success";
      default:
        return "text-muted-foreground";
    }
  };

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      high: "destructive",
      critical: "destructive",
      medium: "secondary",
      low: "default",
    };
    return (
      <Badge variant={variants[severity] || "secondary"} className={getSeverityColor(severity)}>
        {severity}
      </Badge>
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "valid":
        return <CheckCircle2 className="h-5 w-5 text-success" />;
      case "expiring":
        return <AlertCircle className="h-5 w-5 text-warning" />;
      case "critical":
      case "expired":
        return <XCircle className="h-5 w-5 text-destructive" />;
      default:
        return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const totalIssues = iamIssues.length + storageIssues.length + networkFindings.length;
  const highSeverity = [...iamIssues, ...storageIssues, ...networkFindings].filter(
    (i) => i.severity === "high"
  ).length;
  const mediumSeverity = [...iamIssues, ...storageIssues, ...networkFindings].filter(
    (i) => i.severity === "medium"
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Security Analyzer</h1>
          <p className="mt-2 text-muted-foreground">
            Audit IAM, storage access, SSL certificates, and network security
          </p>
        </div>
        <Button onClick={handleScan}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Run Security Scan
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Issues</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalIssues}</div>
            <p className="text-xs text-muted-foreground">Across all categories</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">High Severity</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{highSeverity}</div>
            <p className="text-xs text-muted-foreground">Requires immediate attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Medium Severity</CardTitle>
            <AlertCircle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{mediumSeverity}</div>
            <p className="text-xs text-muted-foreground">Should be addressed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">SSL Certificates</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{sslCertificates.length}</div>
            <p className="text-xs text-muted-foreground">2 expiring soon</p>
          </CardContent>
        </Card>
      </div>

      {/* Security Findings */}
      <Tabs defaultValue="iam">
        <TabsList>
          <TabsTrigger value="iam">IAM & Access</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
          <TabsTrigger value="ssl">SSL Certificates</TabsTrigger>
          <TabsTrigger value="network">Network</TabsTrigger>
        </TabsList>

        <TabsContent value="iam" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>IAM Security Findings</CardTitle>
              <CardDescription>Identity and access management issues</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {iamIssues.map((issue, index) => (
                  <div
                    key={index}
                    className="space-y-2 border-b border-border pb-6 last:border-0 last:pb-0"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {getSeverityBadge(issue.severity)}
                          <h3 className="font-semibold text-foreground">{issue.title}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">{issue.description}</p>
                      </div>
                    </div>
                    <div className="rounded-lg bg-secondary p-3">
                      <p className="text-sm">
                        <span className="font-medium">Recommendation:</span> {issue.recommendation}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="storage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Storage Security Findings</CardTitle>
              <CardDescription>Cloud Storage bucket security issues</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {storageIssues.map((issue, index) => (
                  <div
                    key={index}
                    className="space-y-2 border-b border-border pb-6 last:border-0 last:pb-0"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {getSeverityBadge(issue.severity)}
                          <h3 className="font-semibold text-foreground">{issue.title}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">{issue.description}</p>
                      </div>
                    </div>
                    <div className="rounded-lg bg-secondary p-3">
                      <p className="text-sm">
                        <span className="font-medium">Recommendation:</span> {issue.recommendation}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ssl" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>SSL Certificate Status</CardTitle>
              <CardDescription>Certificate expiration monitoring</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sslCertificates.map((cert, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between border-b border-border pb-4 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(cert.status)}
                      <div>
                        <p className="font-medium text-foreground">{cert.domain}</p>
                        <p className="text-sm text-muted-foreground">
                          {cert.issuer} • Expires: {cert.expires}
                        </p>
                      </div>
                    </div>
                    {getSeverityBadge(cert.status)}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="network" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Network Security Findings</CardTitle>
              <CardDescription>VPC and firewall configuration issues</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {networkFindings.map((finding, index) => (
                  <div
                    key={index}
                    className="space-y-2 border-b border-border pb-6 last:border-0 last:pb-0"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {getSeverityBadge(finding.severity)}
                          <h3 className="font-semibold text-foreground">{finding.title}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">{finding.description}</p>
                      </div>
                    </div>
                    <div className="rounded-lg bg-secondary p-3">
                      <p className="text-sm">
                        <span className="font-medium">Recommendation:</span> {finding.recommendation}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
