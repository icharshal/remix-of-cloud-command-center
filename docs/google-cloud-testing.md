# Google Cloud Testing

This app does not pull directly from Google Cloud Logging by itself. To test resource detection end to end, replay Google Cloud audit logs into the `monitoring-ingest` Supabase edge function.

## Prerequisites

- Google Cloud SDK installed and authenticated
- A test GCP project
- Supabase project with the latest migrations applied
- `monitoring-ingest` edge function deployed

## Recommended test resource

Use a Cloud Storage bucket first. It is low-impact and produces a clean audit entry with:

- `protoPayload.methodName`
- `protoPayload.authenticationInfo.principalEmail`
- `protoPayload.resourceName`
- `resource.type`
- `resource.labels.bucket_name`

## Safe test flow

1. Set the active GCP project:
   `gcloud config set project YOUR_PROJECT_ID`
2. Create a temporary bucket:
   `gcloud storage buckets create gs://YOUR_UNIQUE_BUCKET --location=US --uniform-bucket-level-access`
3. Read the audit log:
   `gcloud logging read "resource.type=\"gcs_bucket\" AND protoPayload.resourceName:\"YOUR_UNIQUE_BUCKET\"" --limit=5 --format=json`
4. Replay the log into the app with the helper script in `scripts/send-gcp-audit-log-to-monitoring.ps1`
5. Open the Jira Automation page and confirm the detected resource ticket appears with a due date 2 days after detection

## Environment variables

Frontend:

- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`

Edge function environment for optional Jira creation:

- `JIRA_API_EMAIL`
- `JIRA_API_TOKEN`
- `JIRA_BASE_URL`
- `JIRA_PROJECT_KEY`

## Notes

- Jira is optional. If disabled, the app will still record detected resource-ticket events in `jira_resource_tickets`.
- Structured Google Cloud audit logs are strongly preferred over plain text logs.
- Use a test project and temporary resources only.
