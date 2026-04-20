/**
 * gcp-delete-resource
 *
 * Deletes a GCP resource using the appropriate GCP REST API.
 * Called from the Resource Governance page when a user confirms deletion.
 *
 * Supported resource types:
 *   compute.googleapis.com/Instance         → Compute Engine VM
 *   storage.googleapis.com/Bucket           → Cloud Storage bucket
 *   container.googleapis.com/Cluster        → GKE cluster
 *   cloudfunctions.googleapis.com/Function  → Cloud Function (v1)
 *   pubsub.googleapis.com/Topic             → Pub/Sub topic
 *   bigquery.googleapis.com/Dataset         → BigQuery dataset
 *
 * Required secrets (set in Supabase dashboard → Edge Functions → Secrets):
 *   GCP_SERVICE_ACCOUNT_JSON  - full JSON key of a service account with
 *                               delete permissions on the target resources
 *   SUPABASE_SERVICE_ROLE_KEY - to write back to DB (auto-available in Edge Fn)
 *
 * Request body:
 *   {
 *     ticket_id:     string   // jira_resource_tickets.id
 *     resource_type: string   // e.g. "compute.googleapis.com/Instance"
 *     resource_name: string   // full resource name or short name
 *     gcp_project_id: string  // GCP project ID
 *     gcp_region:    string   // region or zone (e.g. "us-central1" or "us-central1-a")
 *     actor_email:   string   // who triggered the deletion
 *     reason:        string   // reason for deletion
 *   }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── JWT helpers for GCP service account auth ─────────────────
async function getGcpAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson);

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  // Encode header + payload
  const header = { alg: "RS256", typ: "JWT" };
  const encodedHeader = btoa(JSON.stringify(header))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  const encodedPayload = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  // Import private key
  const pemKey = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const binaryKey = Uint8Array.from(atob(pemKey), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  const jwt = `${signingInput}.${encodedSignature}`;

  // Exchange JWT for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Failed to get GCP access token: ${err}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token as string;
}

// ── Resource-specific delete logic ────────────────────────────
interface DeleteParams {
  resourceType: string;
  resourceName: string;
  projectId: string;
  region: string;
  accessToken: string;
}

async function deleteGcpResource(params: DeleteParams): Promise<{ operation?: string; message: string }> {
  const { resourceType, resourceName, projectId, region, accessToken } = params;
  const auth = `Bearer ${accessToken}`;

  // Normalise resource name (strip full path if passed, just get the short name)
  const shortName = resourceName.split("/").pop() ?? resourceName;

  // ── Compute Engine Instance ──────────────────────────────
  if (/compute.*instance/i.test(resourceType)) {
    // region here is actually a zone e.g. us-central1-a
    const zone = region.includes("-") && region.split("-").length >= 3 ? region : `${region}-a`;
    const url = `https://compute.googleapis.com/compute/v1/projects/${projectId}/zones/${zone}/instances/${shortName}`;
    const res = await fetch(url, { method: "DELETE", headers: { Authorization: auth } });
    if (!res.ok) throw new Error(`Compute delete failed: ${await res.text()}`);
    const data = await res.json();
    return { operation: data.name, message: `Compute instance ${shortName} deletion started` };
  }

  // ── Cloud Storage Bucket ─────────────────────────────────
  if (/storage.*bucket/i.test(resourceType)) {
    // Must delete all objects first, then the bucket
    // List objects
    const listUrl = `https://storage.googleapis.com/storage/v1/b/${shortName}/o?maxResults=100`;
    const listRes = await fetch(listUrl, { headers: { Authorization: auth } });
    if (listRes.ok) {
      const listData = await listRes.json();
      const objects: { name: string }[] = listData.items ?? [];
      // Delete each object
      await Promise.all(objects.map(obj =>
        fetch(`https://storage.googleapis.com/storage/v1/b/${shortName}/o/${encodeURIComponent(obj.name)}`,
          { method: "DELETE", headers: { Authorization: auth } })
      ));
    }
    // Delete the bucket
    const url = `https://storage.googleapis.com/storage/v1/b/${shortName}`;
    const res = await fetch(url, { method: "DELETE", headers: { Authorization: auth } });
    if (!res.ok && res.status !== 404) throw new Error(`Storage delete failed: ${await res.text()}`);
    return { message: `Cloud Storage bucket ${shortName} deleted` };
  }

  // ── GKE Cluster ──────────────────────────────────────────
  if (/container.*cluster|gke/i.test(resourceType)) {
    const url = `https://container.googleapis.com/v1/projects/${projectId}/locations/${region}/clusters/${shortName}`;
    const res = await fetch(url, { method: "DELETE", headers: { Authorization: auth } });
    if (!res.ok) throw new Error(`GKE delete failed: ${await res.text()}`);
    const data = await res.json();
    return { operation: data.name, message: `GKE cluster ${shortName} deletion started` };
  }

  // ── Cloud Function (v1) ───────────────────────────────────
  if (/function/i.test(resourceType)) {
    const url = `https://cloudfunctions.googleapis.com/v1/projects/${projectId}/locations/${region}/functions/${shortName}`;
    const res = await fetch(url, { method: "DELETE", headers: { Authorization: auth } });
    if (!res.ok) throw new Error(`Cloud Function delete failed: ${await res.text()}`);
    const data = await res.json();
    return { operation: data.name, message: `Cloud Function ${shortName} deletion started` };
  }

  // ── Pub/Sub Topic ────────────────────────────────────────
  if (/pubsub.*topic/i.test(resourceType)) {
    const topicName = resourceName.startsWith("projects/")
      ? resourceName
      : `projects/${projectId}/topics/${shortName}`;
    const url = `https://pubsub.googleapis.com/v1/${topicName}`;
    const res = await fetch(url, { method: "DELETE", headers: { Authorization: auth } });
    if (!res.ok && res.status !== 404) throw new Error(`Pub/Sub topic delete failed: ${await res.text()}`);
    return { message: `Pub/Sub topic ${shortName} deleted` };
  }

  // ── BigQuery Dataset ─────────────────────────────────────
  if (/bigquery.*dataset/i.test(resourceType)) {
    const url = `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/datasets/${shortName}?deleteContents=true`;
    const res = await fetch(url, { method: "DELETE", headers: { Authorization: auth } });
    if (!res.ok && res.status !== 404) throw new Error(`BigQuery dataset delete failed: ${await res.text()}`);
    return { message: `BigQuery dataset ${shortName} deleted` };
  }

  // ── Cloud Run Service ────────────────────────────────────
  if (/run.*service|cloudrun/i.test(resourceType)) {
    const url = `https://run.googleapis.com/v2/projects/${projectId}/locations/${region}/services/${shortName}`;
    const res = await fetch(url, { method: "DELETE", headers: { Authorization: auth } });
    if (!res.ok) throw new Error(`Cloud Run delete failed: ${await res.text()}`);
    const data = await res.json();
    return { operation: data.name, message: `Cloud Run service ${shortName} deletion started` };
  }

  throw new Error(`Unsupported resource type: ${resourceType}. Supported: Compute Instance, Storage Bucket, GKE Cluster, Cloud Function, Pub/Sub Topic, BigQuery Dataset, Cloud Run Service.`);
}

// ── Main handler ──────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const serviceAccountJson = Deno.env.get("GCP_SERVICE_ACCOUNT_JSON");
    if (!serviceAccountJson) {
      return new Response(
        JSON.stringify({ error: "GCP_SERVICE_ACCOUNT_JSON secret not configured. Add it in Supabase Edge Function secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json() as {
      ticket_id: string;
      resource_type: string;
      resource_name: string;
      gcp_project_id: string;
      gcp_region: string;
      actor_email?: string;
      reason?: string;
    };

    const { ticket_id, resource_type, resource_name, gcp_project_id, gcp_region, actor_email, reason } = body;

    if (!ticket_id || !resource_type || !resource_name || !gcp_project_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: ticket_id, resource_type, resource_name, gcp_project_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Get GCP access token
    const accessToken = await getGcpAccessToken(serviceAccountJson);

    // Delete the resource
    const result = await deleteGcpResource({
      resourceType: resource_type,
      resourceName: resource_name,
      projectId: gcp_project_id,
      region: gcp_region ?? "us-central1",
      accessToken,
    });

    // Update ticket status in Supabase
    const now = new Date().toISOString();
    await supabase
      .from("jira_resource_tickets")
      .update({
        validity_status: "deleted",
        deleted_by: actor_email ?? "system",
        deleted_at: now,
      })
      .eq("id", ticket_id);

    // Write audit log entry
    await supabase.from("resource_actions").insert({
      ticket_id,
      action: "deleted",
      actor_email: actor_email ?? null,
      reason: reason ?? null,
      metadata: { gcp_operation: result.operation ?? null, message: result.message },
    });

    return new Response(
      JSON.stringify({ success: true, message: result.message, operation: result.operation }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("gcp-delete-resource error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
