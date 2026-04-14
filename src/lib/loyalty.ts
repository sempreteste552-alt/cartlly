import { supabase } from "@/integrations/supabase/client";

export async function awardReferralReward(
  storeUserId: string,
  referredId: string,
  condition: "lead" | "sale",
  orderId?: string
) {
  try {
    // 1. Get the loyalty configuration
    const { data: config } = await supabase
      .from("loyalty_config" as any)
      .select("*")
      .eq("store_user_id", storeUserId)
      .maybeSingle();

    if (!config || !config.referral_enabled) return;
    
    // Check if the condition matches
    const configCondition = config.referral_reward_condition || "sale";
    if (configCondition !== condition) return;

    // 2. Find the pending referral for this customer
    const { data: referral } = await supabase
      .from("customer_referrals")
      .select("*")
      .eq("referred_id", referredId)
      .eq("status", "pending")
      .maybeSingle();

    if (!referral) return;

    // 3. Mark the referral as completed
    await supabase
      .from("customer_referrals")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        reward_type: config.referral_reward_type,
        reward_value: config.referral_reward_points,
        reward_description: config.referral_reward_description,
        order_id: orderId
      } as any)
      .eq("id", referral.id);

    // 4. If reward is points, award them to the referrer
    if (config.referral_reward_type === "points" && config.referral_reward_points > 0) {
      const referrerId = referral.referrer_id;
      const points = config.referral_reward_points;

      // Get or create loyalty points record for the referrer
      const { data: existingPoints } = await supabase
        .from("loyalty_points" as any)
        .select("*")
        .eq("customer_id", referrerId)
        .eq("store_user_id", storeUserId)
        .maybeSingle();

      if (existingPoints) {
        await supabase
          .from("loyalty_points" as any)
          .update({
            points_balance: (existingPoints.points_balance || 0) + points,
            lifetime_points: (existingPoints.lifetime_points || 0) + points,
            updated_at: new Date().toISOString()
          } as any)
          .eq("id", (existingPoints as any).id);
      } else {
        await supabase
          .from("loyalty_points" as any)
          .insert({
            customer_id: referrerId,
            store_user_id: storeUserId,
            points_balance: points,
            lifetime_points: points
          } as any);
      }

      // 5. Add a transaction record
      await supabase
        .from("loyalty_transactions" as any)
        .insert({
          customer_id: referrerId,
          store_user_id: storeUserId,
          points: points,
          type: "earning",
          description: `Bônus por indicação de amigo`,
          order_id: orderId
        } as any);
    }
  } catch (error) {
    console.error("Error awarding referral reward:", error);
  }
}
