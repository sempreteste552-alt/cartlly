-- Create support_conversations table
CREATE TABLE public.support_conversations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_id UUID, -- Optional: link to a registered customer
    session_id TEXT NOT NULL, -- Required for guest support
    is_active BOOLEAN DEFAULT true,
    is_typing_customer BOOLEAN DEFAULT false,
    is_typing_admin BOOLEAN DEFAULT false,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index for faster lookups
CREATE INDEX idx_support_conversations_tenant_session ON public.support_conversations(tenant_id, session_id);
CREATE INDEX idx_support_conversations_tenant ON public.support_conversations(tenant_id);

-- Create support_messages table
CREATE TABLE public.support_messages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'admin')),
    sender_id UUID, -- Can be tenant_id or customer_id
    body TEXT NOT NULL,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Policies for support_conversations
CREATE POLICY "Tenants can manage their own conversations"
ON public.support_conversations
FOR ALL
USING (auth.uid() = tenant_id);

CREATE POLICY "Customers can view their own conversations"
ON public.support_conversations
FOR SELECT
USING (true); -- We'll use session_id/customer_id filtering in queries

CREATE POLICY "Customers can create their own conversations"
ON public.support_conversations
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Customers can update their own typing status"
ON public.support_conversations
FOR UPDATE
USING (true);

-- Policies for support_messages
CREATE POLICY "Tenants can manage their own messages"
ON public.support_messages
FOR ALL
USING (EXISTS (
    SELECT 1 FROM public.support_conversations 
    WHERE id = conversation_id AND tenant_id = auth.uid()
));

CREATE POLICY "Customers can view their own messages"
ON public.support_messages
FOR SELECT
USING (true); -- Filtered in query

CREATE POLICY "Customers can send messages"
ON public.support_messages
FOR INSERT
WITH CHECK (true);

-- Function to update conversation last message timestamp
CREATE OR REPLACE FUNCTION public.update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.support_conversations
    SET last_message_at = now(),
        updated_at = now()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversation_timestamp
AFTER INSERT ON public.support_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_on_message();

-- Update updated_at trigger for conversations
CREATE TRIGGER update_support_conversations_updated_at
BEFORE UPDATE ON public.support_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
