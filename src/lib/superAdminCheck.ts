import { supabase } from "@/integrations/supabase/client";

/**
 * Check if a given user ID has the super_admin role.
 * Uses the user_roles table — no hardcoded emails.
 */
export async function checkIsSuperAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (error) return false;
  return !!data;
}
