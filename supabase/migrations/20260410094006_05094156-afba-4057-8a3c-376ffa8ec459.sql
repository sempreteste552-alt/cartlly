-- Add tracking columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;

-- Create an index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON public.profiles(last_seen);
CREATE INDEX IF NOT EXISTS idx_profiles_is_online ON public.profiles(is_online);

-- Function to handle maintenance mode disconnect (if we wanted to do it via DB, but better done in FE)
-- For now, let's focus on the tracking part.

-- Function to update last_seen on any activity (this might be too frequent if we use it for every UPDATE)
-- Instead, we will update it from the frontend.

-- Ensure the Super Admin can see these columns (already covered by existing RLS if they are viewable by everyone or if super admin bypasses)
-- Check existing policies for profiles
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'Super admins can view all profiles'
    ) THEN
        CREATE POLICY "Super admins can view all profiles" 
        ON public.profiles 
        FOR SELECT 
        USING (auth.jwt() ->> 'email' = 'evelynesantoscruivinel@gmail.com');
    END IF;
END $$;
