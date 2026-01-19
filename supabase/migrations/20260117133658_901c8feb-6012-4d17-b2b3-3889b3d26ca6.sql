-- Create alert rules table
CREATE TABLE public.alert_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  metric_name TEXT NOT NULL,
  condition TEXT NOT NULL CHECK (condition IN ('greater_than', 'less_than', 'equals')),
  threshold NUMERIC NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  cooldown_minutes INTEGER NOT NULL DEFAULT 5,
  labels JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create triggered alerts table
CREATE TABLE public.triggered_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id UUID REFERENCES public.alert_rules(id) ON DELETE CASCADE,
  metric_value NUMERIC NOT NULL,
  threshold NUMERIC NOT NULL,
  agent_id TEXT,
  pod_name TEXT,
  node_name TEXT,
  namespace TEXT,
  message TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
  triggered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.triggered_alerts ENABLE ROW LEVEL SECURITY;

-- Create policies for alert rules
CREATE POLICY "Allow public read for alert rules"
ON public.alert_rules FOR SELECT USING (true);

CREATE POLICY "Allow public insert for alert rules"
ON public.alert_rules FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update for alert rules"
ON public.alert_rules FOR UPDATE USING (true);

CREATE POLICY "Allow public delete for alert rules"
ON public.alert_rules FOR DELETE USING (true);

-- Create policies for triggered alerts
CREATE POLICY "Allow public read for triggered alerts"
ON public.triggered_alerts FOR SELECT USING (true);

CREATE POLICY "Allow public insert for triggered alerts"
ON public.triggered_alerts FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update for triggered alerts"
ON public.triggered_alerts FOR UPDATE USING (true);

-- Create indexes for performance
CREATE INDEX idx_alert_rules_metric_name ON public.alert_rules(metric_name);
CREATE INDEX idx_alert_rules_enabled ON public.alert_rules(enabled);
CREATE INDEX idx_triggered_alerts_status ON public.triggered_alerts(status);
CREATE INDEX idx_triggered_alerts_triggered_at ON public.triggered_alerts(triggered_at DESC);
CREATE INDEX idx_triggered_alerts_rule_id ON public.triggered_alerts(rule_id);

-- Create trigger for updated_at
CREATE TRIGGER update_alert_rules_updated_at
BEFORE UPDATE ON public.alert_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.alert_rules;
ALTER PUBLICATION supabase_realtime ADD TABLE public.triggered_alerts;