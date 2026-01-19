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
        const results = { logs: 0, metrics: 0, events: 0, errors: [] as string[] };

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

          const { error } = await supabase
            .from('collected_logs')
            .insert(logsToInsert);

          if (error) {
            console.error('[monitoring-ingest] Logs insert error:', error);
            results.errors.push(`logs: ${error.message}`);
          } else {
            results.logs = logsToInsert.length;
            console.log(`[monitoring-ingest] Inserted ${results.logs} logs`);
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
            ingested: { logs: results.logs, metrics: results.metrics, events: results.events },
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
