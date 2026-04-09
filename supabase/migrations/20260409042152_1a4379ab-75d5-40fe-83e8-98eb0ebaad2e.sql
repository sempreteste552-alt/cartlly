-- Function to handle new user setup
CREATE OR REPLACE FUNCTION public.handle_new_user_setup()
RETURNS TRIGGER AS $$
DECLARE
    v_store_name TEXT;
    v_store_slug TEXT;
    v_display_name TEXT;
BEGIN
    -- Extract data from metadata
    v_display_name := COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email);
    v_store_name := COALESCE(NEW.raw_user_meta_data->>'store_name', v_display_name);
    v_store_slug := NEW.raw_user_meta_data->>'store_slug';

    -- Insert into profiles
    INSERT INTO public.profiles (id, display_name, email)
    VALUES (NEW.id, v_display_name, NEW.email)
    ON CONFLICT (id) DO NOTHING;

    -- Insert into store_settings if we have a slug
    IF v_store_slug IS NOT NULL THEN
        INSERT INTO public.store_settings (user_id, store_name, store_slug)
        VALUES (NEW.id, v_store_name, v_store_slug)
        ON CONFLICT (user_id) DO UPDATE 
        SET store_name = EXCLUDED.store_name, 
            store_slug = EXCLUDED.store_slug
        WHERE store_settings.store_slug IS NULL OR store_settings.store_slug = '';
    ELSE
        -- Default insert if no slug provided yet (fallback)
        INSERT INTO public.store_settings (user_id, store_name)
        VALUES (NEW.id, v_store_name)
        ON CONFLICT (user_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_setup ON auth.users;
CREATE TRIGGER on_auth_user_created_setup
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_setup();
