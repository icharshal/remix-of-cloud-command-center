import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { MessageSquare, Send, CheckCircle2, Copy } from "lucide-react";

const notifications = [
  { event: "Deployment Success", enabled: true },
  { event: "Deployment Failure", enabled: true },
  { event: "High Cost Alert", enabled: true },
  { event: "Security Finding", enabled: true },
  { event: "Backup Completed", enabled: false },
  { event: "Certificate Expiry", enabled: true },
];

export default function ChatOps() {
  const [platform, setPlatform] = useState<"slack" | "teams">("slack");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [channel, setChannel] = useState("");
  const [testMessage, setTestMessage] = useState("Hello from DevOps Hub! 🚀");

  const handleSaveWebhook = () => {
    if (!webhookUrl) {
      toast.error("Please enter a webhook URL");
      return;
    }
    toast.success(`${platform === "slack" ? "Slack" : "Teams"} webhook configured successfully!`);
  };

  const handleTestMessage = () => {
    if (!webhookUrl) {
      toast.error("Please configure webhook URL first");
      return;
    }
    toast.success("Test message sent!");
  };

  const examplePayload = platform === "slack" ? `{
  "text": "Deployment Alert",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Deployment Completed* ✅\\n*Application:* frontend-app\\n*Version:* v2.1.0\\n*Environment:* Production\\n*Status:* Success"
      }
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "View Logs"
          },
          "url": "https://console.cloud.google.com/logs"
        }
      ]
    }
  ]
}` : `{
  "@type": "MessageCard",
  "@context": "https://schema.org/extensions",
  "summary": "Deployment Alert",
  "themeColor": "0078D7",
  "title": "Deployment Completed ✅",
  "sections": [
    {
      "activityTitle": "frontend-app",
      "activitySubtitle": "v2.1.0",
      "facts": [
        {
          "name": "Environment:",
          "value": "Production"
        },
        {
          "name": "Status:",
          "value": "Success"
        }
      ]
    }
  ],
  "potentialAction": [
    {
      "@type": "OpenUri",
      "name": "View Logs",
      "targets": [
        {
          "os": "default",
          "uri": "https://console.cloud.google.com/logs"
        }
      ]
    }
  ]
}`;

  const copyPayload = () => {
    navigator.clipboard.writeText(examplePayload);
    toast.success("Payload copied to clipboard!");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">ChatOps Integration</h1>
        <p className="mt-2 text-muted-foreground">
          Connect with Slack and Microsoft Teams for deployment notifications
        </p>
      </div>

      <Tabs value={platform} onValueChange={(v) => setPlatform(v as any)}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="slack">Slack</TabsTrigger>
          <TabsTrigger value="teams">Microsoft Teams</TabsTrigger>
        </TabsList>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Configuration */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Webhook Configuration</CardTitle>
                <CardDescription>
                  Configure incoming webhook for {platform === "slack" ? "Slack" : "Microsoft Teams"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="webhookUrl">Webhook URL</Label>
                  <Input
                    id="webhookUrl"
                    placeholder={
                      platform === "slack"
                        ? "https://hooks.slack.com/services/..."
                        : "https://outlook.office.com/webhook/..."
                    }
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    type="password"
                  />
                </div>

                {platform === "slack" && (
                  <div className="space-y-2">
                    <Label htmlFor="channel">Channel</Label>
                    <Input
                      id="channel"
                      placeholder="#deployments"
                      value={channel}
                      onChange={(e) => setChannel(e.target.value)}
                    />
                  </div>
                )}

                <Button onClick={handleSaveWebhook} className="w-full">
                  Save Configuration
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Test Integration</CardTitle>
                <CardDescription>Send a test message to verify connection</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="testMessage">Test Message</Label>
                  <Textarea
                    id="testMessage"
                    placeholder="Enter your test message"
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    rows={3}
                  />
                </div>

                <Button onClick={handleTestMessage} className="w-full" variant="outline">
                  <Send className="mr-2 h-4 w-4" />
                  Send Test Message
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>Choose which events trigger notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {notifications.map((notification, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <Label htmlFor={`notif-${index}`} className="flex-1">
                      {notification.event}
                    </Label>
                    <Switch id={`notif-${index}`} defaultChecked={notification.enabled} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </Tabs>

      {/* Example Payload */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Example Webhook Payload</CardTitle>
              <CardDescription>
                Sample {platform === "slack" ? "Slack" : "Teams"} message format
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={copyPayload}>
              <Copy className="mr-2 h-4 w-4" />
              Copy
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <pre className="overflow-auto rounded-lg bg-secondary p-4 text-xs">
            <code>{examplePayload}</code>
          </pre>
        </CardContent>
      </Card>

      {/* Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={platform}>
            <TabsList>
              <TabsTrigger value="slack">Slack Setup</TabsTrigger>
              <TabsTrigger value="teams">Teams Setup</TabsTrigger>
            </TabsList>

            <TabsContent value="slack" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Badge>Step 1</Badge>
                <p className="text-sm text-muted-foreground">
                  Go to your Slack workspace and create a new app at{" "}
                  <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    api.slack.com/apps
                  </a>
                </p>
              </div>
              <div className="space-y-2">
                <Badge>Step 2</Badge>
                <p className="text-sm text-muted-foreground">
                  Enable "Incoming Webhooks" in your app settings
                </p>
              </div>
              <div className="space-y-2">
                <Badge>Step 3</Badge>
                <p className="text-sm text-muted-foreground">
                  Click "Add New Webhook to Workspace" and select a channel
                </p>
              </div>
              <div className="space-y-2">
                <Badge>Step 4</Badge>
                <p className="text-sm text-muted-foreground">
                  Copy the webhook URL and paste it in the configuration above
                </p>
              </div>
            </TabsContent>

            <TabsContent value="teams" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Badge>Step 1</Badge>
                <p className="text-sm text-muted-foreground">
                  Open Microsoft Teams and navigate to the channel where you want notifications
                </p>
              </div>
              <div className="space-y-2">
                <Badge>Step 2</Badge>
                <p className="text-sm text-muted-foreground">
                  Click the "..." menu and select "Connectors"
                </p>
              </div>
              <div className="space-y-2">
                <Badge>Step 3</Badge>
                <p className="text-sm text-muted-foreground">
                  Search for "Incoming Webhook" and click "Configure"
                </p>
              </div>
              <div className="space-y-2">
                <Badge>Step 4</Badge>
                <p className="text-sm text-muted-foreground">
                  Name your webhook and copy the URL, then paste it in the configuration above
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
