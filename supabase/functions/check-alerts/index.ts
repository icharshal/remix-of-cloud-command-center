import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AlertRule {
  id: string;
  name: string;
  description: string | null;
  metric_name: string;
  condition: 'greater_than' | 'less_than' | 'equals';
  threshold: number;
  severity: string;
  enabled: boolean;
  cooldown_minutes: number;
  labels: Record<string, string>;
}

interface Metric {
  id: string;
  agent_id: string;
  metric_name: string;
  value: number;
  pod_name: string | null;
  node_name: string | null;
  namespace: string | null;
  timestamp: string;
}

interface NotificationChannel {
  id: string;
  name: string;
  channel_type: 'email' | 'slack_webhook';
  config: {
    webhook_url?: string;
    to?: string[];
  };
  enabled: boolean;
  severity_filter: string[];
}

interface TriggeredAlert {
  rule_id: string;
  rule_name: string;
  metric_value: number;
  threshold: number;
  severity: string;
  message: string;
  pod_name?: string | null;
  node_name?: string | null;
  namespace?: string | null;
}

type SlackMrkdwnText = {
  type: "mrkdwn";
  text: string;
};

type SlackBlock =
  | {
      type: "header";
      text: {
        type: "plain_text";
        text: string;
        emoji: true;
      };
    }
  | { type: "divider" }
  | {
      type: "section";
      text: SlackMrkdwnText;
    }
  | {
      type: "context";
      elements: SlackMrkdwnText[];
    };

type SupabaseClient = ReturnType<typeof createClient>;

// Send Slack webhook notification
async function sendSlackNotification(webhookUrl: string, alerts: TriggeredAlert[]): Promise<void> {
  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `🚨 ${alerts.length} Alert${alerts.length > 1 ? 's' : ''} Triggered`,
        emoji: true
      }
    },
    {
      type: "divider"
    }
  ];

  for (const alert of alerts) {
    const severityEmoji = alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '🟡' : '🔵';
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${severityEmoji} *${alert.rule_name}*\n${alert.message}`
      }
      });
    
    const contextElements: SlackMrkdwnText[] = [];
    if (alert.pod_name) contextElements.push({ type: "mrkdwn", text: `*Pod:* ${alert.pod_name}` });
    if (alert.node_name) contextElements.push({ type: "mrkdwn", text: `*Node:* ${alert.node_name}` });
    if (alert.namespace) contextElements.push({ type: "mrkdwn", text: `*Namespace:* ${alert.namespace}` });
    contextElements.push({ type: "mrkdwn", text: `*Severity:* ${alert.severity}` });
    
    if (contextElements.length > 0) {
      blocks.push({
        type: "context",
        elements: contextElements
      });
    }
  }

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `📅 Triggered at ${new Date().toISOString()}`
      }
    ]
  });

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  });

  if (!response.ok) {
    console.error('Slack webhook failed:', await response.text());
  }
}

// Send email notification via Resend
async function sendEmailNotification(to: string[], alerts: TriggeredAlert[]): Promise<void> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    console.log('RESEND_API_KEY not configured, skipping email notification');
    return;
  }

  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const warningCount = alerts.filter(a => a.severity === 'warning').length;

  const subject = criticalCount > 0 
    ? `🚨 ${criticalCount} Critical Alert${criticalCount > 1 ? 's' : ''} Triggered`
    : `⚠️ ${warningCount} Warning Alert${warningCount > 1 ? 's' : ''} Triggered`;

  const alertRows = alerts.map(alert => {
    const severityColor = alert.severity === 'critical' ? '#dc2626' : alert.severity === 'warning' ? '#f59e0b' : '#3b82f6';
    return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; background-color: ${severityColor}; color: white; font-size: 12px; text-transform: uppercase;">
            ${alert.severity}
          </span>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${alert.rule_name}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${alert.message}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">
          ${[alert.pod_name, alert.node_name, alert.namespace].filter(Boolean).join(' / ') || '-'}
        </td>
      </tr>
    `;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; padding: 20px;">
      <div style="max-width: 800px; margin: 0 auto; background-color: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="padding: 24px; border-bottom: 1px solid #e5e7eb;">
          <h1 style="margin: 0; font-size: 24px; color: #111827;">GCP DevOps Alert Notification</h1>
          <p style="margin: 8px 0 0; color: #6b7280;">${alerts.length} alert${alerts.length > 1 ? 's' : ''} triggered at ${new Date().toLocaleString()}</p>
        </div>
        <div style="padding: 24px;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #f9fafb;">
                <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280;">Severity</th>
                <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280;">Rule</th>
                <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280;">Message</th>
                <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280;">Resource</th>
              </tr>
            </thead>
            <tbody>
              ${alertRows}
            </tbody>
          </table>
        </div>
        <div style="padding: 24px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px;">
          GCP Zenith Forge - DevOps Automation Tool
        </div>
      </div>
    </body>
    </html>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: 'GCP DevOps Alerts <onboarding@resend.dev>',
      to,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    console.error('Resend email failed:', await response.text());
  }
}

