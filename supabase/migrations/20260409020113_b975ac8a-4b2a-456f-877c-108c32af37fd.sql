-- Add is_archived column
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

-- Create trigger function
CREATE OR REPLACE FUNCTION public.handle_product_out_of_stock()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if stock was greater than 0 and is now 0 or less
    IF NEW.stock <= 0 AND (OLD.stock > 0 OR OLD.stock IS NULL) AND NOT NEW.is_archived AND NOT NEW.made_to_order THEN
        -- Archive the product
        NEW.is_archived := true;
        NEW.published := false;
        
        -- Create admin notification
        INSERT INTO public.admin_notifications (
            target_user_id,
            title,
            message,
            type,
            read
        ) VALUES (
            NEW.user_id,
            'Produto arquivado por falta de estoque',
            'O produto "' || NEW.name || '" foi arquivado automaticamente porque o estoque acabou. Reponha o estoque para reativá-lo.',
            'warning',
            false
        );
        
        -- Note: Push notification logic would ideally be handled via a separate hook or edge function 
        -- triggered by this record insertion, or directly here if a push service is integrated.
        -- We'll rely on the app checking admin_notifications for now.
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS tr_product_out_of_stock ON public.products;
CREATE TRIGGER tr_product_out_of_stock
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.handle_product_out_of_stock();
