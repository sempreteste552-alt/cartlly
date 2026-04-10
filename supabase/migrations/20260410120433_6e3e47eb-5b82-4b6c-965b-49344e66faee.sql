
-- Function to auto-generate referral code for a tenant
CREATE OR REPLACE FUNCTION public.auto_create_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  -- Check if tenant already has a referral code
  SELECT EXISTS(SELECT 1 FROM referral_codes WHERE tenant_id = NEW.user_id) INTO code_exists;
  
  IF NOT code_exists THEN
    -- Generate a unique 8-char uppercase code
    LOOP
      new_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
      EXIT WHEN NOT EXISTS(SELECT 1 FROM referral_codes WHERE code = new_code);
    END LOOP;
    
    INSERT INTO referral_codes (tenant_id, code, clicks)
    VALUES (NEW.user_id, new_code, 0);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger: auto-create referral code when store_settings is inserted/updated with a slug
DROP TRIGGER IF EXISTS trg_auto_referral_code ON store_settings;
CREATE TRIGGER trg_auto_referral_code
  AFTER INSERT ON store_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_referral_code();

-- Backfill: create referral codes for existing tenants who don't have one
DO $$
DECLARE
  t RECORD;
  new_code TEXT;
BEGIN
  FOR t IN
    SELECT ss.user_id
    FROM store_settings ss
    LEFT JOIN referral_codes rc ON rc.tenant_id = ss.user_id
    WHERE rc.id IS NULL AND ss.store_slug IS NOT NULL
  LOOP
    LOOP
      new_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
      EXIT WHEN NOT EXISTS(SELECT 1 FROM referral_codes WHERE code = new_code);
    END LOOP;
    
    INSERT INTO referral_codes (tenant_id, code, clicks)
    VALUES (t.user_id, new_code, 0);
  END LOOP;
END $$;
