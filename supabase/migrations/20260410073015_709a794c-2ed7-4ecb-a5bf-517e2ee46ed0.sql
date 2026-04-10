-- Function to sync store_settings custom_domain to store_domains
CREATE OR REPLACE FUNCTION public.sync_store_custom_domain()
RETURNS TRIGGER AS $$
BEGIN
    -- If custom_domain was removed or changed
    IF (TG_OP = 'UPDATE' AND (OLD.custom_domain IS DISTINCT FROM NEW.custom_domain)) OR TG_OP = 'INSERT' THEN
        -- Delete old hostname if it was changed
        IF OLD.custom_domain IS NOT NULL AND OLD.custom_domain != '' THEN
            DELETE FROM public.store_domains 
            WHERE store_id = NEW.id AND hostname = OLD.custom_domain;
        END IF;

        -- Insert new hostname if provided
        IF NEW.custom_domain IS NOT NULL AND NEW.custom_domain != '' THEN
            INSERT INTO public.store_domains (store_id, hostname, is_primary)
            VALUES (NEW.id, NEW.custom_domain, TRUE)
            ON CONFLICT (hostname) DO UPDATE SET is_primary = TRUE;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger
DROP TRIGGER IF EXISTS tr_sync_store_custom_domain ON public.store_settings;
CREATE TRIGGER tr_sync_store_custom_domain
AFTER INSERT OR UPDATE OF custom_domain ON public.store_settings
FOR EACH ROW
EXECUTE FUNCTION public.sync_store_custom_domain();
