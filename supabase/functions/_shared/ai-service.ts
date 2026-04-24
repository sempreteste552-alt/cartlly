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

  // 1. Fetch AI Configuration from platform_settings
  const { data: settingsData } = await supabase
    .from("platform_settings")
    .select("key, value");

  const settings: Record<string, any> = {};
  settingsData?.forEach(row => {
    settings[row.key] = row.value?.value ?? row.value;
  });

  const provider = settings.ai_provider || "lovable";
  const model = options.model || settings.ai_model || (provider === "lovable" ? "google/gemini-1.5-flash" : "gpt-4o");
  const openaiKey = settings.ai_api_key_openai;
  const anthropicKey = settings.ai_api_key_anthropic;
  const googleKey = settings.ai_api_key_google;
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

  if (options.response_format) {
    body.response_format = options.response_format;
  }

  // Determine URL and Headers based on provider
  if (provider === "openai" && openaiKey) {
    url = "https://api.openai.com/v1/chat/completions";
    headers["Authorization"] = `Bearer ${openaiKey}`;
  } else if (provider === "anthropic" && anthropicKey) {
    url = "https://api.anthropic.com/v1/messages";
    headers["x-api-key"] = anthropicKey;
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
  } else if (provider === "google" && googleKey) {
    url = `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions?key=${googleKey}`;
  } else {
    url = "https://ai.gateway.lovable.dev/v1/chat/completions";
    headers["Authorization"] = `Bearer ${lovableApiKey}`;
    if (provider === "lovable" && !options.model) {
      body.model = "google/gemini-1.5-flash";
    }
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`AI provider error (${provider}):`, errorText);
    throw new Error(`AI Provider Error: ${response.status} ${errorText}`);
  }

  // If streaming, return the response object directly
  if (options.stream) {
    return response;
  }

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
  const estimatedCost = calculateEstimatedCost(provider, model, usage);
  supabase.from("ai_usage_logs").insert({
    user_id: options.user_id,
    store_user_id: options.store_user_id,
    provider,
    model,
    tokens_prompt: usage.prompt_tokens,
    tokens_completion: usage.completion_tokens,
    estimated_cost: estimatedCost,
    feature: options.feature,
  }).then(({ error }) => {
    if (error) console.warn("Failed to log AI usage:", error);
  });

  return {
    content,
    usage,
    provider,
    model,
  };
}

function calculateEstimatedCost(provider: string, model: string, usage: { prompt_tokens: number, completion_tokens: number }): number {
  let promptPrice = 0;
  let completionPrice = 0;

  if (model.includes("gpt-4o-mini")) {
    promptPrice = 0.15;
    completionPrice = 0.60;
  } else if (model.includes("gpt-4o")) {
    promptPrice = 5.0;
    completionPrice = 15.0;
  } else if (model.includes("gemini-1.5-flash")) {
    promptPrice = 0.075;
    completionPrice = 0.30;
  } else if (model.includes("claude-3-haiku")) {
    promptPrice = 0.25;
    completionPrice = 1.25;
  } else {
    promptPrice = 1.0;
    completionPrice = 3.0;
  }

  const cost = ((usage.prompt_tokens / 1000000) * promptPrice) + ((usage.completion_tokens / 1000000) * completionPrice);
  return cost * 5.5; 
}
