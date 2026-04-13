
-- =============================================
-- FIX 1: support_conversations - tighten SELECT/INSERT/UPDATE
-- =============================================
DROP POLICY IF EXISTS "Customers can view their own conversations" ON public.support_conversations;
DROP POLICY IF EXISTS "Customers can create their own conversations" ON public.support_conversations;
DROP POLICY IF EXISTS "Customers can update their own typing status" ON public.support_conversations;

-- Customers can only view conversations where they are the customer
CREATE POLICY "Customers can view their own conversations"
ON public.support_conversations FOR SELECT TO public
USING (
  EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = support_conversations.customer_id
    AND c.auth_user_id = auth.uid()
  )
  OR auth.uid() = tenant_id
  OR has_role(auth.uid(), 'super_admin')
);

CREATE POLICY "Customers can create their own conversations"
ON public.support_conversations FOR INSERT TO public
WITH CHECK (
  customer_id IS NULL
  OR EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = support_conversations.customer_id
    AND c.auth_user_id = auth.uid()
  )
);

CREATE POLICY "Customers can update their own typing status"
ON public.support_conversations FOR UPDATE TO public
USING (
  EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = support_conversations.customer_id
    AND c.auth_user_id = auth.uid()
  )
  OR auth.uid() = tenant_id
);

-- =============================================
-- FIX 2: support_messages - tighten SELECT/INSERT
-- =============================================
DROP POLICY IF EXISTS "Customers can view their own messages" ON public.support_messages;
DROP POLICY IF EXISTS "Customers can send messages" ON public.support_messages;

CREATE POLICY "Customers can view their own messages"
ON public.support_messages FOR SELECT TO public
USING (
  EXISTS (
    SELECT 1 FROM public.support_conversations sc
    JOIN public.customers c ON c.id = sc.customer_id
    WHERE sc.id = support_messages.conversation_id
    AND c.auth_user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.support_conversations sc
    WHERE sc.id = support_messages.conversation_id
    AND sc.tenant_id = auth.uid()
  )
  OR has_role(auth.uid(), 'super_admin')
);

CREATE POLICY "Customers can send messages"
ON public.support_messages FOR INSERT TO public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.support_conversations sc
    JOIN public.customers c ON c.id = sc.customer_id
    WHERE sc.id = support_messages.conversation_id
    AND c.auth_user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.support_conversations sc
    WHERE sc.id = support_messages.conversation_id
    AND sc.tenant_id = auth.uid()
  )
);

-- =============================================
-- FIX 3: customer_view_stats - restrict to store owner
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can read customer view stats" ON public.customer_view_stats;
DROP POLICY IF EXISTS "Authenticated users can update customer view stats" ON public.customer_view_stats;
DROP POLICY IF EXISTS "Authenticated can select view stats" ON public.customer_view_stats;
DROP POLICY IF EXISTS "Authenticated can update view stats" ON public.customer_view_stats;

CREATE POLICY "Store owners can read their product view stats"
ON public.customer_view_stats FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = customer_view_stats.product_id AND p.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = customer_view_stats.customer_id AND c.auth_user_id = auth.uid()
  )
);

CREATE POLICY "Users can upsert view stats"
ON public.customer_view_stats FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = customer_view_stats.product_id AND p.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = customer_view_stats.customer_id AND c.auth_user_id = auth.uid()
  )
);

CREATE POLICY "Users can update view stats"
ON public.customer_view_stats FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = customer_view_stats.product_id AND p.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = customer_view_stats.customer_id AND c.auth_user_id = auth.uid()
  )
);

-- =============================================
-- FIX 4: loyalty_config - remove overly broad public read
-- =============================================
DROP POLICY IF EXISTS "lc_public_read" ON public.loyalty_config;
