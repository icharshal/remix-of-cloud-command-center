# GCP Resource Deletion — Setup Guide

## How it works

When you click **Delete from GCP** on the Resource Governance page, the portal calls a Supabase Edge Function (`gcp-delete-resource`) which:

1. Exchanges your GCP service account JSON for a short-lived access token
2. Calls the appropriate GCP REST API to delete the resource
3. Updates the portal DB (marks ticket as `deleted`)
4. Writes an audit log entry

## Supported resource types

| Resource type string        | GCP API used                    |
|-----------------------------|----------------------------------|
| `compute.*/Instance`        | Compute Engine v1 — delete instance |
| `storage.*/Bucket`          | Storage JSON API — delete bucket + objects |
| `container.*/Cluster` / GKE | GKE v1 — delete cluster         |
| `cloudfunctions.*/Function` | Cloud Functions v1 — delete function |
| `pubsub.*/Topic`            | Pub/Sub v1 — delete topic        |
| `bigquery.*/Dataset`        | BigQuery v2 — delete dataset     |
| `run.*/Service`             | Cloud Run v2 — delete service    |

## Setup steps

### 1. Create a GCP service account

```bash
# Create the service account
gcloud iam service-accounts create devops-hub-governance \
  --display-name="DevOps Hub Resource Governance" \
  --project=YOUR_PROJECT_ID

# Grant delete permissions per resource type needed
# Example for Compute:
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:devops-hub-governance@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/compute.instanceAdmin.v1"

# Example for Storage:
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:devops-hub-governance@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

# Minimum safe role for all resource types:
# roles/compute.instanceAdmin.v1   → VMs
# roles/storage.admin              → Buckets
# roles/container.admin            → GKE
# roles/cloudfunctions.admin       → Cloud Functions
# roles/pubsub.admin               → Pub/Sub
# roles/bigquery.dataOwner         → BigQuery
# roles/run.admin                  → Cloud Run
```

### 2. Download the service account JSON key

```bash
gcloud iam service-accounts keys create sa-key.json \
  --iam-account=devops-hub-governance@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

### 3. Add the key to Supabase Edge Function secrets

Go to: **Supabase Dashboard → Edge Functions → Secrets**

Add a new secret:
- **Name:** `GCP_SERVICE_ACCOUNT_JSON`
- **Value:** paste the entire contents of `sa-key.json`

Then **delete `sa-key.json`** from your machine — never commit it to git.

### 4. Deploy the Edge Function

```bash
supabase functions deploy gcp-delete-resource --project-ref YOUR_SUPABASE_REF
```

### 5. Apply the DB migrations

```bash
supabase db push --project-ref YOUR_SUPABASE_REF
```

This adds `validity_status`, `extended_due_date`, extension fields to `jira_resource_tickets`
and creates the `resource_actions` audit log table.

## Security notes

- The service account key never touches the frontend — it lives only in Supabase secrets
- Every deletion is logged in `resource_actions` with actor email + reason
- The Edge Function uses `SUPABASE_SERVICE_ROLE_KEY` (auto-available) to write back to DB
- Principle of least privilege: grant only the specific delete roles needed, not `roles/owner`

## Testing

You can test the Edge Function locally:

```bash
supabase functions serve gcp-delete-resource --env-file .env.local

curl -X POST http://localhost:54321/functions/v1/gcp-delete-resource \
  -H "Content-Type: application/json" \
  -d '{
    "ticket_id": "your-ticket-uuid",
    "resource_type": "storage.googleapis.com/Bucket",
    "resource_name": "my-test-bucket",
    "gcp_project_id": "your-project-id",
    "gcp_region": "us-central1",
    "actor_email": "you@evonence.com",
    "reason": "Testing deletion flow"
  }'
```
