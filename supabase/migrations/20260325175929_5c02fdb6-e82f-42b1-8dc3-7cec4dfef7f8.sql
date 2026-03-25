
ALTER TABLE public.profiles ADD COLUMN status text NOT NULL DEFAULT 'pending';

-- Update existing profiles to approved so current users aren't locked out
UPDATE public.profiles SET status = 'approved' WHERE status = 'pending';

-- Update the trigger to set new users as pending
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, status)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email), 'pending');
  RETURN NEW;
END;
$$;
