-- Insert "Não foi dessa vez" prize
INSERT INTO public.roulette_prizes (
  label, 
  description, 
  prize_type, 
  prize_value, 
  probability, 
  min_subscription_tier, 
  is_active, 
  manual_approval_required
) VALUES (
  'Não foi dessa vez', 
  'Nenhum prêmio concedido', 
  'none', 
  0, 
  0.5, 
  'FREE', 
  true, 
  false
) ON CONFLICT DO NOTHING;

-- Add global settings for roulette
INSERT INTO public.platform_settings (key, value)
VALUES 
  ('roulette_payouts_enabled', '{"value": false}'),
  ('roulette_lose_probability', '{"value": 0.5}')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
