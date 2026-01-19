-- Create helper functions to manage cron jobs from the application

-- Function to get all cron jobs
CREATE OR REPLACE FUNCTION public.get_cron_jobs()
RETURNS TABLE (
  jobid bigint,
  jobname text,
  schedule text,
  command text,
  nodename text,
  nodeport integer,
  database text,
  username text,
  active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.jobid,
    j.jobname,
    j.schedule,
    j.command,
    j.nodename,
    j.nodeport,
    j.database,
    j.username,
    j.active
  FROM cron.job j
  ORDER BY j.jobid;
END;
$$;

-- Function to toggle cron job active state
CREATE OR REPLACE FUNCTION public.toggle_cron_job(job_id bigint, is_active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  UPDATE cron.job SET active = is_active WHERE jobid = job_id;
END;
$$;

-- Function to delete a cron job
CREATE OR REPLACE FUNCTION public.delete_cron_job(job_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  PERFORM cron.unschedule(job_name);
END;
$$;

-- Function to create a new cron job for edge functions
CREATE OR REPLACE FUNCTION public.create_cron_job(
  job_name text,
  job_schedule text,
  function_name text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  project_url text := 'https://frfjddiiqaunvhwjbuzz.supabase.co';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyZmpkZGlpcWF1bnZod2pidXp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5ODA2NTgsImV4cCI6MjA3OTU1NjY1OH0.Z2gXB5nBqXgmlf9aKlyONOUsvTsTlb2RzQ2gXJHriec';
  job_id bigint;
BEGIN
  SELECT cron.schedule(
    job_name,
    job_schedule,
    format(
      'SELECT net.http_post(url := %L, headers := %L::jsonb, body := concat(''{"time": "'', now(), ''"}'')::jsonb) AS request_id;',
      project_url || '/functions/v1/' || function_name,
      format('{"Content-Type": "application/json", "Authorization": "Bearer %s"}', anon_key)
    )
  ) INTO job_id;
  
  RETURN job_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_cron_jobs() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_cron_job(bigint, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_cron_job(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_cron_job(text, text, text) TO anon, authenticated;