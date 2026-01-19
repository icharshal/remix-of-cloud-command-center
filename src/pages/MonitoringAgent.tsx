import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Download, Copy, CheckCircle2, Terminal, Server, 
  Activity, RefreshCw, AlertCircle, Clock
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface MonitoringAgent {
  id: string;
  agent_id: string;
  agent_name: string;
  agent_type: string;
  cluster_name: string | null;
  namespace: string | null;
  node_name: string | null;
  ip_address: string | null;
  status: string;
  last_heartbeat: string | null;
  created_at: string;
}

const SUPABASE_URL = "https://frfjddiiqaunvhwjbuzz.supabase.co";

const generateBashScript = (agentName: string) => `#!/bin/bash
#
# DevOps Monitoring Agent
# Collects logs, metrics, and events from Kubernetes/VM and sends to dashboard
#

set -e

# Configuration
AGENT_NAME="${agentName || 'monitoring-agent'}"
AGENT_ID="\${AGENT_NAME}-\$(hostname)-\$\$"
AGENT_TYPE="pod"  # Change to 'vm' for VM deployments
SUPABASE_URL="${SUPABASE_URL}"
INGEST_ENDPOINT="\${SUPABASE_URL}/functions/v1/monitoring-ingest"
COLLECT_INTERVAL=30  # seconds

# Detect environment
if [ -f /var/run/secrets/kubernetes.io/serviceaccount/namespace ]; then
    NAMESPACE=\$(cat /var/run/secrets/kubernetes.io/serviceaccount/namespace)
    CLUSTER_NAME=\${KUBERNETES_CLUSTER_NAME:-"unknown"}
    NODE_NAME=\${NODE_NAME:-\$(hostname)}
    AGENT_TYPE="pod"
else
    NAMESPACE="default"
    CLUSTER_NAME="standalone"
    NODE_NAME=\$(hostname)
    AGENT_TYPE="vm"
fi

# Get IP address
IP_ADDRESS=\$(hostname -I 2>/dev/null | awk '{print \$1}' || echo "unknown")

echo "[Agent] Starting monitoring agent: \$AGENT_ID"
echo "[Agent] Type: \$AGENT_TYPE, Namespace: \$NAMESPACE, Node: \$NODE_NAME"

# Register agent
register_agent() {
    echo "[Agent] Registering with dashboard..."
    curl -s -X POST "\$INGEST_ENDPOINT" \\
        -H "Content-Type: application/json" \\
        -d '{
            "action": "register",
            "agent_id": "'\$AGENT_ID'",
            "agent_data": {
                "agent_id": "'\$AGENT_ID'",
                "agent_name": "'\$AGENT_NAME'",
                "agent_type": "'\$AGENT_TYPE'",
                "cluster_name": "'\$CLUSTER_NAME'",
                "namespace": "'\$NAMESPACE'",
                "node_name": "'\$NODE_NAME'",
                "ip_address": "'\$IP_ADDRESS'",
                "metadata": {"version": "1.0.0"}
            }
        }' || echo "[Agent] Registration failed, will retry..."
}

# Collect and send metrics
collect_metrics() {
    # CPU usage
    CPU_USAGE=\$(top -bn1 | grep "Cpu(s)" | awk '{print \$2}' | cut -d'%' -f1 2>/dev/null || echo "0")
    
    # Memory usage
    MEM_INFO=\$(free | grep Mem)
    MEM_TOTAL=\$(echo \$MEM_INFO | awk '{print \$2}')
    MEM_USED=\$(echo \$MEM_INFO | awk '{print \$3}')
    MEM_PERCENT=\$(echo "scale=2; \$MEM_USED * 100 / \$MEM_TOTAL" | bc 2>/dev/null || echo "0")
    
    # Disk usage
    DISK_USAGE=\$(df -h / | tail -1 | awk '{print \$5}' | tr -d '%' 2>/dev/null || echo "0")
    
    # Pod count (if kubectl available)
    POD_COUNT=0
    if command -v kubectl &> /dev/null; then
        POD_COUNT=\$(kubectl get pods --all-namespaces --no-headers 2>/dev/null | wc -l || echo "0")
    fi

    curl -s -X POST "\$INGEST_ENDPOINT" \\
        -H "Content-Type: application/json" \\
        -d '{
            "action": "ingest",
            "agent_id": "'\$AGENT_ID'",
            "metrics": [
                {"metric_type": "cpu", "metric_name": "cpu_usage_percent", "value": '\$CPU_USAGE', "unit": "percent", "node_name": "'\$NODE_NAME'"},
                {"metric_type": "memory", "metric_name": "memory_usage_percent", "value": '\$MEM_PERCENT', "unit": "percent", "node_name": "'\$NODE_NAME'"},
                {"metric_type": "disk", "metric_name": "disk_usage_percent", "value": '\$DISK_USAGE', "unit": "percent", "node_name": "'\$NODE_NAME'"},
                {"metric_type": "pods", "metric_name": "pod_count", "value": '\$POD_COUNT', "unit": "count", "node_name": "'\$NODE_NAME'"}
            ]
        }' > /dev/null 2>&1
}

# Collect container logs (for Kubernetes)
collect_logs() {
    if ! command -v kubectl &> /dev/null; then
        # For VMs, collect syslog
        LOGS=\$(tail -n 10 /var/log/syslog 2>/dev/null || tail -n 10 /var/log/messages 2>/dev/null || echo "")
        if [ -n "\$LOGS" ]; then
            while IFS= read -r line; do
                LEVEL="INFO"
                [[ "\$line" == *"error"* ]] && LEVEL="ERROR"
                [[ "\$line" == *"warn"* ]] && LEVEL="WARN"
                
                # Escape JSON special characters
                ESCAPED_LINE=\$(echo "\$line" | sed 's/\\\\/\\\\\\\\/g; s/"/\\\\"/g; s/\\t/\\\\t/g')
                
                curl -s -X POST "\$INGEST_ENDPOINT" \\
                    -H "Content-Type: application/json" \\
                    -d '{
                        "action": "ingest",
                        "agent_id": "'\$AGENT_ID'",
                        "logs": [{"log_level": "'\$LEVEL'", "message": "'\$ESCAPED_LINE'", "source": "syslog", "namespace": "'\$NAMESPACE'"}]
                    }' > /dev/null 2>&1
            done <<< "\$LOGS"
        fi
        return
    fi
    
    # For Kubernetes, collect pod logs
    PODS=\$(kubectl get pods -n \$NAMESPACE --no-headers -o custom-columns=":metadata.name" 2>/dev/null | head -5)
    for POD in \$PODS; do
        LOGS=\$(kubectl logs \$POD -n \$NAMESPACE --tail=5 2>/dev/null || echo "")
        if [ -n "\$LOGS" ]; then
            while IFS= read -r line; do
                [ -z "\$line" ] && continue
                LEVEL="INFO"
                [[ "\$line" == *"ERROR"* ]] && LEVEL="ERROR"
                [[ "\$line" == *"WARN"* ]] && LEVEL="WARN"
                [[ "\$line" == *"DEBUG"* ]] && LEVEL="DEBUG"
                
                ESCAPED_LINE=\$(echo "\$line" | sed 's/\\\\/\\\\\\\\/g; s/"/\\\\"/g; s/\\t/\\\\t/g' | head -c 500)
                
                curl -s -X POST "\$INGEST_ENDPOINT" \\
                    -H "Content-Type: application/json" \\
                    -d '{
                        "action": "ingest",
                        "agent_id": "'\$AGENT_ID'",
                        "logs": [{"log_level": "'\$LEVEL'", "message": "'\$ESCAPED_LINE'", "pod_name": "'\$POD'", "namespace": "'\$NAMESPACE'"}]
                    }' > /dev/null 2>&1
            done <<< "\$LOGS"
        fi
    done
}

# Collect Kubernetes events
collect_events() {
    if ! command -v kubectl &> /dev/null; then
        return
    fi
    
    EVENTS=\$(kubectl get events -n \$NAMESPACE --sort-by='.lastTimestamp' -o json 2>/dev/null | jq -c '.items[-5:][]' 2>/dev/null || echo "")
    
    echo "\$EVENTS" | while read -r event; do
        [ -z "\$event" ] && continue
        
        TYPE=\$(echo "\$event" | jq -r '.type // "Normal"')
        REASON=\$(echo "\$event" | jq -r '.reason // "Unknown"')
        MESSAGE=\$(echo "\$event" | jq -r '.message // ""' | head -c 200)
        OBJECT=\$(echo "\$event" | jq -r '.involvedObject.name // ""')
        
        curl -s -X POST "\$INGEST_ENDPOINT" \\
            -H "Content-Type: application/json" \\
            -d '{
                "action": "ingest",
                "agent_id": "'\$AGENT_ID'",
                "events": [{"event_type": "'\$TYPE'", "reason": "'\$REASON'", "message": "'\$MESSAGE'", "involved_object": "'\$OBJECT'", "namespace": "'\$NAMESPACE'"}]
            }' > /dev/null 2>&1
    done
}

# Send heartbeat
send_heartbeat() {
    curl -s -X POST "\$INGEST_ENDPOINT" \\
        -H "Content-Type: application/json" \\
        -d '{"action": "heartbeat", "agent_id": "'\$AGENT_ID'"}' > /dev/null 2>&1
}

# Main loop
register_agent
sleep 2

echo "[Agent] Starting collection loop (interval: \${COLLECT_INTERVAL}s)..."

while true; do
    echo "[Agent] Collecting data at \$(date)"
    collect_metrics
    collect_logs
    collect_events
    send_heartbeat
    echo "[Agent] Collection complete, sleeping..."
    sleep \$COLLECT_INTERVAL
done
`;

