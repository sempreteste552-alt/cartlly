import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // Update email and password
  const { error } = await adminClient.auth.admin.updateUserById(
    "215f62c8-b56c-4724-bc3f-c8e29b9399b5",
    {
      email: "isabelarocha9550@gmail.com",
      password: "Usebella12",
      email_confirm: true,
    }
  );

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }));
});
