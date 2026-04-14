-- 1. Function to generate a unique referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT AS $$
DECLARE
    v_code TEXT;
    v_exists BOOLEAN;
BEGIN
    LOOP
        v_code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
        SELECT EXISTS(SELECT 1 FROM public.customers WHERE referral_code = v_code) INTO v_exists;
        EXIT WHEN NOT v_exists;
    END LOOP;
    RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- 2. Trigger function to auto-assign referral code on customer creation
CREATE OR REPLACE FUNCTION public.tr_auto_assign_referral_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.referral_code IS NULL OR NEW.referral_code = '' THEN
        NEW.referral_code := public.generate_referral_code();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create the trigger
DROP TRIGGER IF EXISTS trigger_auto_assign_referral_code ON public.customers;
CREATE TRIGGER trigger_auto_assign_referral_code
BEFORE INSERT ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.tr_auto_assign_referral_code();

-- 4. Ensure all existing customers have a referral code
UPDATE public.customers 
SET referral_code = public.generate_referral_code()
WHERE referral_code IS NULL OR referral_code = '';
