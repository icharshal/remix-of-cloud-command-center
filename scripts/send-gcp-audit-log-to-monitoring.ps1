param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [Parameter(Mandatory = $true)]
  [string]$Filter,

  [Parameter(Mandatory = $true)]
  [string]$MonitoringIngestUrl,

  [Parameter(Mandatory = $true)]
  [string]$SupabaseAnonKey,

  [string]$AgentId = "gcp-audit-bridge",
  [string]$AgentName = "gcp-audit-bridge",
  [int]$Limit = 5
)

$gcloudPath = "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"

if (-not (Test-Path $gcloudPath)) {
  throw "gcloud.cmd was not found at $gcloudPath"
}

$rawLogs = & $gcloudPath logging read $Filter --project=$ProjectId --limit=$Limit --format=json
$entries = $rawLogs | ConvertFrom-Json

if (-not $entries) {
  Write-Output "No matching audit logs found."
  exit 0
}

$logs = @()

foreach ($entry in $entries) {
  $labels = @{
    "serviceName" = $entry.protoPayload.serviceName
    "methodName" = $entry.protoPayload.methodName
    "principalEmail" = $entry.protoPayload.authenticationInfo.principalEmail
    "resourceName" = $entry.protoPayload.resourceName
    "resource.type" = $entry.resource.type
  }

  if ($entry.resource.labels.bucket_name) {
    $labels["resource.labels.bucket_name"] = $entry.resource.labels.bucket_name
  }

  if ($entry.resource.labels.project_id) {
    $labels["resource.labels.project_id"] = $entry.resource.labels.project_id
  }

  $logs += @{
    log_level = "INFO"
    message = ($entry | ConvertTo-Json -Depth 20 -Compress)
    source = $entry.logName
    labels = $labels
    timestamp = $entry.timestamp
  }
}

$payload = @{
  action = "ingest"
  agent_id = $AgentId
  agent_data = @{
    agent_id = $AgentId
    agent_name = $AgentName
    agent_type = "container"
    metadata = @{
      source = "gcp-audit-bridge"
      project_id = $ProjectId
    }
  }
  logs = $logs
} | ConvertTo-Json -Depth 20

Invoke-RestMethod `
  -Method Post `
  -Uri $MonitoringIngestUrl `
  -Headers @{
    "Content-Type" = "application/json"
    "apikey" = $SupabaseAnonKey
    "Authorization" = "Bearer $SupabaseAnonKey"
  } `
  -Body $payload
