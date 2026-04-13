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

    // 2. Get user tier
    const { data: sub } = await supabaseClient
      .from('tenant_subscriptions')
      .select('*, tenant_plans(name)')
      .eq('user_id', user.id)
      .maybeSingle()

    const tier = sub?.tenant_plans?.name || 'FREE'

    // 3. Fetch eligible prizes
    const { data: prizes } = await supabaseClient
      .from('roulette_prizes')
      .select('*')
      .eq('is_active', true)

    const tierHierarchy: Record<string, number> = { 'FREE': 0, 'STARTER': 1, 'PRO': 2, 'PREMIUM': 3 }
    const currentTierLevel = tierHierarchy[tier] || 0

    const eligiblePrizes = (prizes || []).filter(p => {
      const minLevel = tierHierarchy[p.min_subscription_tier] || 0
      return currentTierLevel >= minLevel
    })

    if (eligiblePrizes.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum prêmio disponível para seu plano.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // 4. Weighted random selection
    const totalWeight = eligiblePrizes.reduce((sum, p) => sum + p.probability, 0)
    let random = Math.random() * totalWeight
    let selectedPrize = eligiblePrizes[0]

    for (const p of eligiblePrizes) {
      if (random < p.probability) {
        selectedPrize = p
        break
      }
      random -= p.probability
    }

    // 5. Record the spin
    const status = selectedPrize.manual_approval_required ? 'pending_approval' : 'won'
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
