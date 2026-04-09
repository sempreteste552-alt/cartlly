-- Update handle_product_out_of_stock to use low_stock type
CREATE OR REPLACE FUNCTION public.handle_product_out_of_stock()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if stock was greater than 0 and is now 0 or less
    IF NEW.stock <= 0 AND (OLD.stock > 0 OR OLD.stock IS NULL) AND NOT NEW.is_archived AND (NEW.made_to_order IS FALSE OR NEW.made_to_order IS NULL) THEN
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
            'low_stock', -- Use low_stock type for the ⚠️ emoji
            false
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update handle_variant_out_of_stock to use low_stock type
CREATE OR REPLACE FUNCTION public.handle_variant_out_of_stock()
RETURNS TRIGGER AS $$
DECLARE
    v_product_name TEXT;
    v_owner_id UUID;
    v_total_stock INTEGER;
BEGIN
    -- Get product info
    SELECT name, user_id INTO v_product_name, v_owner_id FROM public.products WHERE id = NEW.product_id;

    -- Check if variant stock reached 0
    IF NEW.stock <= 0 AND (OLD.stock > 0 OR OLD.stock IS NULL) THEN
        -- Notify about variant out of stock
        INSERT INTO public.admin_notifications (
            target_user_id,
            title,
            message,
            type,
            read
        ) VALUES (
            v_owner_id,
            'Variante sem estoque: ' || v_product_name,
            'A variante "' || NEW.variant_value || '" (' || NEW.variant_type || ') do produto "' || v_product_name || '" está sem estoque.',
            'low_stock',
            false
        );

        -- Check if all variants are out of stock
        SELECT SUM(stock) INTO v_total_stock FROM public.product_variants WHERE product_id = NEW.product_id;
        
        IF v_total_stock <= 0 THEN
            -- Archive the parent product
            UPDATE public.products 
            SET is_archived = true, published = false
            WHERE id = NEW.product_id AND NOT is_archived;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
