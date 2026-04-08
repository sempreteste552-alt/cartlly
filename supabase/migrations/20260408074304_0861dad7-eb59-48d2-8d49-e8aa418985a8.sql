
-- Table to track read status per customer per message
CREATE TABLE public.customer_message_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.tenant_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

ALTER TABLE public.customer_message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reads"
  ON public.customer_message_reads FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can mark as read"
  ON public.customer_message_reads FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_customer_message_reads_user ON public.customer_message_reads(user_id);
CREATE INDEX idx_customer_message_reads_message ON public.customer_message_reads(message_id);
