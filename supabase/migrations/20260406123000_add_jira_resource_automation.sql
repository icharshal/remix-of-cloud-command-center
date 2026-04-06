-- Jira automation settings for auto-raising tickets from GCP resource creation logs
CREATE TABLE public.jira_automation_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  jira_base_url TEXT,
  jira_project_key TEXT,
  issue_type TEXT NOT NULL DEFAULT 'Task',
  due_days INTEGER NOT NULL DEFAULT 2,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT jira_automation_settings_due_days_positive CHECK (due_days > 0)
);

INSERT INTO public.jira_automation_settings (enabled, issue_type, due_days)
VALUES (false, 'Task', 2);

CREATE TABLE public.jira_resource_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_log_id UUID UNIQUE REFERENCES public.collected_logs(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'gcp',
  resource_type TEXT NOT NULL,
  resource_name TEXT NOT NULL,
  creator_name TEXT,
  creator_email TEXT,
  summary TEXT NOT NULL,
  due_date DATE NOT NULL,
  jira_project_key TEXT,
  issue_type TEXT,
  jira_issue_key TEXT,
  jira_issue_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'created', 'failed', 'skipped')),
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_jira_resource_tickets_status ON public.jira_resource_tickets(status);
CREATE INDEX idx_jira_resource_tickets_due_date ON public.jira_resource_tickets(due_date DESC);
CREATE INDEX idx_jira_resource_tickets_creator_email ON public.jira_resource_tickets(creator_email);

ALTER TABLE public.jira_automation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jira_resource_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read for jira automation settings"
ON public.jira_automation_settings FOR SELECT USING (true);

CREATE POLICY "Allow public insert for jira automation settings"
ON public.jira_automation_settings FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update for jira automation settings"
ON public.jira_automation_settings FOR UPDATE USING (true);

CREATE POLICY "Allow public read for jira resource tickets"
ON public.jira_resource_tickets FOR SELECT USING (true);

CREATE POLICY "Allow public insert for jira resource tickets"
ON public.jira_resource_tickets FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update for jira resource tickets"
ON public.jira_resource_tickets FOR UPDATE USING (true);

CREATE TRIGGER update_jira_automation_settings_updated_at
BEFORE UPDATE ON public.jira_automation_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_jira_resource_tickets_updated_at
BEFORE UPDATE ON public.jira_resource_tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.jira_automation_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.jira_resource_tickets;
