import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Mail, MessageSquare, Loader2, Send } from "lucide-react";
import { collection, query, orderBy, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from "firebase/firestore";
import { db, normalizeDoc } from "@/lib/firebase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface NotificationChannel {
  id: string;
  name: string;
  channel_type: string;
  config: Record<string, unknown>;
  enabled: boolean;
  severity_filter: string[];
  created_at: string;
}

const defaultChannel = {
  name: "",
  channel_type: "slack_webhook" as "slack_webhook" | "email",
  webhook_url: "",
  emails: "",
  severity_filter: ["critical", "warning"],
};

export default function NotificationChannels() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newChannel, setNewChannel] = useState(defaultChannel);
  const [testingChannel, setTestingChannel] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: channels = [], isLoading } = useQuery({
    queryKey: ['notification-channels'],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'notification_channels'), orderBy('created_at', 'desc')));
      return snap.docs.map(d => normalizeDoc<NotificationChannel>(d));
    },
  });

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'notification_channels'), orderBy('created_at', 'desc')),
      () => queryClient.invalidateQueries({ queryKey: ['notification-channels'] })
    );
    return unsub;
  }, [queryClient]);

  const createChannel = useMutation({
    mutationFn: async (channel: typeof defaultChannel) => {
      const config = channel.channel_type === 'slack_webhook'
        ? { webhook_url: channel.webhook_url }
        : { to: channel.emails.split(',').map(e => e.trim()).filter(Boolean) };
      await addDoc(collection(db, 'notification_channels'), {
        name: channel.name,
        channel_type: channel.channel_type,
        config,
        severity_filter: channel.severity_filter,
        enabled: true,
        created_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-channels'] });
      setIsDialogOpen(false);
      setNewChannel(defaultChannel);
      toast.success("Notification channel created");
    },
    onError: (error: Error) => toast.error("Failed to create channel: " + error.message),
  });

  const toggleChannel = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      await updateDoc(doc(db, 'notification_channels', id), { enabled });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notification-channels'] }),
  });

  const deleteChannel = useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, 'notification_channels', id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-channels'] });
      toast.success("Notification channel deleted");
    },
  });

  const testNotification = async (channelId: string) => {
    setTestingChannel(channelId);
    try {
      const url = import.meta.env.VITE_CHECK_ALERTS_URL;
      if (!url) throw new Error("VITE_CHECK_ALERTS_URL not configured");
      const resp = await fetch(url, { method: "POST" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      toast.success("Test notification triggered (alerts will be sent if any are active)");
    } catch (error: unknown) {
      toast.error("Test failed: " + (error as Error).message);
    } finally {
      setTestingChannel(null);
    }
  };

  const handleSeverityChange = (severity: string, checked: boolean) => {
    if (checked) {
      setNewChannel({ ...newChannel, severity_filter: [...newChannel.severity_filter, severity] });
    } else {
      setNewChannel({ ...newChannel, severity_filter: newChannel.severity_filter.filter(s => s !== severity) });
    }
  };

  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'slack_webhook': return <MessageSquare className="h-4 w-4" />;
      case 'email': return <Mail className="h-4 w-4" />;
      default: return null;
    }
  };

  const getChannelConfig = (channel: NotificationChannel) => {
    if (channel.channel_type === 'slack_webhook') {
      const url = (channel.config as { webhook_url?: string }).webhook_url || '';
      return url.substring(0, 50) + (url.length > 50 ? '...' : '');
    } else if (channel.channel_type === 'email') {
      const emails = (channel.config as { to?: string[] }).to || [];
      return emails.join(', ');
    }
    return '';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Notification Channels</CardTitle>
          <CardDescription>
            Configure where to send alert notifications
          </CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Channel
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Notification Channel</DialogTitle>
              <DialogDescription>
                Configure a new channel to receive alert notifications.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="channel-name">Channel Name</Label>
                <Input
                  id="channel-name"
                  placeholder="e.g., DevOps Slack Channel"
                  value={newChannel.name}
                  onChange={(e) => setNewChannel({ ...newChannel, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Channel Type</Label>
                <Select 
                  value={newChannel.channel_type} 
                  onValueChange={(v) => setNewChannel({ ...newChannel, channel_type: v as typeof newChannel.channel_type })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slack_webhook">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Slack Webhook
                      </div>
                    </SelectItem>
                    <SelectItem value="email">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Email (Resend)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {newChannel.channel_type === 'slack_webhook' && (
                <div className="space-y-2">
                  <Label htmlFor="webhook-url">Webhook URL</Label>
                  <Input
                    id="webhook-url"
                    type="url"
                    placeholder="https://hooks.slack.com/services/..."
                    value={newChannel.webhook_url}
                    onChange={(e) => setNewChannel({ ...newChannel, webhook_url: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Create an incoming webhook in your Slack workspace settings
                  </p>
                </div>
              )}

              {newChannel.channel_type === 'email' && (
                <div className="space-y-2">
                  <Label htmlFor="emails">Email Addresses</Label>
                  <Input
                    id="emails"
                    placeholder="team@example.com, ops@example.com"
                    value={newChannel.emails}
                    onChange={(e) => setNewChannel({ ...newChannel, emails: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Comma-separated email addresses. Requires RESEND_API_KEY secret.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <Label>Severity Filter</Label>
                <div className="flex gap-4">
                  {['critical', 'warning', 'info'].map((severity) => (
                    <div key={severity} className="flex items-center space-x-2">
                      <Checkbox
                        id={`severity-${severity}`}
                        checked={newChannel.severity_filter.includes(severity)}
                        onCheckedChange={(checked) => handleSeverityChange(severity, !!checked)}
                      />
                      <Label htmlFor={`severity-${severity}`} className="text-sm capitalize">
                        {severity}
                      </Label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Only send notifications for selected severity levels
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={() => createChannel.mutate(newChannel)} 
                disabled={!newChannel.name || (!newChannel.webhook_url && !newChannel.emails) || createChannel.isPending}
              >
                {createChannel.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Add Channel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : channels.length > 0 ? (
          <ScrollArea className="h-[300px]">
            <div className="space-y-3">
              {channels.map((channel) => (
                <div
                  key={channel.id}
                  className="flex items-center justify-between border rounded-lg p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
                      {getChannelIcon(channel.channel_type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{channel.name}</span>
                        <Badge variant="outline" className="capitalize">
                          {channel.channel_type.replace('_', ' ')}
                        </Badge>
                        {!channel.enabled && <Badge variant="secondary">Disabled</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {getChannelConfig(channel)}
                      </p>
                      <div className="flex gap-1 mt-1">
                        {channel.severity_filter.map((severity) => (
                          <Badge key={severity} variant="outline" className="text-xs capitalize">
                            {severity}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => testNotification(channel.id)}
                      disabled={testingChannel === channel.id}
                    >
                      {testingChannel === channel.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                    <Switch
                      checked={channel.enabled}
                      onCheckedChange={(enabled) => toggleChannel.mutate({ id: channel.id, enabled })}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteChannel.mutate(channel.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No notification channels configured</p>
            <p className="text-sm">Add a Slack webhook or email to receive alert notifications</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}