async function sendNotifications(
  supabaseClient: SupabaseClient,
  alerts: TriggeredAlert[]
): Promise<{ sent: number; failed: number }> {
  if (alerts.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const { data: channels, error } = await supabaseClient
    .from('notification_channels')
    .select('*')
    .eq('enabled', true);

  if (error || !channels || channels.length === 0) {
    console.log('No notification channels configured');
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const channel of channels as NotificationChannel[]) {
    // Filter alerts by severity
    const filteredAlerts = alerts.filter(alert => 
      channel.severity_filter.includes(alert.severity)
    );

    if (filteredAlerts.length === 0) {
      continue;
    }

    try {
      if (channel.channel_type === 'slack_webhook' && channel.config.webhook_url) {
        await sendSlackNotification(channel.config.webhook_url, filteredAlerts);
        console.log(`Sent Slack notification to channel: ${channel.name}`);
        sent++;
      } else if (channel.channel_type === 'email' && channel.config.to && channel.config.to.length > 0) {
        await sendEmailNotification(channel.config.to, filteredAlerts);
        console.log(`Sent email notification to channel: ${channel.name}`);
        sent++;
      }
    } catch (err) {
      console.error(`Failed to send notification to channel ${channel.name}:`, err);
      failed++;
    }
  }

  return { sent, failed };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all enabled alert rules
    const { data: rules, error: rulesError } = await supabase
      .from('alert_rules')
      .select('*')
      .eq('enabled', true);

    if (rulesError) {
      throw new Error(`Failed to fetch rules: ${rulesError.message}`);
    }

    if (!rules || rules.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No enabled alert rules found', alerts_triggered: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get recent metrics (last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: metrics, error: metricsError } = await supabase
      .from('collected_metrics')
      .select('*')
      .gte('timestamp', fiveMinutesAgo);

    if (metricsError) {
      throw new Error(`Failed to fetch metrics: ${metricsError.message}`);
    }

    const triggeredAlerts: TriggeredAlert[] = [];

    for (const rule of rules as AlertRule[]) {
      // Find matching metrics
      const matchingMetrics = (metrics as Metric[]).filter(m => 
        m.metric_name.toLowerCase().includes(rule.metric_name.toLowerCase())
      );

      for (const metric of matchingMetrics) {
        let shouldTrigger = false;
        const metricValue = Number(metric.value);

        switch (rule.condition) {
          case 'greater_than':
            shouldTrigger = metricValue > rule.threshold;
            break;
          case 'less_than':
            shouldTrigger = metricValue < rule.threshold;
            break;
          case 'equals':
            shouldTrigger = metricValue === rule.threshold;
            break;
        }

        if (shouldTrigger) {
          // Check cooldown - don't trigger if there's a recent alert for this rule
          const cooldownTime = new Date(Date.now() - rule.cooldown_minutes * 60 * 1000).toISOString();
          const { data: recentAlerts } = await supabase
            .from('triggered_alerts')
            .select('id')
            .eq('rule_id', rule.id)
            .eq('pod_name', metric.pod_name)
            .eq('node_name', metric.node_name)
            .gte('triggered_at', cooldownTime)
            .limit(1);

          if (recentAlerts && recentAlerts.length > 0) {
            continue; // Skip - still in cooldown
          }

          const conditionText = rule.condition === 'greater_than' ? '>' : 
                               rule.condition === 'less_than' ? '<' : '=';
          const message = `${rule.name}: ${metric.metric_name} is ${metricValue.toFixed(2)} (${conditionText} ${rule.threshold})` +
            (metric.pod_name ? ` on pod ${metric.pod_name}` : '') +
            (metric.node_name ? ` on node ${metric.node_name}` : '');

          // Insert triggered alert
          const { error: insertError } = await supabase
            .from('triggered_alerts')
            .insert({
              rule_id: rule.id,
              metric_value: metricValue,
              threshold: rule.threshold,
              agent_id: metric.agent_id,
              pod_name: metric.pod_name,
              node_name: metric.node_name,
              namespace: metric.namespace,
              message,
              severity: rule.severity,
              status: 'active',
            });

          if (!insertError) {
            triggeredAlerts.push({
              rule_id: rule.id,
              rule_name: rule.name,
              metric_value: metricValue,
              threshold: rule.threshold,
              severity: rule.severity,
              message,
              pod_name: metric.pod_name,
              node_name: metric.node_name,
              namespace: metric.namespace,
            });
          }
        }
      }
    }

    // Send notifications for triggered alerts
    const notificationResults = await sendNotifications(supabase, triggeredAlerts);

    // Auto-resolve alerts that are no longer triggered
    const { data: activeAlerts } = await supabase
      .from('triggered_alerts')
      .select('*, alert_rules!inner(*)')
      .eq('status', 'active');

    if (activeAlerts) {
      for (const alert of activeAlerts) {
        const rule = alert.alert_rules as AlertRule;
        const matchingMetrics = (metrics as Metric[]).filter(m => 
          m.metric_name.toLowerCase().includes(rule.metric_name.toLowerCase()) &&
          m.pod_name === alert.pod_name &&
          m.node_name === alert.node_name
        );

        if (matchingMetrics.length > 0) {
          const latestMetric = matchingMetrics[0];
          const metricValue = Number(latestMetric.value);
          let stillTriggered = false;

          switch (rule.condition) {
            case 'greater_than':
              stillTriggered = metricValue > rule.threshold;
              break;
            case 'less_than':
              stillTriggered = metricValue < rule.threshold;
              break;
            case 'equals':
              stillTriggered = metricValue === rule.threshold;
              break;
          }

          if (!stillTriggered) {
            await supabase
              .from('triggered_alerts')
              .update({ status: 'resolved', resolved_at: new Date().toISOString() })
              .eq('id', alert.id);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Alert check completed',
        rules_checked: rules.length,
        metrics_checked: metrics?.length || 0,
        alerts_triggered: triggeredAlerts.length,
        notifications: notificationResults,
        triggered: triggeredAlerts,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Alert check error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
