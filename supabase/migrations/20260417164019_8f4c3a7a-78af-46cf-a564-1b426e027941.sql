-- 1. Backfill: mark all existing undelivered messages as delivered
UPDATE public.support_messages
SET delivered_at = COALESCE(delivered_at, created_at)
WHERE delivered_at IS NULL;

-- 2. Trigger: auto-set delivered_at on insert (server received = delivered)
CREATE OR REPLACE FUNCTION public.support_messages_set_delivered()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.delivered_at IS NULL THEN
    NEW.delivered_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_messages_set_delivered_trg ON public.support_messages;
CREATE TRIGGER support_messages_set_delivered_trg
BEFORE INSERT ON public.support_messages
FOR EACH ROW
EXECUTE FUNCTION public.support_messages_set_delivered();