-- Create store_invitations table
CREATE TABLE public.store_invitations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    store_owner_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    accepted_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.store_invitations ENABLE ROW LEVEL SECURITY;

-- Policies for store_invitations
CREATE POLICY "Store owners can manage their own invitations" 
ON public.store_invitations 
FOR ALL 
USING (auth.uid() = store_owner_id);

CREATE POLICY "Invited users can view their invitations" 
ON public.store_invitations 
FOR SELECT 
USING (email = (SELECT email FROM public.profiles WHERE user_id = auth.uid()));

-- Index for faster lookups
CREATE INDEX idx_store_invitations_email ON public.store_invitations(email);

-- Function to handle invitation acceptance when a new profile is created
CREATE OR REPLACE FUNCTION public.handle_new_user_invitations()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if there are any invitations for this email
    INSERT INTO public.store_collaborators (store_owner_id, collaborator_id, role)
    SELECT store_owner_id, NEW.user_id, role
    FROM public.store_invitations
    WHERE LOWER(email) = LOWER(NEW.email) AND accepted_at IS NULL;

    -- Mark invitations as accepted
    UPDATE public.store_invitations
    SET accepted_at = now()
    WHERE LOWER(email) = LOWER(NEW.email) AND accepted_at IS NULL;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on profiles table
CREATE TRIGGER on_profile_created_check_invitations
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_invitations();
