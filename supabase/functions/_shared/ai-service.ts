import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export interface AICallOptions {
  model?: string;
  messages: any[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: string };
  feature?: string;
  store_user_id?: string;
  user_id?: string;
  stream?: boolean;
}

export interface AICallResult {
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  provider: string;
  model: string;
}

export async function callAI(options: AICallOptions): Promise<AICallResult | Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Validation Check (can_use_ai)
  if (options.store_user_id) {
    const { data: validation, error: vError } = await supabase.rpc("can_use_ai", {
      p_tenant_id: options.store_user_id,
      p_feature: options.feature || "other",
      p_estimated_cost: 0 // We'll refine this later
    });

    if (vError || (validation && !validation[0]?.allowed)) {
      const reason = validation?.[0]?.reason || "IA bloqueada por limites ou configurações";
      throw new Error(`AI_BLOCKED: ${reason}`);
    }
  }

  // 2. Fetch AI Configuration from ai_providers (new system)
  const { data: activeProviders } = await supabase
    .from("ai_providers")
    .select("*")
    .eq("is_active", true);

  // Fallback to platform_settings for backward compatibility
  let providerData: any = activeProviders?.[0];
  let provider = providerData?.name?.toLowerCase() || "lovable";
  let apiKey = providerData?.api_key;
  
  if (!providerData) {
     const { data: oldSettings } = await supabase.from("platform_settings").select("key, value");
     const settings: Record<string, any> = {};
     oldSettings?.forEach(row => settings[row.key] = row.value?.value ?? row.value);
     
     provider = settings.ai_provider || "lovable";
     if (provider === "openai") apiKey = settings.ai_api_key_openai;
     else if (provider === "anthropic") apiKey = settings.ai_api_key_anthropic;
     else if (provider === "google") apiKey = settings.ai_api_key_google;
  }

  const model = options.model || providerData?.model_text_default || "gpt-4o-mini";
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

  let url = "";
  let headers: Record<string, string> = { "Content-Type": "application/json" };
  let body: any = {
    model: model,
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.max_tokens,
    stream: options.stream || false,
  };

  if (options.response_format) body.response_format = options.response_format;

  // Determine URL and Headers based on provider
  if (provider === "openai" && apiKey) {
    url = "https://api.openai.com/v1/chat/completions";
    headers["Authorization"] = `Bearer ${apiKey}`;
  } else if (provider === "anthropic" && apiKey) {
    url = "https://api.anthropic.com/v1/messages";
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
    
    const systemMessage = options.messages.find(m => m.role === "system")?.content;
    const userMessages = options.messages.filter(m => m.role !== "system");
    body = {
      model: model,
      system: systemMessage,
      messages: userMessages,
      max_tokens: options.max_tokens || 4096,
      stream: options.stream || false,
    };
  } else if (provider === "google" && apiKey) {
    url = `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions?key=${apiKey}`;
  } else {
    url = "https://ai.gateway.lovable.dev/v1/chat/completions";
    headers["Authorization"] = `Bearer ${lovableApiKey}`;
    if (provider === "lovable" && !options.model) {
      body.model = "google/gemini-1.5-flash";
    }
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI Provider Error: ${response.status} ${errorText}`);
    }

    if (options.stream) return response;

    const data = await response.json();
    let content = "";
    let usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    if (provider === "anthropic") {
      content = data.content?.[0]?.text || "";
      usage = {
        prompt_tokens: data.usage?.input_tokens || 0,
        completion_tokens: data.usage?.output_tokens || 0,
        total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      };
    } else {
      content = data.choices?.[0]?.message?.content || "";
      usage = {
        prompt_tokens: data.usage?.prompt_tokens || 0,
        completion_tokens: data.usage?.completion_tokens || 0,
        total_tokens: data.usage?.total_tokens || 0,
      };
    }

    // 3. Log Usage (Async)
    const costFactor = providerData?.cost_per_text_token || calculateFallbackCostFactor(provider, model);
    const estimatedCost = (usage.total_tokens / 1000) * costFactor;

    supabase.from("ai_usage_logs").insert({
      user_id: options.user_id,
      store_user_id: options.store_user_id,
      provider,
      model,
      tokens_prompt: usage.prompt_tokens,
      tokens_completion: usage.completion_tokens,
      total_tokens: usage.total_tokens,
      estimated_cost: estimatedCost,
      cost_billed: estimatedCost, // For now we bill estimated
      feature: options.feature,
      status: "success"
    }).then(({ error }) => {
      if (error) console.warn("Failed to log AI usage:", error);
    });

    return { content, usage, provider, model };
  } catch (error: any) {
    // Log failure
    supabase.from("ai_usage_logs").insert({
      user_id: options.user_id,
      store_user_id: options.store_user_id,
      provider,
      model,
      feature: options.feature,
      status: "error",
      error_message: error.message
    }).then(() => {});
    
    throw error;
  }
}

function calculateFallbackCostFactor(provider: string, model: string): number {
  if (model.includes("gpt-4o-mini")) return 0.01; // R$ per 1k tokens
  if (model.includes("gpt-4o")) return 0.15;
  if (model.includes("gemini-1.5-flash")) return 0.005;
  return 0.05;
}
