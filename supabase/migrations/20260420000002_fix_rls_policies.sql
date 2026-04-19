-- ============================================================
-- Fix RLS: Drop all USING (true) open policies
-- Replace with proper authenticated access control
--
-- Access model:
--   READ   → any authenticated user (viewer+)
--   INSERT → operator+ OR service_role (agents)
--   UPDATE → operator+
--   DELETE → admin only
--
-- Agents (monitoring scripts) use the service_role key inside
-- Edge Functions — they bypass RLS entirely, so insert policies
-- don't need to accommodate them explicitly.
-- ============================================================

-- -------------------------------------------------------
-- monitoring_agents
-- -------------------------------------------------------
DROP POLICY IF EXISTS "Allow public read for monitoring agents"    ON public.monitoring_agents;
DROP POLICY IF EXISTS "Allow public insert for monitoring agents"  ON public.monitoring_agents;
DROP POLICY IF EXISTS "Allow public update for monitoring agents"  ON public.monitoring_agents;

CREATE POLICY "Authenticated users can read agents"
  ON public.monitoring_agents FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Operators can insert agents"
  ON public.monitoring_agents FOR INSERT
  WITH CHECK (public.has_role('operator'));

CREATE POLICY "Operators can update agents"
  ON public.monitoring_agents FOR UPDATE
  USING (public.has_role('operator'));

CREATE POLICY "Admins can delete agents"
  ON public.monitoring_agents FOR DELETE
  USING (public.has_role('admin'));

-- -------------------------------------------------------
-- collected_logs
-- -------------------------------------------------------
DROP POLICY IF EXISTS "Allow public read for collected logs"   ON public.collected_logs;
DROP POLICY IF EXISTS "Allow public insert for collected logs" ON public.collected_logs;

CREATE POLICY "Authenticated users can read logs"
  ON public.collected_logs FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Operators can insert logs"
  ON public.collected_logs FOR INSERT
  WITH CHECK (public.has_role('operator'));

CREATE POLICY "Admins can delete logs"
  ON public.collected_logs FOR DELETE
  USING (public.has_role('admin'));

-- -------------------------------------------------------
-- collected_metrics
-- -------------------------------------------------------
DROP POLICY IF EXISTS "Allow public read for collected metrics"   ON public.collected_metrics;
DROP POLICY IF EXISTS "Allow public insert for collected metrics" ON public.collected_metrics;

CREATE POLICY "Authenticated users can read metrics"
  ON public.collected_metrics FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Operators can insert metrics"
  ON public.collected_metrics FOR INSERT
  WITH CHECK (public.has_role('operator'));

CREATE POLICY "Admins can delete metrics"
  ON public.collected_metrics FOR DELETE
  USING (public.has_role('admin'));

-- -------------------------------------------------------
-- collected_events
-- -------------------------------------------------------
DROP POLICY IF EXISTS "Allow public read for collected events"   ON public.collected_events;
DROP POLICY IF EXISTS "Allow public insert for collected events" ON public.collected_events;

CREATE POLICY "Authenticated users can read events"
  ON public.collected_events FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Operators can insert events"
  ON public.collected_events FOR INSERT
  WITH CHECK (public.has_role('operator'));

CREATE POLICY "Admins can delete events"
  ON public.collected_events FOR DELETE
  USING (public.has_role('admin'));

-- -------------------------------------------------------
-- alert_rules
-- -------------------------------------------------------
DROP POLICY IF EXISTS "Allow public read for alert rules"   ON public.alert_rules;
DROP POLICY IF EXISTS "Allow public insert for alert rules" ON public.alert_rules;
DROP POLICY IF EXISTS "Allow public update for alert rules" ON public.alert_rules;
DROP POLICY IF EXISTS "Allow public delete for alert rules" ON public.alert_rules;

CREATE POLICY "Authenticated users can read alert rules"
  ON public.alert_rules FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Operators can create alert rules"
  ON public.alert_rules FOR INSERT
  WITH CHECK (public.has_role('operator'));

CREATE POLICY "Operators can update alert rules"
  ON public.alert_rules FOR UPDATE
  USING (public.has_role('operator'));

CREATE POLICY "Admins can delete alert rules"
  ON public.alert_rules FOR DELETE
  USING (public.has_role('admin'));

-- -------------------------------------------------------
-- triggered_alerts
-- -------------------------------------------------------
DROP POLICY IF EXISTS "Allow public read for triggered alerts"   ON public.triggered_alerts;
DROP POLICY IF EXISTS "Allow public insert for triggered alerts" ON public.triggered_alerts;
DROP POLICY IF EXISTS "Allow public update for triggered alerts" ON public.triggered_alerts;

CREATE POLICY "Authenticated users can read triggered alerts"
  ON public.triggered_alerts FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Operators can insert triggered alerts"
  ON public.triggered_alerts FOR INSERT
  WITH CHECK (public.has_role('operator'));

CREATE POLICY "Operators can update triggered alerts"
  ON public.triggered_alerts FOR UPDATE
  USING (public.has_role('operator'));

CREATE POLICY "Admins can delete triggered alerts"
  ON public.triggered_alerts FOR DELETE
  USING (public.has_role('admin'));

-- -------------------------------------------------------
-- notification_channels
-- -------------------------------------------------------
DROP POLICY IF EXISTS "Allow read access to notification channels"   ON public.notification_channels;
DROP POLICY IF EXISTS "Allow insert access to notification channels" ON public.notification_channels;
DROP POLICY IF EXISTS "Allow update access to notification channels" ON public.notification_channels;
DROP POLICY IF EXISTS "Allow delete access to notification channels" ON public.notification_channels;

CREATE POLICY "Authenticated users can read notification channels"
  ON public.notification_channels FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage notification channels"
  ON public.notification_channels FOR ALL
  USING (public.has_role('admin'));

-- -------------------------------------------------------
-- jira_automation_settings
-- -------------------------------------------------------
DROP POLICY IF EXISTS "Allow public read for jira automation settings"   ON public.jira_automation_settings;
DROP POLICY IF EXISTS "Allow public insert for jira automation settings" ON public.jira_automation_settings;
DROP POLICY IF EXISTS "Allow public update for jira automation settings" ON public.jira_automation_settings;

CREATE POLICY "Authenticated users can read jira settings"
  ON public.jira_automation_settings FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage jira settings"
  ON public.jira_automation_settings FOR ALL
  USING (public.has_role('admin'));

-- -------------------------------------------------------
-- jira_resource_tickets
-- -------------------------------------------------------
DROP POLICY IF EXISTS "Allow public read for jira resource tickets"   ON public.jira_resource_tickets;
DROP POLICY IF EXISTS "Allow public insert for jira resource tickets" ON public.jira_resource_tickets;
DROP POLICY IF EXISTS "Allow public update for jira resource tickets" ON public.jira_resource_tickets;

CREATE POLICY "Authenticated users can read jira tickets"
  ON public.jira_resource_tickets FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Operators can create jira tickets"
  ON public.jira_resource_tickets FOR INSERT
  WITH CHECK (public.has_role('operator'));

CREATE POLICY "Operators can update jira tickets"
  ON public.jira_resource_tickets FOR UPDATE
  USING (public.has_role('operator'));

CREATE POLICY "Admins can delete jira tickets"
  ON public.jira_resource_tickets FOR DELETE
  USING (public.has_role('admin'));
