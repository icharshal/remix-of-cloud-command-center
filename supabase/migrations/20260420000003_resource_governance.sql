-- ============================================================
-- Add extension workflow + validity status to jira_resource_tickets
-- ============================================================

-- Validity lifecycle:
--   active     → within 2-day window, no action taken
--   extended   → team member requested extension, new due date set
--   expired    → past due date, not extended or approved
--   approved   → admin marked resource as approved to keep permanently
--   deleted    → resource has been deleted

ALTER TABLE public.jira_resource_tickets
  ADD COLUMN IF NOT EXISTS validity_status TEXT NOT NULL DEFAULT 'active'
    CHECK (validity_status IN ('active', 'extended', 'expired', 'approved', 'deleted')),
  ADD COLUMN IF NOT EXISTS extended_due_date DATE,
  ADD COLUMN IF NOT EXISTS extension_reason TEXT,
  ADD COLUMN IF NOT EXISTS extension_requested_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS extension_requested_by TEXT,
  ADD COLUMN IF NOT EXISTS approved_by TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS deleted_by TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS gcp_project_id TEXT,
  ADD COLUMN IF NOT EXISTS gcp_region TEXT,
  ADD COLUMN IF NOT EXISTS gcp_resource_url TEXT;

-- Index for fast validity status queries
CREATE INDEX IF NOT EXISTS idx_jira_resource_tickets_validity
  ON public.jira_resource_tickets(validity_status);

CREATE INDEX IF NOT EXISTS idx_jira_resource_tickets_gcp_project
  ON public.jira_resource_tickets(gcp_project_id);

-- ============================================================
-- Resource actions audit log
-- Every approve / extend / delete action gets recorded here
-- ============================================================

CREATE TABLE public.resource_actions (
  id            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id     UUID NOT NULL REFERENCES public.jira_resource_tickets(id) ON DELETE CASCADE,
  action        TEXT NOT NULL CHECK (action IN ('created', 'extended', 'approved', 'deleted', 'expired', 'comment')),
  actor_email   TEXT,
  actor_name    TEXT,
  reason        TEXT,
  old_due_date  DATE,
  new_due_date  DATE,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_resource_actions_ticket ON public.resource_actions(ticket_id);
CREATE INDEX idx_resource_actions_created ON public.resource_actions(created_at DESC);

ALTER TABLE public.resource_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read resource actions"
  ON public.resource_actions FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert resource actions"
  ON public.resource_actions FOR INSERT
  WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.resource_actions;
