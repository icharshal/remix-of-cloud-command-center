import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-agent-key',
};

interface LogEntry {
  pod_name?: string;
  container_name?: string;
  namespace?: string;
  log_level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  message: string;
  source?: string;
  labels?: Record<string, string>;
  timestamp?: string;
}

interface MetricEntry {
  metric_type: 'cpu' | 'memory' | 'disk' | 'network' | 'pods' | 'custom';
  metric_name: string;
  value: number;
  unit?: string;
  pod_name?: string;
  container_name?: string;
  namespace?: string;
  node_name?: string;
  labels?: Record<string, string>;
  timestamp?: string;
}

interface EventEntry {
  event_type: 'Normal' | 'Warning' | 'Error';
  reason: string;
  message: string;
  involved_object?: string;
  namespace?: string;
  source_component?: string;
  first_timestamp?: string;
  last_timestamp?: string;
  count?: number;
  labels?: Record<string, string>;
}

interface AgentRegistration {
  agent_id: string;
  agent_name: string;
  agent_type: 'pod' | 'vm' | 'container';
  cluster_name?: string;
  namespace?: string;
  node_name?: string;
  ip_address?: string;
  metadata?: Record<string, unknown>;
}

interface IngestPayload {
  action: 'register' | 'heartbeat' | 'ingest';
  agent_id: string;
  agent_data?: AgentRegistration;
  logs?: LogEntry[];
  metrics?: MetricEntry[];
  events?: EventEntry[];
}

interface JiraAutomationSettings {
  enabled: boolean;
  jira_base_url: string | null;
  jira_project_key: string | null;
  issue_type: string;
  due_days: number;
}

interface JiraResourceTicketRow {
  id: string;
}

interface InsertedLogRow {
  id: string;
  message: string;
  source: string | null;
  labels: Record<string, string> | null;
  timestamp: string;
}

interface DetectedResourceCreation {
  resourceType: string;
  resourceName: string;
  creatorName: string | null;
  creatorEmail: string | null;
  serviceName: string | null;
  methodName: string | null;
}

interface ParsedAuditLog {
  serviceName: string | null;
  methodName: string | null;
  resourceName: string | null;
  resourceType: string | null;
  creatorEmail: string | null;
  creatorName: string | null;
}

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const CREATION_METHOD_PATTERN =
  /(create|insert|provision|deploy|instantiate|add|runinstances|createcluster|createbucket)/i;
const CREATION_MESSAGE_PATTERN =
  /\b(created|create|provisioned|deployed|launched|added)\b/i;
const AUDIT_LOG_SOURCE_PATTERN = /(gcp|google\.cloud|cloudaudit|audit)/i;

const getLabelValue = (
  labels: Record<string, string> | null | undefined,
  keys: string[],
): string | null => {
  if (!labels) {
    return null;
  }

  for (const key of keys) {
    const value = labels[key];
    if (value && value.trim() !== "") {
      return value.trim();
    }
  }

  return null;
};

