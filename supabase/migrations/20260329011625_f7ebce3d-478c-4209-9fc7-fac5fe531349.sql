-- Update handle_new_user to skip profile creation for customer accounts
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  -- Skip profile creation for customer accounts (they use the customers table)
  IF (NEW.raw_user_meta_data->>'is_customer')::boolean = true THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (user_id, display_name, status)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email), 'active');
  RETURN NEW;
END;
$function$;

-- Recreate the trigger on auth.users (drop if exists, then create)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();