-- Add niche column to tenant_ai_brain_config
ALTER TABLE public.tenant_ai_brain_config 
ADD COLUMN IF NOT EXISTS niche TEXT;

-- Create a helper function to get super admin user IDs if not exists
CREATE OR REPLACE FUNCTION public.get_super_admin_ids()
RETURNS TABLE (user_id UUID) AS $$
BEGIN
    RETURN QUERY 
    SELECT ur.user_id 
    FROM public.user_roles ur 
    WHERE ur.role = 'super_admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
