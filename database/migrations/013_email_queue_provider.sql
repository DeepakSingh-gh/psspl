-- Pin provider selection so changing configuration never silently reroutes jobs.
-- Existing queue jobs were created by Resend.
ALTER TABLE auth_email_queue ADD COLUMN provider TEXT NOT NULL DEFAULT 'resend';
