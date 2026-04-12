import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// This is the domain tenants should CNAME to. 
// If using Cloudflare for SaaS, this should be the fallback domain.
const RECOMMENDED_CNAME = "cartlly.lovable.app"; 

async function resolveDns(name: string, type: string) {
  try {
    const response = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`);
    return await response.json();
  } catch (e) {
    console.error(`DNS Resolution Error (${type} for ${name}):`, e);
    return {};
  }
}

function normalizeDnsValue(value: string) {
  return value.trim().toLowerCase().replace(/\.$/, "").replace(/"/g, "");
}

async function registerCloudflareCustomHostname(hostname: string) {
  const token = Deno.env.get("CLOUDFLARE_API_TOKEN");
  const zoneId = Deno.env.get("CLOUDFLARE_ZONE_ID");

  if (!token || !zoneId) {
    console.log(`Cloudflare config missing: TOKEN=${!!token}, ZONE_ID=${!!zoneId}`);
    return { success: false, error: "Cloudflare configuration missing (TOKEN or ZONE_ID)" };
  }

  try {
    console.log(`Registering Custom Hostname in Cloudflare: ${hostname}`);
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hostname: hostname,
          ssl: {
            method: "http",
            type: "dv",
          },
        }),
      }
    );

    const data = await response.json();
    if (!data.success) {
      // Check if it already exists (Error code 1406)
      if (data.errors?.some((e: any) => e.code === 1406)) {
        console.log(`Hostname ${hostname} already registered in Cloudflare.`);
        return { success: true, already_exists: true };
      }
      console.error(`Cloudflare API Error:`, data.errors);
      return { success: false, error: data.errors?.[0]?.message || "Cloudflare API Error" };
    }

    console.log(`Successfully registered ${hostname} in Cloudflare.`);
    return { success: true, data: data.result };
  } catch (e: any) {
    console.error(`Cloudflare API Exception:`, e);
    return { success: false, error: e.message };
  }
}

async function checkHttps(domain: string) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(`https://${domain}`, {
      method: "HEAD",
      redirect: "manual",
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    // If we get any response from the domain on HTTPS, it means SSL is at least somewhat working
    if (response.status >= 200 && response.status < 500) {
      return { ready: true, error: null };
    }
    return { ready: false, error: `Status ${response.status} returned` };
  } catch (error: any) {
    // If we get a certificate error, it will show up here
    return { ready: false, error: error.message || "SSL certificate not active or unreachable" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { settingsId, domain, domainId } = body;
    
    if (!settingsId || (!domain && !domainId)) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Fetch domain record
    let domainRecord;
    if (domainId) {
      const { data } = await supabase.from("store_domains").select("*").eq("id", domainId).maybeSingle();
      domainRecord = data;
    } else {
      const { data } = await supabase.from("store_domains").select("*").eq("store_id", settingsId).eq("hostname", domain).maybeSingle();
      domainRecord = data;
    }

    if (!domainRecord) {
      return new Response(JSON.stringify({ error: "Domain not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hostname = domainRecord.hostname;
    const isWww = hostname.startsWith("www.");
    const apexDomain = isWww ? hostname.substring(4) : hostname;
    const verificationHost = `_lovable.${apexDomain}`;
    const verificationToken = domainRecord.verification_token;
    const expectedTxt = `lovable_verify=${verificationToken}`;

    // 2. Perform DNS Checks
    const dnsResults: any = {
      cname: { found: false, value: null, correct: false },
      txt: { found: false, value: [], correct: false },
      a: { found: false, values: [] },
      conflicts: [],
    };

    // A. Check CNAME for the actual hostname
    const cnameData = await resolveDns(hostname, "CNAME");
    if (cnameData.Answer) {
      const record = cnameData.Answer.find((r: any) => r.type === 5);
      if (record) {
        dnsResults.cname.found = true;
        dnsResults.cname.value = normalizeDnsValue(record.data);
        // Accept either the recommended one or the project one
        dnsResults.cname.correct = dnsResults.cname.value === RECOMMENDED_CNAME || dnsResults.cname.value.endsWith(".lovable.app");
      }
    }

    // B. Check TXT for verification
    const txtData = await resolveDns(verificationHost, "TXT");
    if (txtData.Answer) {
      const records = txtData.Answer.filter((r: any) => r.type === 16).map((r: any) => normalizeDnsValue(r.data));
      dnsResults.txt.found = records.length > 0;
      dnsResults.txt.value = records;
      dnsResults.txt.correct = records.some((r: string) => r.includes(expectedTxt) || r.includes(verificationToken));
    }

    // C. Check for Apex domain A records (Conflicts for www)
    if (isWww) {
      const apexAData = await resolveDns(apexDomain, "A");
      if (apexAData.Answer) {
        dnsResults.a.values = apexAData.Answer.filter((r: any) => r.type === 1).map((r: any) => r.data);
        dnsResults.a.found = dnsResults.a.values.length > 0;
      }
    }

    // 3. Cloudflare & SSL Check
    let cloudflareResult = null;
    let sslResult = { ready: false, error: "Aguardando verificação DNS e TXT" };

    if (dnsResults.txt.correct || dnsResults.cname.correct) {
      // Register in Cloudflare SSL for SaaS if CNAME is pointing correctly
      if (dnsResults.cname.correct) {
        cloudflareResult = await registerCloudflareCustomHostname(hostname);
      }
      
      sslResult = await checkHttps(hostname);
    }

    // 4. Update Statuses
    const txtStatus = dnsResults.txt.correct ? "verified" : "pending";
    
    let dnsStatus = "pending";
    if (dnsResults.cname.correct) {
      dnsStatus = "propagated";
    } else if (dnsResults.cname.found) {
      dnsStatus = "failed";
    }

    let sslStatus = "pending";
    if (sslResult.ready) {
      sslStatus = "active";
    } else if (dnsStatus === "propagated" && txtStatus === "verified") {
      sslStatus = "emitting";
    } else if (sslResult.error && !sslResult.error.includes("Aguardando")) {
      sslStatus = "failed";
      // If Cloudflare failed, add it to the error
      if (cloudflareResult && !cloudflareResult.success) {
        sslResult.error = `${sslResult.error} (Cloudflare: ${cloudflareResult.error})`;
      }
    }

    // Final Domain Status
    let finalStatus = "pending_dns";
    if (sslStatus === "active") finalStatus = "active";
    else if (sslStatus === "emitting") finalStatus = "pending_ssl";
    else if (txtStatus === "verified" && dnsStatus === "propagated") finalStatus = "pending_ssl";
    else if (txtStatus === "verified") finalStatus = "pending_dns";

    const updateData = {
      status: finalStatus,
      txt_status: txtStatus,
      dns_status: dnsStatus,
      ssl_status: sslStatus,
      last_verified_at: new Date().toISOString(),
      dns_validation_details: dnsResults,
      ssl_validation_details: sslResult,
      last_ssl_error: sslResult.error,
    };

    await supabase.from("store_domains").update(updateData).eq("id", domainRecord.id);

    // Sync with store_settings if primary
    if (domainRecord.is_primary && finalStatus === "active") {
      await supabase.from("store_settings").update({
        custom_domain: hostname,
        domain_status: "verified"
      } as any).eq("id", settingsId);
    }

    return new Response(
      JSON.stringify({
        status: finalStatus,
        dns: dnsResults,
        ssl: sslResult,
        txtStatus,
        dnsStatus,
        sslStatus
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in verify-domain:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
