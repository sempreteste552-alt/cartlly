---
name: Personalidade IA nicho adaptativo
description: Motor de IA adapta tom e mensagens ao nicho da loja com anti-repetição por cliente
type: architecture
---
- O motor de IA adapta o tom de voz ao nicho da loja e aplica regras estritas de contextualização temporal (ex: evita 'Bom dia' à noite)
- No painel 'Cérebro IA', o lojista configura o nicho, personalidade e base de conhecimento via tabela 'tenant_ai_brain_config'
- O push-scheduler carrega a config AI de cada tenant (niche, personality, store_knowledge, custom_instructions) e a passa para a geração de mensagens
- Cada mensagem AI gerada recebe as últimas 15 mensagens enviadas para AQUELE CLIENTE ESPECÍFICO (isolamento por tenant + cliente)
- O sistema proíbe repetição de frase, abertura, CTA, ideia principal e lógica semântica
- As mensagens de engajamento horário agora são geradas por IA quando LOVABLE_API_KEY disponível, usando contexto completo do tenant
- Fallback para templates estáticos quando IA não disponível
- Isolamento total entre tenants: cada loja tem sua própria identidade, estilo e configuração de IA
