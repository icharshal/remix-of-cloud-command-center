export type RepoGraphNodeType =
  | "repository"
  | "runtime"
  | "entrypoint"
  | "component"
  | "page"
  | "client"
  | "table"
  | "edge_function"
  | "script"
  | "database_function"
  | "extension"
  | "external_system"
  | "data_module";

export interface RepoGraphNode {
  id: string;
  label: string;
  type: RepoGraphNodeType;
  path?: string;
  group: "frontend" | "backend" | "database" | "external" | "extension";
}

export interface RepoGraphEdge {
  source: string;
  target: string;
  label: string;
}

export const repoGraphNodes: RepoGraphNode[] = [
  { id: "repo", label: "DevOps Automation Hub", type: "repository", group: "frontend" },
  { id: "frontend", label: "Vite React frontend", type: "runtime", group: "frontend" },
  { id: "app", label: "src/App.tsx", type: "entrypoint", group: "frontend" },
  { id: "layout", label: "Layout", type: "component", group: "frontend" },
  { id: "firestore_client", label: "Supabase client", type: "client", group: "frontend" },
  { id: "dashboard", label: "Dashboard", type: "page", path: "/", group: "frontend" },
  { id: "gke_dashboard", label: "GKE Dashboard", type: "page", path: "/gke", group: "frontend" },
  { id: "monitoring_agent_page", label: "Monitoring Agent", type: "page", path: "/monitoring-agent", group: "frontend" },
  { id: "alerts_page", label: "Alerting", type: "page", path: "/alerts", group: "frontend" },
  { id: "logs_page", label: "Log Viewer", type: "page", path: "/logs", group: "frontend" },
  { id: "jira_page", label: "Jira Automation", type: "page", path: "/jira-automation", group: "frontend" },
  { id: "cost_dashboard", label: "Cost Signals", type: "page", path: "/costs", group: "frontend" },
  { id: "security_analyzer", label: "Security Analyzer", type: "page", path: "/security", group: "frontend" },
  { id: "plugin_marketplace", label: "Plugin Marketplace", type: "page", path: "/plugins", group: "extension" },
  { id: "repo_graph_page", label: "Repo Graph", type: "page", path: "/knowledge-graph", group: "extension" },
  { id: "plugin_registry", label: "Plugin registry", type: "data_module", group: "extension" },
  { id: "monitoring_ingest", label: "monitoring-ingest", type: "edge_function", group: "backend" },
  { id: "check_alerts", label: "check-alerts", type: "edge_function", group: "backend" },
  { id: "gcp_replay_script", label: "GCP replay script", type: "script", group: "backend" },
  { id: "monitoring_agents", label: "monitoring_agents", type: "table", group: "database" },
  { id: "collected_logs", label: "collected_logs", type: "table", group: "database" },
  { id: "collected_metrics", label: "collected_metrics", type: "table", group: "database" },
  { id: "collected_events", label: "collected_events", type: "table", group: "database" },
  { id: "alert_rules", label: "alert_rules", type: "table", group: "database" },
  { id: "triggered_alerts", label: "triggered_alerts", type: "table", group: "database" },
  { id: "notification_channels", label: "notification_channels", type: "table", group: "database" },
  { id: "jira_automation_settings", label: "jira_automation_settings", type: "table", group: "database" },
  { id: "jira_resource_tickets", label: "jira_resource_tickets", type: "table", group: "database" },
  { id: "cron_rpcs", label: "cron management RPCs", type: "database_function", group: "database" },
  { id: "pg_cron", label: "pg_cron", type: "extension", group: "database" },
  { id: "google_cloud_logging", label: "Google Cloud Logging", type: "external_system", group: "external" },
  { id: "jira_cloud", label: "Jira Cloud API", type: "external_system", group: "external" },
  { id: "slack_webhook", label: "Slack webhook", type: "external_system", group: "external" },
  { id: "resend_email", label: "Resend email API", type: "external_system", group: "external" },
];

