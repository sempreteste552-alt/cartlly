-- Create roulette_prizes table
CREATE TABLE public.roulette_prizes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    label TEXT NOT NULL,
    description TEXT,
    prize_type TEXT NOT NULL DEFAULT 'percentage_discount', -- 'percentage_discount', 'fixed_discount', 'free_gift'
    prize_value NUMERIC,
    probability FLOAT NOT NULL DEFAULT 0.1,
    min_subscription_tier TEXT DEFAULT 'FREE', -- 'FREE', 'STARTER', 'PRO', 'PREMIUM'
    is_active BOOLEAN DEFAULT true,
    manual_approval_required BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create roulette_spins table
CREATE TABLE public.roulette_spins (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    prize_id UUID REFERENCES public.roulette_prizes(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending_approval', -- 'pending_approval', 'won', 'claimed', 'rejected'
    coupon_code TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.roulette_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roulette_spins ENABLE ROW LEVEL SECURITY;

-- Policies for roulette_prizes
CREATE POLICY "Public can view active prizes"
    ON public.roulette_prizes
    FOR SELECT
    USING (is_active = true);

CREATE POLICY "Super admins can manage prizes"
    ON public.roulette_prizes
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'super_admin'
        )
    );

-- Policies for roulette_spins
CREATE POLICY "Users can view their own spins"
    ON public.roulette_spins
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own spins"
    ON public.roulette_spins
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Super admins can manage all spins"
    ON public.roulette_spins
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'super_admin'
        )
    );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_roulette_prizes_updated_at') THEN
        CREATE TRIGGER update_roulette_prizes_updated_at
            BEFORE UPDATE ON public.roulette_prizes
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_roulette_spins_updated_at') THEN
        CREATE TRIGGER update_roulette_spins_updated_at
            BEFORE UPDATE ON public.roulette_spins
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

-- Insert some default prizes
INSERT INTO public.roulette_prizes (label, description, prize_type, prize_value, probability, manual_approval_required)
VALUES 
('10% Off', 'Desconto de 10% na mensalidade', 'percentage_discount', 10, 0.5, false),
('20% Off', 'Desconto de 20% na mensalidade', 'percentage_discount', 20, 0.2, true),
('30% Off', 'Desconto de 30% na mensalidade', 'percentage_discount', 30, 0.1, true),
('Mês Grátis', 'Um mês de assinatura gratuita', 'fixed_discount', 100, 0.05, true);
