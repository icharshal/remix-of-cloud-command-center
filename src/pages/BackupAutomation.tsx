import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Database, HardDrive, CheckCircle2, Clock, AlertCircle } from "lucide-react";

const backupJobs = [
  { id: 1, name: "postgres-daily", type: "Cloud SQL", status: "success", lastRun: "2 hours ago", nextRun: "22 hours" },
  { id: 2, name: "storage-sync", type: "Bucket Sync", status: "success", lastRun: "30 mins ago", nextRun: "5.5 hours" },
  { id: 3, name: "mysql-hourly", type: "Cloud SQL", status: "running", lastRun: "5 mins ago", nextRun: "55 mins" },
  { id: 4, name: "logs-archive", type: "Bucket Sync", status: "failed", lastRun: "1 hour ago", nextRun: "5 hours" },
];

export default function BackupAutomation() {
  const [backupType, setBackupType] = useState<"sql" | "bucket">("sql");
  const [jobName, setJobName] = useState("");
  const [schedule, setSchedule] = useState("daily");
  const [retention, setRetention] = useState("7");
  const [enabled, setEnabled] = useState(true);

  // SQL specific
  const [instanceName, setInstanceName] = useState("");
  
  // Bucket specific
  const [sourceBucket, setSourceBucket] = useState("");
  const [targetBucket, setTargetBucket] = useState("");

  const handleCreateJob = () => {
    if (!jobName) {
      toast.error("Please enter a job name");
      return;
    }

    if (backupType === "sql" && !instanceName) {
      toast.error("Please enter Cloud SQL instance name");
      return;
    }

    if (backupType === "bucket" && (!sourceBucket || !targetBucket)) {
      toast.error("Please enter source and target bucket names");
      return;
    }

    toast.success(`Backup job "${jobName}" created successfully!`);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="h-5 w-5 text-success" />;
      case "running":
        return <Clock className="h-5 w-5 text-warning" />;
      case "failed":
        return <AlertCircle className="h-5 w-5 text-destructive" />;
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Backup Automation</h1>
        <p className="mt-2 text-muted-foreground">
          Automate Cloud SQL exports and bucket synchronization
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Create Backup Job */}
        <Card>
          <CardHeader>
            <CardTitle>Create Backup Job</CardTitle>
            <CardDescription>Configure automated backup schedules</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="backupType">Backup Type</Label>
              <Select value={backupType} onValueChange={(v) => setBackupType(v as any)}>
                <SelectTrigger id="backupType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sql">Cloud SQL Export</SelectItem>
                  <SelectItem value="bucket">Bucket Sync</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="jobName">Job Name</Label>
              <Input
                id="jobName"
                placeholder="postgres-daily-backup"
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
              />
            </div>

            {backupType === "sql" && (
              <div className="space-y-2">
                <Label htmlFor="instanceName">Cloud SQL Instance</Label>
                <Input
                  id="instanceName"
                  placeholder="my-postgres-instance"
                  value={instanceName}
                  onChange={(e) => setInstanceName(e.target.value)}
                />
              </div>
            )}

            {backupType === "bucket" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="sourceBucket">Source Bucket</Label>
                  <Input
                    id="sourceBucket"
                    placeholder="gs://source-bucket"
                    value={sourceBucket}
                    onChange={(e) => setSourceBucket(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="targetBucket">Target Bucket</Label>
                  <Input
                    id="targetBucket"
                    placeholder="gs://backup-bucket"
                    value={targetBucket}
                    onChange={(e) => setTargetBucket(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="schedule">Schedule</Label>
              <Select value={schedule} onValueChange={setSchedule}>
                <SelectTrigger id="schedule">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Every Hour</SelectItem>
                  <SelectItem value="every6h">Every 6 Hours</SelectItem>
                  <SelectItem value="daily">Daily (3 AM)</SelectItem>
                  <SelectItem value="weekly">Weekly (Sunday 3 AM)</SelectItem>
                  <SelectItem value="monthly">Monthly (1st, 3 AM)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="retention">Retention Period (days)</Label>
              <Input
                id="retention"
                type="number"
                placeholder="7"
                value={retention}
                onChange={(e) => setRetention(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="enabled">Enable Job</Label>
              <Switch id="enabled" checked={enabled} onCheckedChange={setEnabled} />
            </div>

            <Button onClick={handleCreateJob} className="w-full">
              Create Backup Job
            </Button>
          </CardContent>
        </Card>

        {/* Backup Jobs List */}
        <Card>
          <CardHeader>
            <CardTitle>Active Backup Jobs</CardTitle>
            <CardDescription>Scheduled and running backup tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {backupJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-start justify-between border-b border-border pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex items-start gap-3">
                    {getStatusIcon(job.status)}
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{job.name}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{job.type}</Badge>
                        {getStatusBadge(job.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Last: {job.lastRun} • Next: {job.nextRun}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Example Configurations */}
      <Card>
        <CardHeader>
          <CardTitle>Example Backup Configurations</CardTitle>
          <CardDescription>Sample cron expressions and gcloud commands</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="mb-2 font-semibold text-foreground">Cloud SQL Automated Backup</h3>
            <pre className="overflow-auto rounded-lg bg-secondary p-4 text-xs">
              <code>{`# Cloud SQL export (add to Cloud Scheduler)
gcloud sql export sql INSTANCE_NAME \\
  gs://BUCKET_NAME/backups/\$(date +%Y%m%d-%H%M%S).sql \\
  --database=DATABASE_NAME

# Cron schedule examples:
# Daily at 3 AM: 0 3 * * *
# Every 6 hours: 0 */6 * * *
# Weekly on Sunday: 0 3 * * 0`}</code>
            </pre>
          </div>

          <div>
            <h3 className="mb-2 font-semibold text-foreground">Bucket Synchronization</h3>
            <pre className="overflow-auto rounded-lg bg-secondary p-4 text-xs">
              <code>{`# Sync buckets with gsutil
gsutil -m rsync -r -d gs://SOURCE_BUCKET gs://BACKUP_BUCKET

# With versioning and lifecycle rules
gsutil versioning set on gs://BACKUP_BUCKET

# Lifecycle rule (delete after 30 days)
cat > lifecycle.json << EOF
{
  "lifecycle": {
    "rule": [{
      "action": {"type": "Delete"},
      "condition": {"age": 30}
    }]
  }
}
EOF

gsutil lifecycle set lifecycle.json gs://BACKUP_BUCKET`}</code>
            </pre>
          </div>

          <div>
            <h3 className="mb-2 font-semibold text-foreground">Cloud Functions Backup Trigger</h3>
            <pre className="overflow-auto rounded-lg bg-secondary p-4 text-xs">
              <code>{`// Cloud Function to automate backups
const { Storage } = require('@google-cloud/storage');
const storage = new Storage();

exports.backupDatabase = async (event, context) => {
  const sourceBucket = 'source-bucket';
  const targetBucket = 'backup-bucket';
  const timestamp = new Date().toISOString();
  
  await storage.bucket(sourceBucket).file('data.db')
    .copy(storage.bucket(targetBucket).file(\`backup-\${timestamp}.db\`));
  
  console.log('Backup completed successfully');
};`}</code>
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