export const repoGraphEdges: RepoGraphEdge[] = [
  { source: "repo", target: "frontend", label: "contains" },
  { source: "frontend", target: "app", label: "boots" },
  { source: "app", target: "layout", label: "wraps" },
  { source: "app", target: "dashboard", label: "routes" },
  { source: "app", target: "gke_dashboard", label: "routes" },
  { source: "app", target: "monitoring_agent_page", label: "routes" },
  { source: "app", target: "alerts_page", label: "routes" },
  { source: "app", target: "logs_page", label: "routes" },
  { source: "app", target: "jira_page", label: "routes" },
  { source: "app", target: "cost_dashboard", label: "routes" },
  { source: "app", target: "security_analyzer", label: "routes" },
  { source: "app", target: "plugin_marketplace", label: "routes" },
  { source: "app", target: "repo_graph_page", label: "routes" },
  { source: "repo_graph_page", target: "firestore_client", label: "maps" },
  { source: "dashboard", target: "firestore_client", label: "queries" },
  { source: "gke_dashboard", target: "firestore_client", label: "queries" },
  { source: "monitoring_agent_page", target: "firestore_client", label: "queries" },
  { source: "alerts_page", target: "firestore_client", label: "mutates" },
  { source: "logs_page", target: "firestore_client", label: "queries" },
  { source: "jira_page", target: "firestore_client", label: "mutates" },
  { source: "cost_dashboard", target: "firestore_client", label: "queries" },
  { source: "security_analyzer", target: "firestore_client", label: "queries" },
  { source: "plugin_marketplace", target: "plugin_registry", label: "reads" },
  { source: "firestore_client", target: "monitoring_agents", label: "reads" },
  { source: "firestore_client", target: "collected_logs", label: "reads" },
  { source: "firestore_client", target: "collected_metrics", label: "reads" },
  { source: "firestore_client", target: "collected_events", label: "reads" },
  { source: "firestore_client", target: "alert_rules", label: "CRUD" },
  { source: "firestore_client", target: "triggered_alerts", label: "updates" },
  { source: "firestore_client", target: "notification_channels", label: "CRUD" },
  { source: "firestore_client", target: "jira_automation_settings", label: "upserts" },
  { source: "firestore_client", target: "jira_resource_tickets", label: "reads" },
  { source: "alerts_page", target: "check_alerts", label: "invokes" },
  { source: "cron_rpcs", target: "pg_cron", label: "manages" },
  { source: "pg_cron", target: "check_alerts", label: "schedules" },
  { source: "gcp_replay_script", target: "monitoring_ingest", label: "posts" },
  { source: "google_cloud_logging", target: "gcp_replay_script", label: "exports" },
  { source: "monitoring_agent_page", target: "monitoring_ingest", label: "posts" },
  { source: "monitoring_ingest", target: "monitoring_agents", label: "upserts" },
  { source: "monitoring_ingest", target: "collected_logs", label: "inserts" },
  { source: "monitoring_ingest", target: "collected_metrics", label: "inserts" },
  { source: "monitoring_ingest", target: "collected_events", label: "inserts" },
  { source: "monitoring_ingest", target: "jira_automation_settings", label: "reads" },
  { source: "monitoring_ingest", target: "jira_resource_tickets", label: "upserts" },
  { source: "monitoring_ingest", target: "jira_cloud", label: "creates issues" },
  { source: "check_alerts", target: "alert_rules", label: "reads" },
  { source: "check_alerts", target: "collected_metrics", label: "reads" },
  { source: "check_alerts", target: "triggered_alerts", label: "writes" },
  { source: "check_alerts", target: "notification_channels", label: "reads" },
  { source: "check_alerts", target: "slack_webhook", label: "notifies" },
  { source: "check_alerts", target: "resend_email", label: "emails" },
  { source: "alert_rules", target: "triggered_alerts", label: "FK rule_id" },
  { source: "collected_logs", target: "jira_resource_tickets", label: "FK source_log_id" },
];

export const groupColors: Record<RepoGraphNode["group"], string> = {
  frontend: "#38bdf8",
  backend: "#22c55e",
  database: "#f59e0b",
  external: "#f43f5e",
  extension: "#a78bfa",
};
