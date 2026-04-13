import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')!
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    // 1. Check if user already spun today
    const { data: lastSpin } = await supabaseClient
      .from('roulette_spins')
      .select('created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastSpin) {
      const lastSpinDate = new Date(lastSpin.created_at)
      const now = new Date()
      if (now.getTime() - lastSpinDate.getTime() < 24 * 60 * 60 * 1000) {
        return new Response(JSON.stringify({ error: 'Você já girou hoje. Volte amanhã!' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }
    }

    // 2. Get platform settings for roulette
    const { data: platformSettings } = await supabaseClient
      .from('platform_settings')
      .select('key, value')
      .in('key', ['roulette_payouts_enabled', 'roulette_lose_probability'])

    const settings = platformSettings?.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value?.value;
      return acc;
    }, {}) || { roulette_payouts_enabled: false, roulette_lose_probability: 0.5 };

    const payoutsEnabled = settings.roulette_payouts_enabled === true;

    // 3. Get user tier
    const { data: sub } = await supabaseClient
      .from('tenant_subscriptions')
      .select('*, tenant_plans(name)')
      .eq('user_id', user.id)
      .maybeSingle()

    const tier = (sub?.tenant_plans?.name || 'FREE').toUpperCase()

    // 4. Fetch eligible prizes
    const { data: prizes } = await supabaseClient
      .from('roulette_prizes')
      .select('*')
      .eq('is_active', true)

    const tierHierarchy: Record<string, number> = { 'FREE': 0, 'STARTER': 1, 'PRO': 2, 'PREMIUM': 3 }
    const currentTierLevel = tierHierarchy[tier] || 0

    let eligiblePrizes = (prizes || []).filter(p => {
      // Regra especial: Premium só ganha descontos ou "Não foi dessa vez"
      if (tier === 'PREMIUM') {
        return p.label.includes('%') || p.label === 'Não foi dessa vez';
      }
      
      const minLevel = tierHierarchy[p.min_subscription_tier] || 0
      return currentTierLevel >= minLevel
    })

    if (eligiblePrizes.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum prêmio disponível para seu plano.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // 5. Decide if it's a win or loss
    let selectedPrize;
    const losePrize = eligiblePrizes.find(p => p.label === 'Não foi dessa vez');
    
    if (!payoutsEnabled && losePrize) {
      // Force loss if payouts are disabled
      selectedPrize = losePrize;
    } else {
      // Weighted random selection
      const totalWeight = eligiblePrizes.reduce((sum, p) => sum + p.probability, 0)
      let random = Math.random() * totalWeight
      selectedPrize = eligiblePrizes[0]

      for (const p of eligiblePrizes) {
        if (random < p.probability) {
          selectedPrize = p
          break
        }
        random -= p.probability
      }
    }

    // 6. Record the spin
    const status = selectedPrize.manual_approval_required ? 'pending_approval' : 
                   selectedPrize.label === 'Não foi dessa vez' ? 'lost' : 'won'
    
    const { data: spin, error: insertError } = await supabaseClient
      .from('roulette_spins')
      .insert({
        user_id: user.id,
        prize_id: selectedPrize.id,
        status: status,
      })
      .select()
      .single()

    if (insertError) throw insertError

    return new Response(JSON.stringify({ prize: selectedPrize, spin }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})