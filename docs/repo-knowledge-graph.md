# Repository Knowledge Graph

This map describes the current repository as an operational knowledge graph: app surfaces, shared components, backend functions, database tables, external systems, and the flows between them.

## System Graph

```mermaid
flowchart LR
  User[Operator] --> Browser[Browser]
  Browser --> ReactApp[Vite React app]

  subgraph Frontend["Frontend runtime"]
    ReactApp --> Main[src/main.tsx]
    Main --> App[src/App.tsx]
    App --> QueryClient[TanStack Query provider]
    App --> TooltipProvider[Tooltip provider]
    App --> Toasts[Toasters]
    App --> Router[React Router]
    Router --> Layout[src/components/Layout.tsx]
    Layout --> CoreNav[Core navigation]
    Layout --> LabsNav[Labs navigation]
    Layout --> ExtensionsNav[Extensions navigation]
  end

  subgraph Pages["Route pages"]
    Router --> Dashboard["/ Dashboard"]
    Router --> GKE["/gke GKE Dashboard"]
    Router --> MonitoringAgent["/monitoring-agent Monitoring Agent"]
    Router --> Alerts["/alerts Alerting"]
    Router --> LogsPage["/logs Log Viewer"]
    Router --> JiraAutomation["/jira-automation Jira Automation"]
    Router --> Costs["/costs Cost Signals"]
    Router --> Terraform["/terraform Terraform Generator"]
    Router --> CICD["/cicd CI/CD Builder"]
    Router --> Security["/security Security Analyzer"]
    Router --> Plugins["/plugins Plugin Marketplace"]
    Router --> NotFound["* NotFound"]
  end

  subgraph SharedComponents["Shared components"]
    Alerts --> NotificationChannels[src/components/NotificationChannels.tsx]
    Alerts --> AlertHistory[src/components/AlertHistoryDashboard.tsx]
    Alerts --> CronJobs[src/components/CronJobManager.tsx]
    LogsPage --> LogViewer[src/components/LogViewer.tsx]
    Plugins --> KnowledgeGraph[src/components/KnowledgeGraph.tsx]
    Plugins --> PluginRegistry[src/lib/plugins/registry.ts]
    KnowledgeGraph --> PluginRegistry
    KnowledgeGraph --> ReactFlow["@xyflow/react"]
  end

  subgraph SupabaseClient["Supabase browser client"]
    SupabaseClientFile[src/integrations/supabase/client.ts] --> SupabaseJS["@supabase/supabase-js"]
    SupabaseTypes[src/integrations/supabase/types.ts] --> SupabaseClientFile
  end

  Dashboard --> SupabaseClientFile
  GKE --> SupabaseClientFile
  MonitoringAgent --> SupabaseClientFile
  Alerts --> SupabaseClientFile
  LogViewer --> SupabaseClientFile
  JiraAutomation --> SupabaseClientFile
  Costs --> SupabaseClientFile
  Security --> SupabaseClientFile
  NotificationChannels --> SupabaseClientFile
  AlertHistory --> SupabaseClientFile
  CronJobs --> SupabaseClientFile

  subgraph Database["Supabase Postgres"]
    Agents[(monitoring_agents)]
    Logs[(collected_logs)]
    Metrics[(collected_metrics)]
    Events[(collected_events)]
    AlertRules[(alert_rules)]
    TriggeredAlerts[(triggered_alerts)]
    NotificationTable[(notification_channels)]
    JiraSettings[(jira_automation_settings)]
    JiraTickets[(jira_resource_tickets)]
    CronRPCs[[get_cron_jobs / create_cron_job / toggle_cron_job / delete_cron_job]]
    PgCron[(pg_cron)]
  end

  SupabaseClientFile --> Agents
  SupabaseClientFile --> Logs
  SupabaseClientFile --> Metrics
  SupabaseClientFile --> Events
  SupabaseClientFile --> AlertRules
  SupabaseClientFile --> TriggeredAlerts
  SupabaseClientFile --> NotificationTable
  SupabaseClientFile --> JiraSettings
  SupabaseClientFile --> JiraTickets
  SupabaseClientFile --> CronRPCs
  CronRPCs --> PgCron

  AlertRules -->|rule_id FK| TriggeredAlerts
  Logs -->|source_log_id FK| JiraTickets

  subgraph EdgeFunctions["Supabase Edge Functions"]
    MonitoringIngest[supabase/functions/monitoring-ingest]
    CheckAlerts[supabase/functions/check-alerts]
  end

  MonitoringAgent -->|agent script posts register/heartbeat/ingest| MonitoringIngest
  Scripts[scripts/send-gcp-audit-log-to-monitoring.ps1] -->|replays audit logs| MonitoringIngest
  CronJobs -->|manual schedule| CheckAlerts
  NotificationChannels -->|test trigger| CheckAlerts
  Alerts -->|manual check| CheckAlerts
  PgCron -->|scheduled invocation| CheckAlerts

  MonitoringIngest -->|upsert active agent| Agents
  MonitoringIngest -->|insert logs| Logs
  MonitoringIngest -->|insert metrics| Metrics
  MonitoringIngest -->|insert events| Events
  MonitoringIngest -->|detect resource creation| JiraTickets
  MonitoringIngest -->|read settings| JiraSettings
  CheckAlerts -->|read enabled rules| AlertRules
  CheckAlerts -->|read recent metrics| Metrics
  CheckAlerts -->|insert / resolve| TriggeredAlerts
  CheckAlerts -->|read enabled channels| NotificationTable

  subgraph External["External systems"]
    GCP[Google Cloud Logging]
    Jira[Jira Cloud API]
    Slack[Slack webhook]
    Resend[Resend email API]
  end

  GCP --> Scripts
  MonitoringIngest -->|optional issue creation| Jira
  CheckAlerts -->|slack_webhook channel| Slack
  CheckAlerts -->|email channel with RESEND_API_KEY| Resend
```