const getNestedValue = (value: unknown, path: string[]): string | null => {
  let current: unknown = value;

  for (const segment of path) {
    if (!current || typeof current !== "object" || !(segment in current)) {
      return null;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return typeof current === "string" && current.trim() !== "" ? current.trim() : null;
};

const parseStructuredAuditLog = (message: string): ParsedAuditLog | null => {
  const trimmed = message.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const protoPayload = (parsed.protoPayload ?? {}) as Record<string, unknown>;
    const resource = (parsed.resource ?? {}) as Record<string, unknown>;
    const authenticationInfo = (protoPayload.authenticationInfo ?? {}) as Record<string, unknown>;
    const resourceLabels = (resource.labels ?? {}) as Record<string, unknown>;

    return {
      serviceName:
        getNestedValue(parsed, ["serviceName"]) ||
        getNestedValue(protoPayload, ["serviceName"]),
      methodName:
        getNestedValue(parsed, ["methodName"]) ||
        getNestedValue(protoPayload, ["methodName"]),
      resourceName:
        getNestedValue(parsed, ["resourceName"]) ||
        getNestedValue(protoPayload, ["resourceName"]) ||
        getNestedValue(resourceLabels, ["instance_id"]) ||
        getNestedValue(resourceLabels, ["bucket_name"]) ||
        getNestedValue(resourceLabels, ["cluster_name"]) ||
        getNestedValue(resourceLabels, ["project_id"]),
      resourceType:
        getNestedValue(resource, ["type"]) ||
        getNestedValue(parsed, ["resourceType"]),
      creatorEmail:
        getNestedValue(authenticationInfo, ["principalEmail"]) ||
        getNestedValue(parsed, ["principalEmail"]),
      creatorName:
        getNestedValue(authenticationInfo, ["principalSubject"]) ||
        getNestedValue(parsed, ["principalSubject"]),
    };
  } catch {
    return null;
  }
};

const inferResourceType = (
  labels: Record<string, string> | null,
  methodName: string | null,
  serviceName: string | null,
  message: string,
): string | null => {
  const directType = getLabelValue(labels, [
    "resource_type",
    "resource.type",
    "resourceType",
    "protoPayload.resourceName.type",
  ]);

  if (directType) {
    return directType;
  }

  const loweredMessage = message.toLowerCase();
  const loweredMethod = methodName?.toLowerCase() ?? "";
  const loweredService = serviceName?.toLowerCase() ?? "";

  if (loweredMethod.includes("instance") || loweredMessage.includes("compute instance")) {
    return "compute_instance";
  }
  if (loweredMethod.includes("bucket") || loweredService.includes("storage.googleapis.com")) {
    return "storage_bucket";
  }
  if (loweredMethod.includes("cluster") || loweredService.includes("container.googleapis.com")) {
    return "gke_cluster";
  }
  if (loweredMethod.includes("sql") || loweredService.includes("sqladmin.googleapis.com")) {
    return "cloud_sql";
  }
  if (loweredMethod.includes("network") || loweredMethod.includes("subnetwork")) {
    return "network";
  }
  if (loweredMethod.includes("firewall")) {
    return "firewall_rule";
  }

  return "gcp_resource";
};

const inferResourceName = (
  labels: Record<string, string> | null,
  message: string,
): string | null => {
  const directName = getLabelValue(labels, [
    "resource_name",
    "resourceName",
    "protoPayload.resourceName",
    "name",
    "resource.labels.instance_id",
    "resource.labels.bucket_name",
    "resource.labels.cluster_name",
  ]);

  if (directName) {
    return directName;
  }

  const quotedMatch =
    message.match(/["']([^"']{3,})["']/) ||
    message.match(/\bresource\s+([A-Za-z0-9._:/-]{3,})/i) ||
    message.match(/\b(?:instance|bucket|cluster|network|subnetwork|disk)\s+([A-Za-z0-9._:/-]{3,})/i);

  return quotedMatch?.[1] ?? null;
};

const detectResourceCreationLog = (log: InsertedLogRow): DetectedResourceCreation | null => {
  const labels = log.labels ?? null;
  const parsedAuditLog = parseStructuredAuditLog(log.message);
  const methodName = getLabelValue(labels, [
    "methodName",
    "protoPayload.methodName",
    "gcp_method",
    "event_subtype",
  ]) || parsedAuditLog?.methodName || null;
  const serviceName = getLabelValue(labels, [
    "serviceName",
    "protoPayload.serviceName",
    "service_name",
  ]) || parsedAuditLog?.serviceName || null;

  const isGcpAuditSignal =
    (log.source ? AUDIT_LOG_SOURCE_PATTERN.test(log.source) : false) ||
    (serviceName?.includes("googleapis.com") ?? false) ||
    Boolean(methodName) ||
    parsedAuditLog !== null;

  const isCreateAction =
    (methodName ? CREATION_METHOD_PATTERN.test(methodName) : false) ||
    (!methodName && CREATION_MESSAGE_PATTERN.test(log.message));

  if (!isGcpAuditSignal || !isCreateAction) {
    return null;
  }

  const resourceType =
    parsedAuditLog?.resourceType ||
    inferResourceType(labels, methodName, serviceName, log.message);
  const resourceName =
    parsedAuditLog?.resourceName ||
    inferResourceName(labels, log.message);

  if (!resourceType || !resourceName) {
    return null;
  }

  if (resourceName.length < 3 || resourceName.toLowerCase() === "unknown") {
    return null;
  }

  const creatorEmail =
    getLabelValue(labels, [
      "principalEmail",
      "protoPayload.authenticationInfo.principalEmail",
      "user_email",
      "creator_email",
      "created_by_email",
      "actor_email",
      "email",
    ]) ||
    parsedAuditLog?.creatorEmail ||
    log.message.match(EMAIL_PATTERN)?.[0] ||
    null;

  const creatorName = getLabelValue(labels, [
    "creator_name",
    "created_by_name",
      "actor_name",
      "user_name",
      "display_name",
  ]) || parsedAuditLog?.creatorName || null;

  if (!methodName && !parsedAuditLog) {
    return null;
  }

  return {
    resourceType,
    resourceName,
    creatorName,
    creatorEmail,
    serviceName,
    methodName,
  };
};

const buildJiraDescription = (ticket: DetectedResourceCreation, dueDate: string, log: InsertedLogRow) => ({
  type: "doc",
  version: 1,
  content: [
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: `A new Google Cloud resource was detected from application logs and needs review.`,
        },
      ],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: `Resource type: ${ticket.resourceType}` }] }],
        },
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: `Resource name: ${ticket.resourceName}` }] }],
        },
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: `Creator: ${ticket.creatorEmail || ticket.creatorName || "Unknown"}` }] }],
        },
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: `Detected at: ${log.timestamp}` }] }],
        },
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: `Due date: ${dueDate}` }] }],
        },
      ],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: `Source log: ${log.message.slice(0, 500)}`,
        },
      ],
    },
  ],
});

