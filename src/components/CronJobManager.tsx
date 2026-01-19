import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, 
  DialogHeader, DialogTitle, DialogTrigger 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Clock, Trash2, Plus, Loader2, Play, Pause, RefreshCw, Calendar
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface CronJob {
  jobid: number;
  jobname: string;
  schedule: string;
  command: string;
  nodename: string;
  nodeport: number;
  database: string;
  username: string;
  active: boolean;
}

const SCHEDULE_PRESETS = [
  { label: "Every minute", value: "* * * * *" },
  { label: "Every 5 minutes", value: "*/5 * * * *" },
  { label: "Every 15 minutes", value: "*/15 * * * *" },
  { label: "Every 30 minutes", value: "*/30 * * * *" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Daily at midnight", value: "0 0 * * *" },
  { label: "Weekly on Sunday", value: "0 0 * * 0" },
];

const parseSchedule = (schedule: string): string => {
  const preset = SCHEDULE_PRESETS.find(p => p.value === schedule);
  if (preset) return preset.label;
  
  const parts = schedule.split(' ');
  if (parts.length !== 5) return schedule;
  
  const [minute, hour] = parts;
  
  if (minute === '*' && hour === '*') return 'Every minute';
  if (minute.startsWith('*/')) return `Every ${minute.slice(2)} minutes`;
  if (hour.startsWith('*/') && minute === '0') return `Every ${hour.slice(2)} hours`;
  
  return schedule;
};

export default function CronJobManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newJob, setNewJob] = useState({
    name: "",
    schedule: "* * * * *",
    functionName: "check-alerts",
  });
  const queryClient = useQueryClient();

  // Fetch cron jobs using raw RPC call
  const { data: jobs = [], isLoading, refetch } = useQuery({
    queryKey: ['cron-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_cron_jobs' as never);
      if (error) {
        console.log('Error fetching cron jobs:', error.message);
        return [];
      }
      return (data as unknown as CronJob[]) || [];
    },
  });

  // Toggle job active state
  const toggleJob = useMutation({
    mutationFn: async ({ jobId, active }: { jobId: number; active: boolean }) => {
      const { error } = await supabase.rpc('toggle_cron_job' as never, { 
        job_id: jobId, 
        is_active: active 
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cron-jobs'] });
      toast.success("Job status updated");
    },
    onError: (error) => {
      toast.error("Failed to update job: " + (error as Error).message);
    },
  });

  // Delete job
  const deleteJob = useMutation({
    mutationFn: async (jobName: string) => {
      const { error } = await supabase.rpc('delete_cron_job' as never, { 
        job_name: jobName 
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cron-jobs'] });
      toast.success("Cron job deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete job: " + (error as Error).message);
    },
  });

  // Create job
  const createJob = useMutation({
    mutationFn: async (job: typeof newJob) => {
      const { error } = await supabase.rpc('create_cron_job' as never, {
        job_name: job.name,
        job_schedule: job.schedule,
        function_name: job.functionName,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cron-jobs'] });
      setIsDialogOpen(false);
      setNewJob({ name: "", schedule: "* * * * *", functionName: "check-alerts" });
      toast.success("Cron job created");
    },
    onError: (error) => {
      toast.error("Failed to create job: " + (error as Error).message);
    },
  });

  const getJobFunctionName = (command: string): string => {
    const match = command.match(/functions\/v1\/([^'"]+)/);
    return match ? match[1] : 'Unknown';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Scheduled Jobs</h3>
          <p className="text-sm text-muted-foreground">
            Manage automated tasks that run on a schedule
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Job
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Scheduled Job</DialogTitle>
                <DialogDescription>
                  Schedule an edge function to run automatically on a cron schedule.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="job-name">Job Name</Label>
                  <Input
                    id="job-name"
                    placeholder="my-scheduled-job"
                    value={newJob.name}
                    onChange={(e) => setNewJob({ ...newJob, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Schedule</Label>
                  <Select 
                    value={newJob.schedule} 
                    onValueChange={(v) => setNewJob({ ...newJob, schedule: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SCHEDULE_PRESETS.map((preset) => (
                        <SelectItem key={preset.value} value={preset.value}>
                          {preset.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Cron expression: {newJob.schedule}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Edge Function</Label>
                  <Select 
                    value={newJob.functionName} 
                    onValueChange={(v) => setNewJob({ ...newJob, functionName: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="check-alerts">check-alerts</SelectItem>
                      <SelectItem value="monitoring-ingest">monitoring-ingest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => createJob.mutate(newJob)} 
                  disabled={!newJob.name || createJob.isPending}
                >
                  {createJob.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Job
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Cron Jobs
          </CardTitle>
          <CardDescription>
            {jobs.length > 0 ? `${jobs.length} scheduled jobs` : 'No scheduled jobs found'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : jobs.length > 0 ? (
            <div className="space-y-4">
              {jobs.map((job) => (
                <div
                  key={job.jobid}
                  className={`flex items-center justify-between border rounded-lg p-4 ${
                    job.active ? 'border-primary/30 bg-primary/5' : 'border-border opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${job.active ? 'bg-primary/10' : 'bg-muted'}`}>
                      <Clock className={`h-5 w-5 ${job.active ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{job.jobname}</span>
                        <Badge variant={job.active ? "default" : "secondary"}>
                          {job.active ? "Active" : "Paused"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {parseSchedule(job.schedule)}
                        </span>
                        <span>→ {getJobFunctionName(job.command)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      {job.active ? (
                        <Pause className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Play className="h-4 w-4 text-muted-foreground" />
                      )}
                      <Switch
                        checked={job.active}
                        onCheckedChange={(checked) => 
                          toggleJob.mutate({ jobId: job.jobid, active: checked })
                        }
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteJob.mutate(job.jobname)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No scheduled jobs configured.</p>
              <p className="text-sm mt-1">Create a job to automate your alerting checks.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
