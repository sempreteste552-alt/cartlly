-- Add INSERT policy for admin_notifications
CREATE POLICY "Users can create notifications" 
ON public.admin_notifications 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = sender_user_id);