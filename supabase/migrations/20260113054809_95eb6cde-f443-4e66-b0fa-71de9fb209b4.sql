-- Create table for registered monitoring agents
CREATE TABLE public.monitoring_agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL UNIQUE,
  agent_name TEXT NOT NULL,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('pod', 'vm', 'container')),
  cluster_name TEXT,
  namespace TEXT,
  node_name TEXT,
  ip_address TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
  last_heartbeat TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for logs collected by agents
CREATE TABLE public.collected_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL,
  pod_name TEXT,
  container_name TEXT,
  namespace TEXT,
  log_level TEXT CHECK (log_level IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL')),
  message TEXT NOT NULL,
  source TEXT,
  labels JSONB DEFAULT '{}',
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for metrics collected by agents
CREATE TABLE public.collected_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('cpu', 'memory', 'disk', 'network', 'pods', 'custom')),
  metric_name TEXT NOT NULL,
  value NUMERIC NOT NULL,
  unit TEXT,
  pod_name TEXT,
  container_name TEXT,
  namespace TEXT,
  node_name TEXT,
  labels JSONB DEFAULT '{}',
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for events collected by agents
CREATE TABLE public.collected_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('Normal', 'Warning', 'Error')),
  reason TEXT NOT NULL,
  message TEXT NOT NULL,
  involved_object TEXT,
  namespace TEXT,
  source_component TEXT,
  first_timestamp TIMESTAMP WITH TIME ZONE,
  last_timestamp TIMESTAMP WITH TIME ZONE,
  count INTEGER DEFAULT 1,
  labels JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_collected_logs_agent ON public.collected_logs(agent_id);
CREATE INDEX idx_collected_logs_timestamp ON public.collected_logs(timestamp DESC);
CREATE INDEX idx_collected_logs_level ON public.collected_logs(log_level);
CREATE INDEX idx_collected_metrics_agent ON public.collected_metrics(agent_id);
CREATE INDEX idx_collected_metrics_timestamp ON public.collected_metrics(timestamp DESC);
CREATE INDEX idx_collected_metrics_type ON public.collected_metrics(metric_type);
CREATE INDEX idx_collected_events_agent ON public.collected_events(agent_id);
CREATE INDEX idx_collected_events_timestamp ON public.collected_events(created_at DESC);
CREATE INDEX idx_monitoring_agents_status ON public.monitoring_agents(status);

-- Enable RLS
ALTER TABLE public.monitoring_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collected_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collected_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collected_events ENABLE ROW LEVEL SECURITY;

-- Public read policies (dashboard can read all data)
CREATE POLICY "Allow public read for monitoring agents"
ON public.monitoring_agents FOR SELECT USING (true);

CREATE POLICY "Allow public read for collected logs"
ON public.collected_logs FOR SELECT USING (true);

CREATE POLICY "Allow public read for collected metrics"
ON public.collected_metrics FOR SELECT USING (true);

CREATE POLICY "Allow public read for collected events"
ON public.collected_events FOR SELECT USING (true);

-- Public insert policies (agents can insert data)
CREATE POLICY "Allow public insert for monitoring agents"
ON public.monitoring_agents FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public insert for collected logs"
ON public.collected_logs FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public insert for collected metrics"
ON public.collected_metrics FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public insert for collected events"
ON public.collected_events FOR INSERT WITH CHECK (true);

-- Public update for agents (heartbeat updates)
CREATE POLICY "Allow public update for monitoring agents"
ON public.monitoring_agents FOR UPDATE USING (true);

-- Enable realtime for live dashboard updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.collected_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.collected_metrics;
ALTER PUBLICATION supabase_realtime ADD TABLE public.collected_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.monitoring_agents;

-- Create function to update timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for agents table
CREATE TRIGGER update_monitoring_agents_updated_at
BEFORE UPDATE ON public.monitoring_agents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