const generatePythonScript = (agentName: string) => `#!/usr/bin/env python3
"""
DevOps Monitoring Agent
Collects logs, metrics, and events from Kubernetes/VM and sends to dashboard
"""

import os
import sys
import time
import json
import socket
import requests
import subprocess
from datetime import datetime
from typing import Dict, List, Any, Optional

# Configuration
AGENT_NAME = "${agentName || 'monitoring-agent'}"
AGENT_ID = f"{AGENT_NAME}-{socket.gethostname()}-{os.getpid()}"
SUPABASE_URL = "${SUPABASE_URL}"
INGEST_ENDPOINT = f"{SUPABASE_URL}/functions/v1/monitoring-ingest"
COLLECT_INTERVAL = 30  # seconds


class MonitoringAgent:
    def __init__(self):
        self.agent_id = AGENT_ID
        self.agent_name = AGENT_NAME
        self.agent_type = self._detect_environment()
        self.namespace = self._get_namespace()
        self.cluster_name = os.environ.get("KUBERNETES_CLUSTER_NAME", "unknown")
        self.node_name = socket.gethostname()
        self.ip_address = self._get_ip_address()
        
    def _detect_environment(self) -> str:
        if os.path.exists("/var/run/secrets/kubernetes.io/serviceaccount/namespace"):
            return "pod"
        return "vm"
    
    def _get_namespace(self) -> str:
        try:
            with open("/var/run/secrets/kubernetes.io/serviceaccount/namespace") as f:
                return f.read().strip()
        except:
            return "default"
    
    def _get_ip_address(self) -> str:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except:
            return "unknown"
    
    def _send_request(self, payload: Dict[str, Any]) -> Optional[Dict]:
        try:
            response = requests.post(
                INGEST_ENDPOINT,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            return response.json()
        except Exception as e:
            print(f"[Agent] Request failed: {e}")
            return None
    
    def register(self):
        print(f"[Agent] Registering agent: {self.agent_id}")
        payload = {
            "action": "register",
            "agent_id": self.agent_id,
            "agent_data": {
                "agent_id": self.agent_id,
                "agent_name": self.agent_name,
                "agent_type": self.agent_type,
                "cluster_name": self.cluster_name,
                "namespace": self.namespace,
                "node_name": self.node_name,
                "ip_address": self.ip_address,
                "metadata": {"version": "1.0.0", "python_version": sys.version}
            }
        }
        result = self._send_request(payload)
        if result:
            print(f"[Agent] Registration successful")
        else:
            print(f"[Agent] Registration failed, will retry...")
    
    def collect_metrics(self) -> List[Dict]:
        metrics = []
        
        # CPU usage
        try:
            with open("/proc/stat") as f:
                cpu_line = f.readline()
                values = cpu_line.split()[1:8]
                total = sum(map(int, values))
                idle = int(values[3])
                cpu_usage = round((1 - idle / total) * 100, 2)
                metrics.append({
                    "metric_type": "cpu",
                    "metric_name": "cpu_usage_percent",
                    "value": cpu_usage,
                    "unit": "percent",
                    "node_name": self.node_name
                })
        except:
            pass
        
        # Memory usage
        try:
            with open("/proc/meminfo") as f:
                mem_info = {}
                for line in f:
                    parts = line.split(":")
                    if len(parts) == 2:
                        key = parts[0].strip()
                        value = int(parts[1].strip().split()[0])
                        mem_info[key] = value
                
                total = mem_info.get("MemTotal", 1)
                available = mem_info.get("MemAvailable", mem_info.get("MemFree", 0))
                used_percent = round((1 - available / total) * 100, 2)
                
                metrics.append({
                    "metric_type": "memory",
                    "metric_name": "memory_usage_percent",
                    "value": used_percent,
                    "unit": "percent",
                    "node_name": self.node_name
                })
        except:
            pass
        
        # Disk usage
        try:
            result = subprocess.run(["df", "-h", "/"], capture_output=True, text=True)
            lines = result.stdout.strip().split("\\n")
            if len(lines) > 1:
                usage = lines[1].split()[4].replace("%", "")
                metrics.append({
                    "metric_type": "disk",
                    "metric_name": "disk_usage_percent",
                    "value": float(usage),
                    "unit": "percent",
                    "node_name": self.node_name
                })
        except:
            pass
        
        # Pod count (if kubectl available)
        try:
            result = subprocess.run(
                ["kubectl", "get", "pods", "--all-namespaces", "--no-headers"],
                capture_output=True, text=True, timeout=5
            )
            pod_count = len(result.stdout.strip().split("\\n")) if result.stdout.strip() else 0
            metrics.append({
                "metric_type": "pods",
                "metric_name": "pod_count",
                "value": pod_count,
                "unit": "count",
                "node_name": self.node_name
            })
        except:
            pass
        
        return metrics
    
    def collect_logs(self) -> List[Dict]:
        logs = []
        
        # For VMs, collect syslog
        log_files = ["/var/log/syslog", "/var/log/messages", "/var/log/auth.log"]
        
        for log_file in log_files:
            try:
                result = subprocess.run(
                    ["tail", "-n", "5", log_file],
                    capture_output=True, text=True, timeout=5
                )
                for line in result.stdout.strip().split("\\n"):
                    if not line:
                        continue
                    
                    level = "INFO"
                    if "error" in line.lower():
                        level = "ERROR"
                    elif "warn" in line.lower():
                        level = "WARN"
                    elif "debug" in line.lower():
                        level = "DEBUG"
                    
                    logs.append({
                        "log_level": level,
                        "message": line[:500],
                        "source": log_file,
                        "namespace": self.namespace
                    })
            except:
                pass
        
        # For Kubernetes, collect pod logs
        try:
            result = subprocess.run(
                ["kubectl", "get", "pods", "-n", self.namespace, "--no-headers", "-o", "custom-columns=:metadata.name"],
                capture_output=True, text=True, timeout=5
            )
            pods = result.stdout.strip().split("\\n")[:5]
            
            for pod in pods:
                if not pod:
                    continue
                try:
                    log_result = subprocess.run(
                        ["kubectl", "logs", pod, "-n", self.namespace, "--tail=3"],
                        capture_output=True, text=True, timeout=5
                    )
                    for line in log_result.stdout.strip().split("\\n"):
                        if not line:
                            continue
                        
                        level = "INFO"
                        if "ERROR" in line:
                            level = "ERROR"
                        elif "WARN" in line:
                            level = "WARN"
                        elif "DEBUG" in line:
                            level = "DEBUG"
                        
                        logs.append({
                            "log_level": level,
                            "message": line[:500],
                            "pod_name": pod,
                            "namespace": self.namespace
                        })
                except:
                    pass
        except:
            pass
        
        return logs
    
    def collect_events(self) -> List[Dict]:
        events = []
        
        try:
            result = subprocess.run(
                ["kubectl", "get", "events", "-n", self.namespace, "-o", "json"],
                capture_output=True, text=True, timeout=10
            )
            data = json.loads(result.stdout)
            
            for item in data.get("items", [])[-5:]:
                events.append({
                    "event_type": item.get("type", "Normal"),
                    "reason": item.get("reason", "Unknown"),
                    "message": item.get("message", "")[:200],
                    "involved_object": item.get("involvedObject", {}).get("name", ""),
                    "namespace": self.namespace
                })
        except:
            pass
        
        return events
    
    def send_data(self, metrics: List[Dict], logs: List[Dict], events: List[Dict]):
        payload = {
            "action": "ingest",
            "agent_id": self.agent_id,
            "metrics": metrics,
            "logs": logs,
            "events": events
        }
        result = self._send_request(payload)
        if result:
            print(f"[Agent] Data sent - metrics: {len(metrics)}, logs: {len(logs)}, events: {len(events)}")
    
    def heartbeat(self):
        self._send_request({"action": "heartbeat", "agent_id": self.agent_id})
    
    def run(self):
        print(f"[Agent] Starting monitoring agent: {self.agent_id}")
        print(f"[Agent] Type: {self.agent_type}, Namespace: {self.namespace}, Node: {self.node_name}")
        
        self.register()
        time.sleep(2)
        
        print(f"[Agent] Starting collection loop (interval: {COLLECT_INTERVAL}s)...")
        
        while True:
            try:
                print(f"[Agent] Collecting data at {datetime.now().isoformat()}")
                
                metrics = self.collect_metrics()
                logs = self.collect_logs()
                events = self.collect_events()
                
                self.send_data(metrics, logs, events)
                self.heartbeat()
                
                print(f"[Agent] Collection complete, sleeping...")
            except Exception as e:
                print(f"[Agent] Error in collection loop: {e}")
            
            time.sleep(COLLECT_INTERVAL)


if __name__ == "__main__":
    agent = MonitoringAgent()
    agent.run()
`;

