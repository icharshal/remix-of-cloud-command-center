# DevOps Automation Hub

Operational control plane for:

- monitoring agent ingestion
- live GKE/log visibility
- alerts and notifications
- Jira automation for new Google Cloud resource detection

## Local setup

1. Copy `.env.example` to `.env`
2. Fill in your Supabase values
3. Install dependencies:
   `npm install`
4. Start the app:
   `npm run dev`

## Core product areas

- Dashboard
- GKE Dashboard
- Monitoring Agent
- Alerting
- Log Viewer
- Jira Automation

Secondary experiments live under `Labs`.

## Testing with Google Cloud

This repo supports testing against real Google Cloud audit logs, but it does not ingest directly from Cloud Logging by itself. Use the helper script to replay audit log entries into `monitoring-ingest`.

See:

- [docs/google-cloud-testing.md](C:/Users/HP/Documents/New%20project/remix-of-cloud-command-center/docs/google-cloud-testing.md)
- [scripts/send-gcp-audit-log-to-monitoring.ps1](C:/Users/HP/Documents/New%20project/remix-of-cloud-command-center/scripts/send-gcp-audit-log-to-monitoring.ps1)

## Jira automation

Jira integration is optional.

When enabled, the app:

- detects Google Cloud resource creation from ingested audit-style logs
- records the event in `jira_resource_tickets`
- attempts Jira issue creation
- sets a due date 2 days from detection by default

Required backend environment variables for live Jira creation:

- `JIRA_API_EMAIL`
- `JIRA_API_TOKEN`
- `JIRA_BASE_URL`
- `JIRA_PROJECT_KEY`

## Validation

- `npm run lint`
- `npm run build`
