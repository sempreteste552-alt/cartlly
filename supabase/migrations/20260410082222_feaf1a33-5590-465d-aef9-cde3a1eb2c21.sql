-- Generic function to check if a message can be sent (cooldown + dedup)
CREATE OR REPLACE FUNCTION public.can_send_message(
    p_target_id uuid,
    p_title text,
    p_body text,
    p_cooldown_minutes integer DEFAULT 5
)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
    v_last_sent_at timestamp with time zone;
    v_duplicate_exists boolean;
BEGIN
    -- 1. Check cooldown in admin_notifications
    SELECT MAX(created_at)
    INTO v_last_sent_at
    FROM public.admin_notifications
    WHERE target_user_id = p_target_id
      AND created_at >= NOW() - (p_cooldown_minutes || ' minutes')::interval;

    IF v_last_sent_at IS NOT NULL THEN
        RETURN FALSE;
    END IF;

    -- 2. Check cooldown in automation_executions (for customers)
    SELECT MAX(sent_at)
    INTO v_last_sent_at
    FROM public.automation_executions
    WHERE customer_id = p_target_id
      AND sent_at >= NOW() - (p_cooldown_minutes || ' minutes')::interval;

    IF v_last_sent_at IS NOT NULL THEN
        RETURN FALSE;
    END IF;

    -- 3. Check for identical message in the last 24 hours (deduplication)
    -- Check admin_notifications
    SELECT EXISTS (
        SELECT 1 
        FROM public.admin_notifications
        WHERE target_user_id = p_target_id
          AND title = p_title
          AND message = p_body
          AND created_at >= NOW() - INTERVAL '24 hours'
    ) INTO v_duplicate_exists;

    IF v_duplicate_exists THEN
        RETURN FALSE;
    END IF;

    -- Check automation_executions
    SELECT EXISTS (
        SELECT 1 
        FROM public.automation_executions
        WHERE customer_id = p_target_id
          AND message_text LIKE '%' || SUBSTRING(p_body FROM 1 FOR 50) || '%'
          AND sent_at >= NOW() - INTERVAL '24 hours'
    ) INTO v_duplicate_exists;

    IF v_duplicate_exists THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$function$;

-- Drop the old one
DROP FUNCTION IF EXISTS public.can_send_notification(uuid, uuid, text, text, integer);