## Primary Flows

### Monitoring Ingestion

```mermaid
sequenceDiagram
  participant Agent as Monitoring agent or replay script
  participant Ingest as monitoring-ingest Edge Function
  participant DB as Supabase Postgres
  participant Jira as Jira Cloud API

  Agent->>Ingest: register, heartbeat, or ingest payload
  Ingest->>DB: upsert monitoring_agents
  Ingest->>DB: insert collected_logs / collected_metrics / collected_events
  Ingest->>Ingest: inspect inserted logs for GCP resource creation signals
  Ingest->>DB: read jira_automation_settings
  Ingest->>DB: upsert jira_resource_tickets
  Ingest->>Jira: optionally create Jira issue
  Ingest->>DB: update ticket status created / failed / skipped
```

### Alert Evaluation

```mermaid
sequenceDiagram
  participant UI as Alerts page or pg_cron
  participant Check as check-alerts Edge Function
  participant DB as Supabase Postgres
  participant Notify as Slack or Resend

  UI->>Check: invoke check-alerts
  Check->>DB: read enabled alert_rules
  Check->>DB: read recent collected_metrics
  Check->>DB: insert triggered_alerts after cooldown check
  Check->>DB: read notification_channels
  Check->>Notify: send filtered notifications
  Check->>DB: resolve active alerts whose metrics recovered
```

### Plugin Marketplace Graph

```mermaid
flowchart TD
  PluginsPage[src/pages/PluginMarketplace.tsx] --> Registry[src/lib/plugins/registry.ts]
  PluginsPage --> KnowledgeGraph[src/components/KnowledgeGraph.tsx]
  KnowledgeGraph --> Registry
  KnowledgeGraph --> Categories[Category hubs]
  KnowledgeGraph --> PluginNodes[Plugin cards]
  KnowledgeGraph --> IntegrationNodes[Integration chips]
  Registry --> PluginTypes[src/lib/plugins/types.ts]

  PluginNodes --> Dependencies[Plugin dependencies]
  PluginNodes --> Integrations[GitHub / GitLab / Bitbucket / GCP / Prometheus / etc.]
```

## Page-To-Data Matrix

