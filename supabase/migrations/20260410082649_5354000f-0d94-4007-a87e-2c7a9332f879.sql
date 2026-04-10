CREATE OR REPLACE FUNCTION public.get_super_admin_ids()
RETURNS TABLE (user_id UUID) AS $$
BEGIN
    RETURN QUERY 
    SELECT ur.user_id 
    FROM public.user_roles ur 
    WHERE ur.role = 'super_admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
