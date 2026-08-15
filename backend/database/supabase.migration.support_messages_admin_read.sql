-- Admin-read flag for customer support messages.
-- is_read = true only means the platform admin has seen that customer message.
-- Admin replies are stored as is_read = true and are not counted as unread.
-- Run once in Supabase → SQL Editor → Run (safe if already applied).

ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_support_messages_unread
  ON public.support_messages (user_id)
  WHERE is_read = false AND sender = 'customer';

COMMENT ON COLUMN public.support_messages.is_read IS
  'True when the platform admin has read this customer message. Does not track whether the customer read an admin reply.';

NOTIFY pgrst, 'reload schema';