| Page or component | Main role | Data sources / targets |
| --- | --- | --- |
| `src/pages/Dashboard.tsx` | Overview of operational health | `monitoring_agents`, `triggered_alerts`, `collected_logs`, `collected_events`, `alert_rules`, `jira_resource_tickets`, realtime channel `dashboard-overview` |
| `src/pages/GKEDashboard.tsx` | Cluster/log/event/metric visibility | `collected_logs`, `collected_events`, `collected_metrics`, `monitoring_agents`, realtime channel `gke-dashboard-realtime` |
| `src/pages/MonitoringAgent.tsx` | Agent instructions and registered agent status | `monitoring_agents`, realtime channel `monitoring-agents-changes` |
| `src/pages/Alerts.tsx` | Alert rule CRUD, active alerts, manual checks | `alert_rules`, `triggered_alerts`, Edge Function `check-alerts`, realtime channel `alerts-realtime` |
| `src/components/NotificationChannels.tsx` | Notification channel CRUD and test dispatch | `notification_channels`, Edge Function `check-alerts`, realtime channel `notification-channels-realtime` |
| `src/components/AlertHistoryDashboard.tsx` | Alert trend/history charts | `triggered_alerts` |
| `src/components/CronJobManager.tsx` | Schedule Edge Function checks | RPCs `get_cron_jobs`, `create_cron_job`, `toggle_cron_job`, `delete_cron_job` |
| `src/components/LogViewer.tsx` | Search/filter streamed logs | `collected_logs`, realtime channel `log-viewer-realtime` |
| `src/pages/JiraAutomation.tsx` | Jira automation settings and ticket history | `jira_automation_settings`, `jira_resource_tickets`, realtime channel `jira-automation-page` |
| `src/pages/CostDashboard.tsx` | Cost signal heuristics from telemetry | `collected_logs`, `collected_metrics`, `triggered_alerts`, `monitoring_agents`, realtime channel `cost-dashboard-signals` |
| `src/pages/SecurityAnalyzer.tsx` | Security signal heuristics from logs, alerts, tickets | `collected_logs`, `triggered_alerts`, `jira_resource_tickets` |
| `src/pages/TerraformGenerator.tsx` | Client-side Terraform template generator | Local React state only |
| `src/pages/CICDBuilder.tsx` | Client-side pipeline config generator | Local React state only |
| `src/pages/PluginMarketplace.tsx` | Plugin catalog and plugin graph | `pluginRegistry`, `KnowledgeGraph` |

## Database Relationship Graph

```mermaid
erDiagram
  ALERT_RULES ||--o{ TRIGGERED_ALERTS : "rule_id"
  COLLECTED_LOGS ||--o| JIRA_RESOURCE_TICKETS : "source_log_id"

  MONITORING_AGENTS {
    uuid id
    text agent_id
    text agent_name
    text agent_type
    text status
    timestamptz last_heartbeat
  }

  COLLECTED_LOGS {
    uuid id
    text agent_id
    text message
    text log_level
    text source
    timestamptz timestamp
  }

  COLLECTED_METRICS {
    uuid id
    text agent_id
    text metric_type
    text metric_name
    numeric value
    timestamptz timestamp
  }

  COLLECTED_EVENTS {
    uuid id
    text agent_id
    text event_type
    text reason
    text message
  }

  ALERT_RULES {
    uuid id
    text name
    text metric_name
    text condition
    numeric threshold
    text severity
    boolean enabled
  }

  TRIGGERED_ALERTS {
    uuid id
    uuid rule_id
    text status
    text severity
    numeric metric_value
    timestamptz triggered_at
  }

  NOTIFICATION_CHANNELS {
    uuid id
    text name
    text channel_type
    jsonb config
    text[] severity_filter
    boolean enabled
  }

  JIRA_AUTOMATION_SETTINGS {
    uuid id
    boolean enabled
    text jira_project_key
    text issue_type
    integer due_days
  }

  JIRA_RESOURCE_TICKETS {
    uuid id
    uuid source_log_id
    text provider
    text resource_type
    text resource_name
    text status
    text jira_issue_key
  }
```

## Key Architecture Notes

- The frontend is mostly direct-to-Supabase: route pages use `src/integrations/supabase/client.ts` plus TanStack Query for fetching and cache invalidation.
- Realtime updates are table-publication based; migrations add the operational tables to `supabase_realtime`.
- `monitoring-ingest` is the write-heavy backend boundary. It registers agents, accepts logs/metrics/events, and optionally creates Jira tickets from GCP audit-style logs.
- `check-alerts` is the alerting backend boundary. It compares recent metrics against `alert_rules`, writes `triggered_alerts`, sends notifications, and resolves recovered alerts.
- The in-app `KnowledgeGraph` component currently visualizes the plugin registry, not this repository map. This document is the repo-level knowledge graph.
