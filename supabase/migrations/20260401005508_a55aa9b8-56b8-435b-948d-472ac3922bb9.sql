
-- Update handle_new_user to also skip profile creation when user metadata indicates store_customer
-- This covers both email signup (is_customer) and OAuth signup (store_customer_signup)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Skip profile creation for customer accounts (email signup sets is_customer, OAuth sets store_customer_signup)
  IF (NEW.raw_user_meta_data->>'is_customer')::boolean = true THEN
    RETURN NEW;
  END IF;
  IF (NEW.raw_user_meta_data->>'store_customer_signup')::boolean = true THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (user_id, display_name, status)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email), 'active');
  RETURN NEW;
END;
$$;
