import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_PUSH_PER_DAY = 3;
const MIN_INTERVAL_MINUTES = 30;

// Randomized delay ranges (minutes) — scheduler picks a random point within range
const TRIGGER_DELAYS: Record<string, { min: number; max: number }> = {
  abandoned_cart: { min: 20, max: 45 },
  browsing: { min: 12, max: 50 },
  inactive: { min: 90, max: 420 },
};

// Returns a random delay within range for this customer (seeded by customer_id for consistency)
function randomDelayInRange(min: number, max: number, seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const ratio = (Math.abs(hash) % 1000) / 1000;
  return min + ratio * (max - min);
}

// ── Template pools (50+ per type) ──────────────────────────────────
const TEMPLATES: Record<string, { title: string; body: string }[]> = {
  abandoned_cart: [
    { title: "🛒 Seu carrinho está te esperando!", body: "{greetings}, {name}! Seus itens na {store} estão quase esgotando." },
    { title: "⏳ Não perca seus itens!", body: "{name}, finalize sua compra na {store} antes que acabe!" },
    { title: "🔥 Última chance!", body: "Os produtos no seu carrinho da {store} podem sair do estoque, {name}!" },
    { title: "💛 Esqueceu de algo?", body: "{greetings}, {name}! Volte e finalize na {store}." },
    { title: "🛍️ Falta pouco!", body: "{name}, seu carrinho na {store} está pronto. Só falta confirmar!" },
    { title: "⚡ Corre que dá tempo!", body: "{greetings}! {name}, seus produtos na {store} ainda estão lá." },
    { title: "🎯 Seus favoritos esperam", body: "{name}, os itens que você escolheu na {store} continuam disponíveis!" },
    { title: "💸 Feche o pedido!", body: "{greetings}, {name}! Não deixe escapar da {store}." },
    { title: "🚀 Finalize agora!", body: "{name}, aproveite enquanto seus itens da {store} ainda estão no carrinho." },
    { title: "🔔 Lembrete amigável", body: "{greetings}, {name}! Seu carrinho da {store} quer atenção." },
    { title: "😍 Boas escolhas!", body: "{name}, você tem ótimos produtos no carrinho da {store}!" },
    { title: "🏃 Vai deixar escapar?", body: "{greetings}! {name}, garanta já na {store}!" },
    { title: "💎 Itens reservados", body: "{name}, reservamos seus itens na {store}. Finalize!" },
    { title: "🎁 Quase lá!", body: "{greetings}, {name}! Sua compra na {store} está a um clique." },
    { title: "🛒 Carrinho ativo!", body: "Ei {name}, seu carrinho na {store} continua cheio de coisas boas!" },
    { title: "⭐ Não esqueça!", body: "{greetings}! {name}, seus produtos na {store} esperam por você." },
    { title: "🔥 Estoque limitado!", body: "{name}, os itens do seu carrinho da {store} estão acabando!" },
    { title: "💜 Voltou a tempo!", body: "{greetings}, {name}! Seus itens da {store} ainda estão disponíveis." },
    { title: "🎯 Só falta 1 passo!", body: "{name}, finalize e receba logo da {store}!" },
    { title: "⏰ O tempo está passando!", body: "{greetings}! {name}, feche seu pedido na {store}." },
    { title: "🛍️ Pensando ainda?", body: "{name}, aqueles itens da {store} estão quase esgotando!" },
    { title: "🌟 Decisão certa!", body: "{greetings}, {name}! Complete sua compra na {store} agora." },
    { title: "💥 Aproveite já!", body: "{name}, não deixe seu carrinho da {store} esfriar!" },
    { title: "🏷️ Reservado pra você", body: "{greetings}! {name}, a {store} guardou seus itens." },
    { title: "🤩 Achados incríveis!", body: "{name}, os produtos que escolheu na {store} são demais!" },
    { title: "🎉 Complete o pedido!", body: "{greetings}, {name}! A {store} está esperando sua confirmação." },
    { title: "🔓 Carrinho desbloqueado", body: "{name}, seus itens na {store} continuam salvos!" },
    { title: "🏆 Ótima seleção!", body: "{greetings}! {name}, garanta seus favoritos na {store}." },
    { title: "📦 Pronto pra enviar!", body: "{name}, a {store} já separou seus itens. Finalize!" },
    { title: "💫 Voltou? Ótimo!", body: "{greetings}, {name}! Aproveite e feche na {store}." },
    { title: "🛒 Ei, psiu!", body: "{name}, seu carrinho da {store} tá te chamando!" },
    { title: "🎯 Sem perder tempo!", body: "{greetings}! {name}, confirme logo na {store}!" },
    { title: "💰 Vale a pena!", body: "{name}, finalize e aproveite as ofertas da {store}!" },
    { title: "🔥 Hot deal no carrinho!", body: "{greetings}, {name}! Não perca os itens da {store}." },
    { title: "✨ Produtos esperando", body: "{name}, a {store} ainda tem seus itens reservados!" },
    { title: "🚨 Alerta de carrinho!", body: "{greetings}! {name}, finalize antes que acabe na {store}!" },
    { title: "🎁 Presente pra você!", body: "{name}, complete a compra na {store} e surpreenda-se!" },
    { title: "💪 Falta coragem?", body: "{greetings}, {name}! Pode confiar na {store}. Finalize!" },
    { title: "🛒 Carrinho saudoso", body: "{name}, seu carrinho da {store} sente sua falta!" },
    { title: "⚡ Rápido e fácil!", body: "{greetings}! {name}, um clique e pronto na {store}." },
    { title: "🌈 Bom gosto!", body: "{name}, seus itens da {store} são tendência. Garanta já!" },
    { title: "📱 Toque final!", body: "{greetings}, {name}! Só mais um toque para fechar na {store}." },
    { title: "🔔 Ding dong!", body: "{name}, seu carrinho da {store} está chamando!" },
    { title: "💎 Escolhas premium!", body: "{greetings}! {name}, finalize seus itens top da {store}." },
    { title: "🎊 Quase seu!", body: "{name}, os produtos da {store} já são quase seus!" },
    { title: "🚀 Decole com a {store}!", body: "{greetings}, {name}! Confirme e receba rapidinho." },
    { title: "⭐ Favoritos salvos!", body: "{name}, a {store} guardou tudo pra você. Aproveite!" },
    { title: "💕 Com carinho!", body: "{greetings}! {name}, a {store} preparou tudo. Só confirmar!" },
    { title: "🏃‍♀️ Corre, {name}!", body: "Seus itens na {store} estão voando das prateleiras!" },
    { title: "🎯 Missão: finalizar!", body: "{greetings}, {name}! Objetivo: fechar o carrinho da {store}." },
  ],
  browsing: [
    { title: "👀 Vimos você olhando!", body: "{greetings}, {name}! Encontrou algo na {store}? Volte e confira!" },
    { title: "🔍 Achou algo legal?", body: "{name}, a {store} tem novidades esperando por você!" },
    { title: "✨ Novidades pra você!", body: "{greetings}! {name}, confira o que há de novo na {store}." },
    { title: "🌟 Destaque do dia!", body: "{name}, a {store} separou produtos especiais. Dê uma olhada!" },
    { title: "🎯 Produtos pra você!", body: "{greetings}, {name}! A {store} tem sugestões baseadas no seu gosto." },
    { title: "💡 Inspiração!", body: "{name}, volte à {store} e descubra tendências incríveis!" },
    { title: "🔥 Produtos quentes!", body: "{greetings}! {name}, veja o que está bombando na {store}." },
    { title: "🛍️ Hora de comprar!", body: "{name}, a {store} tem ofertas imperdíveis agora." },
    { title: "👋 Oi, {name}!", body: "{greetings}! Que tal dar mais uma olhada na {store}?" },
    { title: "🎁 Surpresa na {store}!", body: "{name}, tem algo novo esperando você!" },
    { title: "💜 Pensando em você!", body: "{greetings}, {name}! A {store} separou itens que combinam com você." },
    { title: "🏷️ Preços especiais!", body: "{name}, aproveite as ofertas da {store} hoje!" },
    { title: "⚡ Flash de novidades!", body: "{greetings}! {name}, a {store} atualizou o catálogo." },
    { title: "🌈 Coisas lindas!", body: "{name}, a {store} tem produtos que você vai amar!" },
    { title: "🔔 Novidade na área!", body: "{greetings}, {name}! A {store} acabou de adicionar novos itens." },
    { title: "😍 Vai amar isso!", body: "{name}, veja as novidades da {store}. Você vai adorar!" },
    { title: "🎨 Estilo pra você!", body: "{greetings}! {name}, a {store} tem seu estilo." },
    { title: "💎 Achados!", body: "{name}, descubra os achados da {store} hoje!" },
    { title: "🌟 Curadoria especial!", body: "{greetings}, {name}! Seleção exclusiva na {store}." },
    { title: "🛒 Hora do shop!", body: "{name}, a {store} está cheia de novidades pra você!" },
    { title: "📱 Tá por aí?", body: "{greetings}! {name}, a {store} tem algo especial pra mostrar." },
    { title: "🎉 Lançamento!", body: "{name}, confira os lançamentos da {store}!" },
    { title: "🔥 Trending agora!", body: "{greetings}, {name}! Veja o que é tendência na {store}." },
    { title: "💫 Magia na {store}!", body: "{name}, produtos incríveis acabaram de chegar!" },
    { title: "🎯 Sob medida!", body: "{greetings}! {name}, a {store} preparou algo sob medida." },
    { title: "🏆 Best sellers!", body: "{name}, confira os mais vendidos da {store}!" },
    { title: "💰 Economize hoje!", body: "{greetings}, {name}! A {store} tem preços que cabem no bolso." },
    { title: "🌸 Que tal voltar?", body: "{name}, a {store} sentiu sua falta. Venha ver!" },
    { title: "⭐ 5 estrelas!", body: "{greetings}! {name}, veja os produtos mais bem avaliados da {store}." },
    { title: "🎊 Festa de ofertas!", body: "{name}, a {store} está em promoção!" },
    { title: "🤩 Imperdível!", body: "{greetings}, {name}! Ofertas imperdíveis na {store}." },
    { title: "📦 Chegou coisa nova!", body: "{name}, estoque renovado na {store}. Confira!" },
    { title: "💕 Escolhidos a dedo!", body: "{greetings}! {name}, curadoria especial da {store}." },
    { title: "🚀 Decolando!", body: "{name}, novos produtos estão decolando na {store}!" },
    { title: "🔓 Acesso exclusivo!", body: "{greetings}, {name}! Veja em primeira mão na {store}." },
    { title: "🎁 Mimo pra você!", body: "{name}, a {store} preparou um mimo. Venha conferir!" },
    { title: "💡 Dica do dia!", body: "{greetings}! {name}, dica: passe na {store} hoje." },
    { title: "🏃 Não perca!", body: "{name}, itens populares da {store} estão acabando!" },
    { title: "🌟 Brilha muito!", body: "{greetings}, {name}! Produtos brilhantes na {store}." },
    { title: "🛍️ Shopping time!", body: "{name}, a {store} está pronta pra você." },
    { title: "🎯 Na mosca!", body: "{greetings}! {name}, produtos certeiros na {store}." },
    { title: "💎 Peças únicas!", body: "{name}, a {store} tem peças exclusivas esperando!" },
    { title: "⚡ Relâmpago!", body: "{greetings}, {name}! Ofertas relâmpago na {store}." },
    { title: "🏷️ Etiqueta nova!", body: "{name}, novos preços na {store}. Confira!" },
    { title: "😊 {greetings}, {name}!", body: "A {store} tem novidades que combinam com você!" },
    { title: "🎨 Nova coleção!", body: "{greetings}! {name}, coleção novinha na {store}." },
    { title: "🔍 Descubra mais!", body: "{name}, explore o catálogo completo da {store}!" },
    { title: "💥 Boom de ofertas!", body: "{greetings}, {name}! Explosão de descontos na {store}." },
    { title: "🌈 Cores novas!", body: "{name}, a {store} renovou as cores. Venha ver!" },
    { title: "⭐ Recomendado!", body: "{greetings}! {name}, itens recomendados na {store}." },
  ],
  inactive: [
    { title: "💜 Sentimos sua falta!", body: "{greetings}, {name}! Faz tempo que não passa na {store}. Novidades te esperam!" },
    { title: "🌟 Voltou? Que bom!", body: "{name}, a {store} tem novidades desde sua última visita!" },
    { title: "😊 Oi, sumido!", body: "{greetings}! {name}, a {store} sente sua falta. Venha conferir!" },
    { title: "🎁 Presente de volta!", body: "{name}, a {store} preparou algo especial pra sua volta!" },
    { title: "💕 Saudades de você!", body: "{greetings}, {name}! A {store} tem novidades incríveis." },
    { title: "🔔 Temos novidades!", body: "{name}, muita coisa nova na {store} desde sua última visita!" },
    { title: "⭐ Você faz falta!", body: "{greetings}! {name}, a {store} não é a mesma sem você." },
    { title: "🌸 Bem-vindo de volta!", body: "{name}, a {store} renovou o catálogo. Dê uma olhada!" },
    { title: "🎉 Surpresa esperando!", body: "{greetings}, {name}! A {store} guardou surpresas pra você." },
    { title: "💎 Peças novas!", body: "{name}, peças exclusivas acabaram de chegar na {store}!" },
    { title: "🏆 Campeões de venda!", body: "{greetings}! {name}, veja os mais vendidos da {store}." },
    { title: "🔥 Tá perdendo!", body: "{name}, a {store} está com promoções que você não pode perder!" },
    { title: "📱 Ei, {name}!", body: "{greetings}! Passa na {store}, tem coisa boa!" },
    { title: "💫 Magia acontecendo!", body: "{name}, a {store} está mágica. Venha ver!" },
    { title: "🛍️ Hora de voltar!", body: "{greetings}, {name}! A {store} espera sua visita." },
    { title: "🌈 Arco-íris de ofertas!", body: "{name}, promoções coloridas na {store} hoje!" },
    { title: "🎯 Feito pra você!", body: "{greetings}! {name}, a {store} separou itens pro seu perfil." },
    { title: "💰 Economia total!", body: "{name}, a {store} tem preços que você vai adorar!" },
    { title: "🚀 Decolamos!", body: "{greetings}, {name}! Novos lançamentos na {store}!" },
    { title: "🤗 Abraço virtual!", body: "{name}, a {store} manda um abraço e convida pra voltar!" },
    { title: "💡 Sabia que…?", body: "{greetings}! {name}, a {store} renovou tudo. Confira!" },
    { title: "🎊 Festa na {store}!", body: "{name}, promoção especial esperando por você!" },
    { title: "🔓 Desbloqueie ofertas!", body: "{greetings}, {name}! Ofertas exclusivas na {store} agora." },
    { title: "⚡ Energia nova!", body: "{name}, a {store} está com energia renovada. Venha sentir!" },
    { title: "🌟 Estrela da vez!", body: "{greetings}! {name}, você é a estrela da {store}. Volte!" },
    { title: "📦 Chegaram coisas!", body: "{name}, estoque fresco na {store}. Primeira mão!" },
    { title: "💕 Com amor!", body: "{greetings}, {name}! A {store} preparou tudo com carinho." },
    { title: "🏃 Corre que é bom!", body: "{name}, a {store} tem ofertas por tempo limitado!" },
    { title: "🎨 Reinventamos!", body: "{greetings}! {name}, a {store} se reinventou. Confira!" },
    { title: "🏷️ Novos preços!", body: "{name}, a {store} remodelou os preços. Vale a pena!" },
    { title: "💥 Voltou melhor!", body: "{greetings}, {name}! A {store} voltou melhor. Venha ver!" },
    { title: "🎁 Miminho especial!", body: "{name}, a {store} tem um mimo esperando por você!" },
    { title: "😍 Imperdível!", body: "{greetings}! {name}, não perca as novidades da {store}." },
    { title: "🛒 Carrinho vazio?", body: "{name}, que tal encher o carrinho da {store} hoje?" },
    { title: "⭐ Top da semana!", body: "{greetings}, {name}! Destaques da semana na {store}." },
    { title: "🌸 Primavera de ofertas!", body: "{name}, floresça com as ofertas da {store}!" },
    { title: "🔔 Psiu, {name}!", body: "{greetings}! A {store} tem algo pra te contar." },
    { title: "💎 Exclusivo!", body: "{name}, acesso exclusivo a novidades da {store}!" },
    { title: "🎉 Celebre conosco!", body: "{greetings}, {name}! A {store} está celebrando com ofertas." },
    { title: "🚀 Missão: comprar!", body: "{name}, sua missão é conferir a {store} hoje!" },
    { title: "💜 Amor de loja!", body: "{greetings}! {name}, a {store} te ama. Volte!" },
    { title: "🏆 Merece o melhor!", body: "{name}, você merece os melhores da {store}!" },
    { title: "🔥 Quente demais!", body: "{greetings}, {name}! Ofertas quentes na {store}." },
    { title: "📱 Notícia boa!", body: "{name}, a {store} tem notícias boas pra você!" },
    { title: "💫 Brilhe com a {store}!", body: "{greetings}! {name}, produtos que fazem brilhar." },
    { title: "🎯 Alvo certeiro!", body: "{name}, a {store} acertou em cheio no seu gosto!" },
    { title: "💰 Poupe mais!", body: "{greetings}, {name}! Economia inteligente na {store}." },
    { title: "🌟 De volta ao jogo!", body: "{name}, a {store} espera você de volta!" },
    { title: "🎊 Novidade quente!", body: "{greetings}! {name}, lançamento fresquinho na {store}." },
    { title: "🤩 Vai se surpreender!", body: "{name}, a {store} tem surpresas. Venha ver!" },
  ],
};