const generateK8sManifest = (agentName: string) => `apiVersion: v1
kind: ServiceAccount
metadata:
  name: ${agentName || 'monitoring-agent'}
  namespace: monitoring
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: ${agentName || 'monitoring-agent'}-role
rules:
  - apiGroups: [""]
    resources: ["pods", "nodes", "events", "namespaces"]
    verbs: ["get", "list", "watch"]
  - apiGroups: [""]
    resources: ["pods/log"]
    verbs: ["get"]
  - apiGroups: ["apps"]
    resources: ["deployments", "replicasets", "daemonsets", "statefulsets"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["autoscaling"]
    resources: ["horizontalpodautoscalers"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: ${agentName || 'monitoring-agent'}-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: ${agentName || 'monitoring-agent'}-role
subjects:
  - kind: ServiceAccount
    name: ${agentName || 'monitoring-agent'}
    namespace: monitoring
---
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: ${agentName || 'monitoring-agent'}
  namespace: monitoring
  labels:
    app: ${agentName || 'monitoring-agent'}
spec:
  selector:
    matchLabels:
      app: ${agentName || 'monitoring-agent'}
  template:
    metadata:
      labels:
        app: ${agentName || 'monitoring-agent'}
    spec:
      serviceAccountName: ${agentName || 'monitoring-agent'}
      containers:
        - name: agent
          image: python:3.11-slim
          command: ["/bin/bash", "-c"]
          args:
            - |
              pip install requests && python /scripts/agent.py
          env:
            - name: NODE_NAME
              valueFrom:
                fieldRef:
                  fieldPath: spec.nodeName
            - name: KUBERNETES_CLUSTER_NAME
              value: "production-cluster"
          volumeMounts:
            - name: agent-script
              mountPath: /scripts
          resources:
            requests:
              memory: "64Mi"
              cpu: "50m"
            limits:
              memory: "128Mi"
              cpu: "100m"
      volumes:
        - name: agent-script
          configMap:
            name: ${agentName || 'monitoring-agent'}-script
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: ${agentName || 'monitoring-agent'}-script
  namespace: monitoring
data:
  agent.py: |
    # Paste the Python agent script here
`;

