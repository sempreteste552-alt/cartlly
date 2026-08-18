import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const host = (url.searchParams.get("host") || "")
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "");

    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) {
      return new Response(JSON.stringify({ error: "invalid host" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let serves = false;
    let redirectsTo: string | null = null;

    try {
      const res = await fetch(`https://${host}/`, { method: "GET", redirect: "manual" });
      if (res.status >= 300 && res.status < 400) {
        redirectsTo = res.headers.get("location");
        // Redireciona para outro host => não serve a loja
        try {
          const target = new URL(redirectsTo || "", `https://${host}/`);
          serves = target.hostname.replace(/^www\./, "") === host.replace(/^www\./, "");
        } catch {
          serves = false;
        }
      } else {
        serves = res.status >= 200 && res.status < 300;
      }
    } catch (_e) {
      serves = false;
    }

    return new Response(JSON.stringify({ host, serves, redirectsTo }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