// Product-aware templates — used when we know the product name
const PRODUCT_TEMPLATES: Record<string, { title: string; body: string }[]> = {
  abandoned_cart: [
    { title: "🛒 \"{product}\" espera por você!", body: "{greetings}, {name}! O \"{product}\" ainda está no seu carrinho na {store}." },
    { title: "⏳ Ainda pensando no \"{product}\"?", body: "{name}, garanta o \"{product}\" antes que acabe na {store}!" },
    { title: "🔥 \"{product}\" quase esgotando!", body: "{greetings}! {name}, corre que o \"{product}\" está acabando na {store}!" },
    { title: "💛 Não esquece do \"{product}\"!", body: "{name}, seu \"{product}\" da {store} tá te esperando!" },
    { title: "🎯 Falta pouco pro \"{product}\"!", body: "{greetings}, {name}! Finalize e leve o \"{product}\" da {store}." },
  ],
  browsing: [
    { title: "👀 Curtiu o \"{product}\"?", body: "{greetings}, {name}! O \"{product}\" da {store} combina com você!" },
    { title: "✨ \"{product}\" te esperando!", body: "{name}, volte e garanta o \"{product}\" na {store}!" },
    { title: "🔥 \"{product}\" é tendência!", body: "{greetings}! {name}, o \"{product}\" está bombando na {store}." },
    { title: "💜 Gostou do \"{product}\"?", body: "{name}, o \"{product}\" da {store} está disponível. Aproveite!" },
    { title: "🎁 \"{product}\" com desconto?", body: "{greetings}, {name}! Confira condições especiais do \"{product}\" na {store}." },
  ],
  inactive: [
    { title: "💜 Lembra do \"{product}\"?", body: "{greetings}, {name}! O \"{product}\" da {store} ainda espera por você." },
    { title: "🌟 \"{product}\" com novidades!", body: "{name}, o \"{product}\" que você viu na {store} pode ter preço novo!" },
    { title: "🔔 \"{product}\" disponível!", body: "{greetings}! {name}, o \"{product}\" da {store} está te chamando." },
    { title: "😊 Sentiu falta do \"{product}\"?", body: "{name}, volte à {store} e confira o \"{product}\"!" },
    { title: "🎯 \"{product}\" pra você!", body: "{greetings}, {name}! O \"{product}\" continua na {store}. Venha ver!" },
  ],
};

