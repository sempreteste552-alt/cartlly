-- Create table for store collaborators
CREATE TABLE public.store_collaborators (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    store_owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    collaborator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(store_owner_id, collaborator_id)
);

-- Enable RLS
ALTER TABLE public.store_collaborators ENABLE ROW LEVEL SECURITY;

-- Owner can manage their collaborators
CREATE POLICY "Owners can manage collaborators" ON public.store_collaborators
FOR ALL USING (auth.uid() = store_owner_id);

-- Collaborators can see who else is a collaborator for the same store
CREATE POLICY "Collaborators can view fellow collaborators" ON public.store_collaborators
FOR SELECT USING (
    auth.uid() = collaborator_id OR 
    EXISTS (
        SELECT 1 FROM public.store_collaborators sc 
        WHERE sc.store_owner_id = store_collaborators.store_owner_id 
        AND sc.collaborator_id = auth.uid()
    )
);

-- Function to check if a user is a collaborator with a specific role or higher
CREATE OR REPLACE FUNCTION public.is_collaborator(owner_id UUID, required_role TEXT DEFAULT 'viewer')
RETURNS BOOLEAN AS $$
BEGIN
    -- Owner always has access
    IF auth.uid() = owner_id THEN
        RETURN TRUE;
    END IF;

    -- Check collaborator table
    RETURN EXISTS (
        SELECT 1 FROM public.store_collaborators
        WHERE store_owner_id = owner_id 
        AND collaborator_id = auth.uid()
        AND (
            CASE 
                WHEN required_role = 'viewer' THEN role IN ('admin', 'editor', 'viewer')
                WHEN required_role = 'editor' THEN role IN ('admin', 'editor')
                WHEN required_role = 'admin' THEN role = 'admin'
                ELSE FALSE
            END
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS for products to allow collaborators
DROP POLICY IF EXISTS "Users can update their own products" ON public.products;
CREATE POLICY "Users and collaborators can update products" ON public.products
FOR UPDATE USING (is_collaborator(user_id, 'editor'));

DROP POLICY IF EXISTS "Users can delete their own products" ON public.products;
CREATE POLICY "Users and collaborators can delete products" ON public.products
FOR DELETE USING (is_collaborator(user_id, 'admin'));

DROP POLICY IF EXISTS "Users can view their own products" ON public.products;
CREATE POLICY "Users and collaborators can view products" ON public.products
FOR SELECT USING (is_collaborator(user_id, 'viewer'));

-- Low Stock Notification Function
CREATE OR REPLACE FUNCTION public.handle_low_stock_notification()
RETURNS TRIGGER AS $$
BEGIN
    -- Only trigger if stock is now below or equal to alert level AND it wasn't before (or it's a new product)
    IF (TG_OP = 'INSERT' AND NEW.stock <= NEW.min_stock_alert) OR
       (TG_OP = 'UPDATE' AND NEW.stock <= NEW.min_stock_alert AND (OLD.stock > OLD.min_stock_alert OR OLD.min_stock_alert IS NULL)) THEN
        
        -- Insert into admin_notifications for the owner
        INSERT INTO public.admin_notifications (
            target_user_id,
            title,
            message,
            type
        ) VALUES (
            NEW.user_id,
            'Estoque Baixo: ' || NEW.name,
            'O produto "' || NEW.name || '" atingiu o nível crítico de estoque (' || NEW.stock || ' unidades).',
            'low_stock'
        );

        -- Also notify collaborators with admin/editor roles
        INSERT INTO public.admin_notifications (
            target_user_id,
            title,
            message,
            type
        )
        SELECT 
            collaborator_id,
            'Estoque Baixo: ' || NEW.name,
            'O produto "' || NEW.name || '" atingiu o nível crítico de estoque (' || NEW.stock || ' unidades).',
            'low_stock'
        FROM public.store_collaborators
        WHERE store_owner_id = NEW.user_id AND role IN ('admin', 'editor');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for stock changes
DROP TRIGGER IF EXISTS on_product_stock_change ON public.products;
CREATE TRIGGER on_product_stock_change
AFTER INSERT OR UPDATE OF stock, min_stock_alert
ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.handle_low_stock_notification();
