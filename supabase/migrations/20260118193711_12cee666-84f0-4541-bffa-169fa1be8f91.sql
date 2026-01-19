-- Create notification_channels table for storing webhook/email configs
CREATE TABLE public.notification_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('email', 'slack_webhook')),
  config JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  severity_filter TEXT[] NOT NULL DEFAULT ARRAY['critical', 'warning', 'info'],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add comments
COMMENT ON TABLE public.notification_channels IS 'Stores notification channel configurations for alerts';
COMMENT ON COLUMN public.notification_channels.config IS 'Channel-specific config: email has "to" array, slack_webhook has "webhook_url"';

-- Enable RLS
ALTER TABLE public.notification_channels ENABLE ROW LEVEL SECURITY;

-- RLS policies - Allow all operations without auth (monitoring tool access)
CREATE POLICY "Allow read access to notification channels"
ON public.notification_channels FOR SELECT
USING (true);

CREATE POLICY "Allow insert access to notification channels"
ON public.notification_channels FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow update access to notification channels"
ON public.notification_channels FOR UPDATE
USING (true);

CREATE POLICY "Allow delete access to notification channels"
ON public.notification_channels FOR DELETE
USING (true);

-- Create index
CREATE INDEX idx_notification_channels_enabled ON public.notification_channels(enabled);
CREATE INDEX idx_notification_channels_type ON public.notification_channels(channel_type);

-- Add trigger for updated_at
CREATE TRIGGER update_notification_channels_updated_at
BEFORE UPDATE ON public.notification_channels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_channels;