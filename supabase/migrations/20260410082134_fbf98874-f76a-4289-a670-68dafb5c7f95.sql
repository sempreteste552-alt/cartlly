-- Set search_path for get_store_rich_insights
ALTER FUNCTION public.get_store_rich_insights(uuid) SET search_path = public;

-- Set search_path for can_send_notification
ALTER FUNCTION public.can_send_notification(uuid, uuid, text, text, integer) SET search_path = public;