export default function MonitoringAgent() {
  const [agentName, setAgentName] = useState("devops-agent");
  const [copied, setCopied] = useState<string | null>(null);
  const [agents, setAgents] = useState<MonitoringAgent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAgents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('monitoring_agents')
      .select('*')
      .order('last_heartbeat', { ascending: false });
    
    if (!error && data) {
      setAgents(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAgents();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('monitoring-agents-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'monitoring_agents' },
        () => fetchAgents()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    toast.success(`${type} copied to clipboard`);
    setTimeout(() => setCopied(null), 2000);
  };

  const downloadScript = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}`);
  };

  const getStatusBadge = (status: string, lastHeartbeat: string | null) => {
    if (!lastHeartbeat) {
      return <Badge variant="secondary">Unknown</Badge>;
    }
    
    const lastBeat = new Date(lastHeartbeat);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastBeat.getTime()) / (1000 * 60);
    
    if (diffMinutes < 2) {
      return <Badge variant="default" className="bg-success">Active</Badge>;
    } else if (diffMinutes < 10) {
      return <Badge variant="secondary" className="bg-warning text-warning-foreground">Stale</Badge>;
    } else {
      return <Badge variant="destructive">Inactive</Badge>;
    }
  };

  const formatLastHeartbeat = (lastHeartbeat: string | null) => {
    if (!lastHeartbeat) return "Never";
    const date = new Date(lastHeartbeat);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Monitoring Agent</h1>
        <p className="mt-2 text-muted-foreground">
          Deploy agents to collect logs, metrics, and events from your infrastructure
        </p>
      </div>

      {/* Agent Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Agent Configuration
          </CardTitle>
          <CardDescription>Configure and download monitoring agent scripts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <Label htmlFor="agentName">Agent Name</Label>
              <Input
                id="agentName"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="my-monitoring-agent"
              />
            </div>
          </div>

          <Tabs defaultValue="bash" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="bash">Bash Script</TabsTrigger>
              <TabsTrigger value="python">Python Script</TabsTrigger>
              <TabsTrigger value="k8s">Kubernetes YAML</TabsTrigger>
            </TabsList>

            <TabsContent value="bash" className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(generateBashScript(agentName), "Bash script")}
                >
                  {copied === "Bash script" ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  Copy Script
                </Button>
                <Button
                  onClick={() => downloadScript(generateBashScript(agentName), `${agentName}-agent.sh`)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              </div>
              <ScrollArea className="h-[300px] rounded-md border bg-muted/30 p-4">
                <pre className="text-xs font-mono whitespace-pre-wrap">
                  {generateBashScript(agentName)}
                </pre>
              </ScrollArea>
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Usage:</strong></p>
                <code className="block bg-muted p-2 rounded">chmod +x {agentName}-agent.sh && ./{agentName}-agent.sh</code>
              </div>
            </TabsContent>

            <TabsContent value="python" className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(generatePythonScript(agentName), "Python script")}
                >
                  {copied === "Python script" ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  Copy Script
                </Button>
                <Button
                  onClick={() => downloadScript(generatePythonScript(agentName), `${agentName}-agent.py`)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              </div>
              <ScrollArea className="h-[300px] rounded-md border bg-muted/30 p-4">
                <pre className="text-xs font-mono whitespace-pre-wrap">
                  {generatePythonScript(agentName)}
                </pre>
              </ScrollArea>
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Requirements:</strong> pip install requests</p>
                <code className="block bg-muted p-2 rounded">python3 {agentName}-agent.py</code>
              </div>
            </TabsContent>

            <TabsContent value="k8s" className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(generateK8sManifest(agentName), "Kubernetes manifest")}
                >
                  {copied === "Kubernetes manifest" ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  Copy Manifest
                </Button>
                <Button
                  onClick={() => downloadScript(generateK8sManifest(agentName), `${agentName}-k8s.yaml`)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              </div>
              <ScrollArea className="h-[300px] rounded-md border bg-muted/30 p-4">
                <pre className="text-xs font-mono whitespace-pre-wrap">
                  {generateK8sManifest(agentName)}
                </pre>
              </ScrollArea>
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Deploy:</strong></p>
                <code className="block bg-muted p-2 rounded">kubectl create namespace monitoring && kubectl apply -f {agentName}-k8s.yaml</code>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Registered Agents */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Registered Agents
              </CardTitle>
              <CardDescription>Agents currently sending data to the dashboard</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchAgents}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No agents registered yet</p>
              <p className="text-sm">Deploy an agent script to start collecting data</p>
            </div>
          ) : (
            <div className="space-y-4">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center justify-between border-b border-border pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-3">
                    {agent.status === 'active' ? (
                      <Activity className="h-5 w-5 text-success" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-warning" />
                    )}
                    <div>
                      <p className="font-medium text-foreground">{agent.agent_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {agent.agent_type} | {agent.cluster_name || 'N/A'} | {agent.namespace || 'N/A'} | {agent.node_name || 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right text-sm">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatLastHeartbeat(agent.last_heartbeat)}
                      </div>
                    </div>
                    {getStatusBadge(agent.status, agent.last_heartbeat)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