function pickTemplate(state: string, hasProduct = false): { title: string; body: string } {
  // 70% chance to use product template when product is available
  if (hasProduct && PRODUCT_TEMPLATES[state]?.length && Math.random() < 0.7) {
    const pool = PRODUCT_TEMPLATES[state];
    return pool[Math.floor(Math.random() * pool.length)];
  }
  const pool = TEMPLATES[state];
  if (!pool || pool.length === 0) return { title: "🔔 Novidade!", body: "Confira as novidades da loja!" };
  return pool[Math.floor(Math.random() * pool.length)];
}

function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] || "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const hour = now.getHours();
    const greetings = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

    // 1. Get actionable customer states
    const { data: states, error: stErr } = await supabase
      .from("customer_states")
      .select("*")
      .in("state", ["abandoned_cart", "browsing", "inactive"])
      .limit(500);

    if (stErr) throw stErr;
    if (!states || states.length === 0) return json({ processed: 0, message: "No actionable states" });

    // 2. Rate-limit data
    const customerIds = states.map((s: any) => s.customer_id);
    const { data: todayExecs } = await supabase
      .from("automation_executions")
      .select("customer_id, sent_at")
      .in("customer_id", customerIds)
      .gte("sent_at", todayStart)
      .order("sent_at", { ascending: false });

    const dailyCount = new Map<string, number>();
    const lastSentAt = new Map<string, Date>();
    for (const exec of todayExecs || []) {
      const cid = exec.customer_id;
      dailyCount.set(cid, (dailyCount.get(cid) || 0) + 1);
      if (!lastSentAt.has(cid)) lastSentAt.set(cid, new Date(exec.sent_at));
    }

    // 3. Customer + store lookups
    const { data: customers } = await supabase.from("customers").select("id, name, auth_user_id, store_user_id").in("id", customerIds);
    const customerMap = new Map((customers || []).map((c: any) => [c.id, c]));

    const storeIds = [...new Set(states.map((s: any) => s.store_user_id))];
    const { data: storeRows } = await supabase.from("store_settings").select("user_id, store_name, store_slug").in("user_id", storeIds);
    const storeMap = new Map((storeRows || []).map((s: any) => [s.user_id, s]));

    const authUserIds = (customers || []).map((c: any) => c.auth_user_id).filter(Boolean);
    const { data: pushSubs } = await supabase.from("push_subscriptions").select("user_id").in("user_id", authUserIds);
    const hasPush = new Set((pushSubs || []).map((s: any) => s.user_id));

    // 4. Fetch recent product views for personalization
    const { data: recentEvents } = await supabase
      .from("customer_behavior_events")
      .select("customer_id, product_id, event_type")
      .in("customer_id", customerIds.filter(Boolean))
      .in("event_type", ["product_view", "add_to_cart"])
      .order("created_at", { ascending: false })
      .limit(500);

    const customerLastProduct = new Map<string, string>();
    for (const ev of recentEvents || []) {
      if (ev.customer_id && ev.product_id && !customerLastProduct.has(ev.customer_id)) {
        customerLastProduct.set(ev.customer_id, ev.product_id);
      }
    }

    const productIds = [...new Set(customerLastProduct.values())];
    const productNameMap = new Map<string, string>();
    if (productIds.length > 0) {
      const { data: products } = await supabase.from("products").select("id, name").in("id", productIds);
      for (const p of products || []) productNameMap.set(p.id, p.name);
    }

    let sent = 0, skipped = 0;

    for (const state of states) {
      const customer = customerMap.get(state.customer_id);
      if (!customer?.auth_user_id || !hasPush.has(customer.auth_user_id)) { skipped++; continue; }
      if ((dailyCount.get(state.customer_id) || 0) >= MAX_PUSH_PER_DAY) { skipped++; continue; }

      const last = lastSentAt.get(state.customer_id);
      if (last && (now.getTime() - last.getTime()) < MIN_INTERVAL_MINUTES * 60 * 1000) { skipped++; continue; }

      const delays = TRIGGER_DELAYS[state.state];
      if (!delays) { skipped++; continue; }

      // Randomized delay per customer — natural, not robotic
      const targetDelay = randomDelayInRange(delays.min, delays.max, state.customer_id);
      const stateChangedAt = new Date(state.state_changed_at);
      const elapsedMin = (now.getTime() - stateChangedAt.getTime()) / (60 * 1000);
      if (elapsedMin < targetDelay) { skipped++; continue; }
      if (elapsedMin > delays.max * 3) { skipped++; continue; }

      const store = storeMap.get(state.store_user_id);
      const storeName = store?.store_name || store?.store_slug || "Loja";

      // Resolve product name for personalization
      const lastProductId = customerLastProduct.get(state.customer_id);
      const productName = lastProductId ? productNameMap.get(lastProductId) : undefined;

      // Pick random template and fill
      const tpl = pickTemplate(state.state, !!productName);
      const vars: Record<string, string> = {
        greetings, name: customer.name || "cliente",
        store: storeName, product: productName || "",
      };
      let title = fillTemplate(tpl.title, vars);
      let body = fillTemplate(tpl.body, vars);

      // AI rewrite with product context (50% chance)
      if (lovableApiKey && Math.random() > 0.5) {
        try {
          const ctx = productName ? `Produto visualizado: "${productName}". ` : "";
          const aiMsg = await aiRewrite(lovableApiKey, title, body, state.state, storeName, customer.name, greetings, ctx);
          if (aiMsg) { title = aiMsg.title; body = aiMsg.body; }
        } catch (e) { console.error("AI rewrite error:", e); }
      }

      // Send push — deep link to product if available
      try {
        const pushResp = await fetch(`${supabaseUrl}/functions/v1/send-push-internal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target_user_id: customer.auth_user_id,
            title, body,
            url: lastProductId ? `/produto/${lastProductId}` : "/",
            type: `behavior_${state.state}`,
            store_user_id: state.store_user_id,
          }),
        });
        const pushData = await pushResp.json();

        await supabase.from("automation_executions").insert({
          user_id: state.store_user_id,
          customer_id: state.customer_id,
          trigger_type: `behavior_${state.state}`,
          channel: "push",
          message_text: `${title} — ${body}`,
          ai_generated: !!lovableApiKey,
          status: pushData.sent > 0 ? "sent" : "failed",
          error_message: pushData.sent > 0 ? null : JSON.stringify(pushData).slice(0, 200),
          related_product_id: lastProductId || null,
        });

        if (pushData.sent > 0) sent++; else skipped++;
      } catch (err: any) {
        console.error("Push error:", err.message);
        skipped++;
      }
    }

    console.log(`[push-scheduler] Sent: ${sent}, Skipped: ${skipped}`);
    return json({ processed: states.length, sent, skipped });
  } catch (err: any) {
    console.error("[push-scheduler] Error:", err.message);
    return json({ error: err.message }, 500);
  }
});

async function aiRewrite(
  apiKey: string, baseTitle: string, baseBody: string,
  state: string, storeName: string, customerName: string, greetings: string,
  productContext = ""
): Promise<{ title: string; body: string } | null> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        {
          role: "system",
          content: `Reescreva esta notificação push para a loja "${storeName}". Mantenha curta e de alta conversão.
${productContext ? `CONTEXTO: ${productContext}` : ""}
REGRAS: Responda APENAS JSON: {"title":"...","body":"..."}
- title: máx 50 chars, comece com emoji diferente do original
- body: máx 130 chars${productContext ? ", mencione o produto pelo nome se possível" : ""}
- Use tom ${state === "abandoned_cart" ? "urgente mas gentil" : state === "browsing" ? "curioso e convidativo" : "carinhoso e acolhedor"}
- Varie palavras, emojis e estrutura do original
- Saudação: "${greetings}"`,
        },
        { role: "user", content: `Original: title="${baseTitle}" body="${baseBody}". Cliente: ${customerName}` },
      ],
      max_tokens: 150,
      temperature: 1.0,
    }),
  });

  if (!resp.ok) return null;
  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || "";
  const cleaned = content.replace(/```json\n?/g, "").replace(/```/g, "").trim();

  // Robust JSON extraction
  const jsonStart = cleaned.search(/\{/);
  const jsonEnd = cleaned.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) return null;

  try {
    const parsed = JSON.parse(cleaned.substring(jsonStart, jsonEnd + 1));
    if (parsed.title && parsed.body) return parsed;
  } catch {
    // Try fixing common issues
    try {
      const fixed = cleaned.substring(jsonStart, jsonEnd + 1)
        .replace(/,\s*}/g, "}").replace(/[\x00-\x1F\x7F]/g, "");
      const parsed = JSON.parse(fixed);
      if (parsed.title && parsed.body) return parsed;
    } catch { /* fall through */ }
  }
  return null;
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
