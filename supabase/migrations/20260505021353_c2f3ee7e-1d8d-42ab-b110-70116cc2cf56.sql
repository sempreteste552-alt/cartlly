ALTER TABLE public.support_conversations
ADD COLUMN IF NOT EXISTS customer_present_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_support_conversations_customer_present_at
ON public.support_conversations(customer_present_at);