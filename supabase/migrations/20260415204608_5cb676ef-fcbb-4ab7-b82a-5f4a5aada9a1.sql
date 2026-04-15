-- Add email column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Update trigger function to include email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- Backfill email for existing profiles if possible (only for already signed up users)
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.user_id = u.id AND p.email IS NULL;

-- Allow authenticated users to search profiles by email
-- This is necessary for the invite functionality
CREATE POLICY "Allow users to search profiles by email"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- Ensure email is unique in profiles (since it is unique in auth.users)
-- This isn't strictly necessary but good for consistency
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles (email);