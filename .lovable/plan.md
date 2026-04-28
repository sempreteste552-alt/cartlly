## Reduzir cabeçalho da vitrine (mobile)

O cabeçalho da loja (ex: usebella.store) está ocupando espaço demais no topo no mobile, empurrando o banner principal para baixo. Vamos deixá-lo mais compacto sem alterar o banner/imagem do produto que aparece logo abaixo.

### Alterações em `src/pages/loja/LojaLayout.tsx`

1. **Reduzir padding vertical do header principal**
   - Linha 867: trocar `py-3` por `py-1.5 sm:py-2`.

2. **Diminuir botão do menu hamburguer no mobile**
   - Linha 868: adicionar `h-8 w-8` no botão (mantém ícone, reduz área).

3. **Reduzir altura da logo no mobile (mantendo no desktop)**
   - Linha 879: aplicar 75% do `logoSize` configurado no mobile (`< sm`) e manter o tamanho original a partir de `sm:`.
   - Aplicar via style inline no mobile + classe responsiva no `sm:` para o tamanho original.

### O que NÃO muda
- Banner/carousel de produtos (a imagem que o usuário pediu para preservar).
- Bottom nav (Início / Buscar / Carrinho / Avisos / Entrar).
- Cabeçalho do checkout (variante `isCheckout`, linhas 813–864).
- Tamanho da logo no desktop e configuração de `logo_size` do lojista.

Resultado: barra superior fica visivelmente mais fina no mobile, liberando ~20–25px de espaço útil para o conteúdo da loja.