const getJiraAuthHeader = (): string | null => {
  const email = Deno.env.get("JIRA_API_EMAIL");
  const token = Deno.env.get("JIRA_API_TOKEN");

  if (!email || !token) {
    return null;
  }

  return `Basic ${btoa(`${email}:${token}`)}`;
};

const findJiraAssignee = async (
  baseUrl: string,
  authHeader: string,
  creatorEmail: string | null,
  creatorName: string | null,
): Promise<string | null> => {
  const query = creatorEmail || creatorName;
  if (!query) {
    return null;
  }

  const response = await fetch(
    `${baseUrl}/rest/api/3/user/search?query=${encodeURIComponent(query)}`,
    {
      method: "GET",
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    return null;
  }

  const users = await response.json() as Array<{ accountId?: string }>;
  return users[0]?.accountId ?? null;
};

const createJiraIssue = async (
  settings: JiraAutomationSettings,
  detected: DetectedResourceCreation,
  log: InsertedLogRow,
  dueDate: string,
): Promise<{ issueKey: string; issueUrl: string }> => {
  const baseUrl = settings.jira_base_url || Deno.env.get("JIRA_BASE_URL");
  const projectKey = settings.jira_project_key || Deno.env.get("JIRA_PROJECT_KEY");
  const authHeader = getJiraAuthHeader();

  if (!baseUrl || !projectKey) {
    throw new Error("Jira base URL or project key is not configured");
  }

  if (!authHeader) {
    throw new Error("Jira API credentials are missing from environment variables");
  }

  const assigneeAccountId = await findJiraAssignee(
    baseUrl,
    authHeader,
    detected.creatorEmail,
    detected.creatorName,
  );

  const response = await fetch(`${baseUrl}/rest/api/3/issue`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: {
        project: { key: projectKey },
        summary: `Review new ${detected.resourceType}: ${detected.resourceName}`,
        issuetype: { name: settings.issue_type || "Task" },
        duedate: dueDate,
        description: buildJiraDescription(detected, dueDate, log),
        ...(assigneeAccountId ? { assignee: { accountId: assigneeAccountId } } : {}),
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Jira issue creation failed: ${errorText}`);
  }

  const issue = await response.json() as { key: string };
  return {
    issueKey: issue.key,
    issueUrl: `${baseUrl}/browse/${issue.key}`,
  };
};

const processResourceCreationTickets = async (
  supabase: ReturnType<typeof createClient>,
  insertedLogs: InsertedLogRow[],
): Promise<{ created: number; failed: number; skipped: number }> => {
  const { data: settingsRow } = await supabase
    .from("jira_automation_settings")
    .select("enabled, jira_base_url, jira_project_key, issue_type, due_days")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const settings = (settingsRow as JiraAutomationSettings | null) ?? null;
  let created = 0;
  let failed = 0;
  let skipped = 0;

  for (const log of insertedLogs) {
    const detected = detectResourceCreationLog(log);
    if (!detected) {
      continue;
    }

    const dueDays = settings?.due_days ?? 2;
    const dueDate = new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const summary = `Review new ${detected.resourceType}: ${detected.resourceName}`;

    const { data: ticketRow } = await supabase
      .from("jira_resource_tickets")
      .upsert(
        {
          source_log_id: log.id,
          provider: "gcp",
          resource_type: detected.resourceType,
          resource_name: detected.resourceName,
          creator_name: detected.creatorName,
          creator_email: detected.creatorEmail,
          summary,
          due_date: dueDate,
          jira_project_key: settings?.jira_project_key ?? null,
          issue_type: settings?.issue_type ?? "Task",
          status: settings?.enabled ? "pending" : "skipped",
          error_message: settings?.enabled
            ? null
            : "Jira automation is disabled in settings",
          metadata: {
            method_name: detected.methodName,
            service_name: detected.serviceName,
            detected_from: "collected_logs",
          },
        },
        { onConflict: "source_log_id" },
      )
      .select("id")
      .single();

    if (!settings?.enabled) {
      skipped += 1;
      continue;
    }

    try {
      const issue = await createJiraIssue(settings, detected, log, dueDate);

      await supabase
        .from("jira_resource_tickets")
        .update({
          status: "created",
          jira_issue_key: issue.issueKey,
          jira_issue_url: issue.issueUrl,
          error_message: null,
        })
        .eq("id", (ticketRow as JiraResourceTicketRow).id);

      created += 1;
    } catch (error) {
      await supabase
        .from("jira_resource_tickets")
        .update({
          status: "failed",
          error_message: error instanceof Error ? error.message : "Unknown Jira error",
        })
        .eq("id", (ticketRow as JiraResourceTicketRow).id);

      failed += 1;
    }
  }

  return { created, failed, skipped };
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: IngestPayload = await req.json();
    console.log(`[monitoring-ingest] Received ${payload.action} from agent: ${payload.agent_id}`);

    if (!payload.agent_id) {
      return new Response(
        JSON.stringify({ error: 'agent_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle different actions
    switch (payload.action) {
      case 'register': {
        if (!payload.agent_data) {
          return new Response(
            JSON.stringify({ error: 'agent_data is required for registration' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data, error } = await supabase
          .from('monitoring_agents')
          .upsert({
            agent_id: payload.agent_id,
            agent_name: payload.agent_data.agent_name,
            agent_type: payload.agent_data.agent_type,
            cluster_name: payload.agent_data.cluster_name,
            namespace: payload.agent_data.namespace,
            node_name: payload.agent_data.node_name,
            ip_address: payload.agent_data.ip_address,
            metadata: payload.agent_data.metadata || {},
            status: 'active',
            last_heartbeat: new Date().toISOString(),
          }, { onConflict: 'agent_id' })
          .select()
          .single();

        if (error) {
          console.error('[monitoring-ingest] Registration error:', error);
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`[monitoring-ingest] Agent registered: ${payload.agent_id}`);
        return new Response(
          JSON.stringify({ success: true, agent: data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'heartbeat': {
        const { error } = await supabase
          .from('monitoring_agents')
          .update({ 
            last_heartbeat: new Date().toISOString(),
            status: 'active'
          })
          .eq('agent_id', payload.agent_id);

        if (error) {
          console.error('[monitoring-ingest] Heartbeat error:', error);
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'ingest': {
        const results = {
          logs: 0,
          metrics: 0,
          events: 0,
          jira_tickets: 0,
          errors: [] as string[],
        };

        // Insert logs
        if (payload.logs && payload.logs.length > 0) {
          const logsToInsert = payload.logs.map(log => ({
            agent_id: payload.agent_id,
            pod_name: log.pod_name,
            container_name: log.container_name,
            namespace: log.namespace,
            log_level: log.log_level,
            message: log.message,
            source: log.source,
            labels: log.labels || {},
            timestamp: log.timestamp || new Date().toISOString(),
          }));

          const { data, error } = await supabase
            .from('collected_logs')
            .insert(logsToInsert)
            .select('id, message, source, labels, timestamp');

          if (error) {
            console.error('[monitoring-ingest] Logs insert error:', error);
            results.errors.push(`logs: ${error.message}`);
          } else {
            results.logs = logsToInsert.length;
            console.log(`[monitoring-ingest] Inserted ${results.logs} logs`);

            const jiraResults = await processResourceCreationTickets(
              supabase,
              (data as InsertedLogRow[]) ?? [],
            );
            results.jira_tickets = jiraResults.created;

            if (jiraResults.failed > 0) {
              results.errors.push(`jira: ${jiraResults.failed} ticket(s) failed to create`);
            }
          }
        }

        // Insert metrics
        if (payload.metrics && payload.metrics.length > 0) {
          const metricsToInsert = payload.metrics.map(metric => ({
            agent_id: payload.agent_id,
            metric_type: metric.metric_type,
            metric_name: metric.metric_name,
            value: metric.value,
            unit: metric.unit,
            pod_name: metric.pod_name,
            container_name: metric.container_name,
            namespace: metric.namespace,
            node_name: metric.node_name,
            labels: metric.labels || {},
            timestamp: metric.timestamp || new Date().toISOString(),
          }));

          const { error } = await supabase
            .from('collected_metrics')
            .insert(metricsToInsert);

          if (error) {
            console.error('[monitoring-ingest] Metrics insert error:', error);
            results.errors.push(`metrics: ${error.message}`);
          } else {
            results.metrics = metricsToInsert.length;
            console.log(`[monitoring-ingest] Inserted ${results.metrics} metrics`);
          }
        }

        // Insert events
        if (payload.events && payload.events.length > 0) {
          const eventsToInsert = payload.events.map(event => ({
            agent_id: payload.agent_id,
            event_type: event.event_type,
            reason: event.reason,
            message: event.message,
            involved_object: event.involved_object,
            namespace: event.namespace,
            source_component: event.source_component,
            first_timestamp: event.first_timestamp,
            last_timestamp: event.last_timestamp,
            count: event.count || 1,
            labels: event.labels || {},
          }));

          const { error } = await supabase
            .from('collected_events')
            .insert(eventsToInsert);

          if (error) {
            console.error('[monitoring-ingest] Events insert error:', error);
            results.errors.push(`events: ${error.message}`);
          } else {
            results.events = eventsToInsert.length;
            console.log(`[monitoring-ingest] Inserted ${results.events} events`);
          }
        }

        // Update agent heartbeat
        await supabase
          .from('monitoring_agents')
          .update({ last_heartbeat: new Date().toISOString(), status: 'active' })
          .eq('agent_id', payload.agent_id);

        return new Response(
          JSON.stringify({ 
            success: results.errors.length === 0,
            ingested: {
              logs: results.logs,
              metrics: results.metrics,
              events: results.events,
              jira_tickets: results.jira_tickets,
            },
            errors: results.errors.length > 0 ? results.errors : undefined
          }),
          { status: results.errors.length > 0 ? 207 : 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Use: register, heartbeat, or ingest' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('[monitoring-ingest] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
