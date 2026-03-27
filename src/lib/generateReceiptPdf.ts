interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
  image_url?: string;
}

interface ReceiptData {
  orderId: string;
  date: string;
  storeName: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  paymentMethod: string;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

export function generateReceiptPdf(data: ReceiptData): void {
  // Build a printable HTML receipt and trigger print/save as PDF
  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Recibo - Pedido #${data.orderId.slice(0, 8)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1a1a; padding: 40px; max-width: 600px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #22c55e; padding-bottom: 20px; }
    .header h1 { font-size: 22px; color: #22c55e; margin-bottom: 4px; }
    .header .store { font-size: 14px; color: #666; }
    .header .badge { display: inline-block; background: #dcfce7; color: #16a34a; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-top: 8px; }
    .meta { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 13px; }
    .meta div { }
    .meta .label { color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    .meta .value { font-weight: 600; font-family: monospace; }
    .section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 8px; font-weight: 600; }
    .items { margin-bottom: 20px; }
    .item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; font-size: 13px; }
    .item-name { font-weight: 500; }
    .item-qty { color: #666; font-size: 12px; }
    .item-price { font-weight: 600; }
    .totals { margin-bottom: 20px; }
    .total-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
    .total-row.discount { color: #16a34a; }
    .total-row.grand { font-size: 18px; font-weight: 700; border-top: 2px solid #1a1a1a; padding-top: 8px; margin-top: 4px; }
    .total-row.grand .amount { color: #16a34a; }
    .info-box { background: #f9fafb; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; font-size: 13px; }
    .info-box .label { color: #888; font-size: 11px; text-transform: uppercase; }
    .info-box p { margin-top: 2px; }
    .customer { margin-bottom: 20px; }
    .customer p { font-size: 13px; padding: 2px 0; }
    .customer .cl { color: #888; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 11px; color: #aaa; }
    hr { border: none; border-top: 1px solid #eee; margin: 16px 0; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>✅ Recibo de Compra</h1>
    <div class="store">${data.storeName}</div>
    <div class="badge">Pagamento Confirmado</div>
  </div>

  <div class="meta">
    <div>
      <div class="label">📦 Pedido</div>
      <div class="value">#${data.orderId.slice(0, 8)}</div>
    </div>
    <div style="text-align:right">
      <div class="label">📅 Data</div>
      <div class="value">${data.date}</div>
    </div>
  </div>

  <hr>

  <div class="items">
    <div class="section-title">Itens</div>
    ${data.items.map(item => `
      <div class="item">
        <div>
          <div class="item-name">${item.name}</div>
          <div class="item-qty">${item.quantity}x ${formatPrice(item.price)}</div>
        </div>
        <div class="item-price">${formatPrice(item.price * item.quantity)}</div>
      </div>
    `).join("")}
  </div>

  <hr>

  <div class="totals">
    <div class="total-row">
      <span>Subtotal</span>
      <span>${formatPrice(data.subtotal)}</span>
    </div>
    ${data.discount > 0 ? `
    <div class="total-row discount">
      <span>🎟️ Desconto</span>
      <span>-${formatPrice(data.discount)}</span>
    </div>` : ""}
    ${data.shipping > 0 ? `
    <div class="total-row">
      <span>🚚 Frete</span>
      <span>${formatPrice(data.shipping)}</span>
    </div>` : ""}
    <div class="total-row grand">
      <span>Total</span>
      <span class="amount">${formatPrice(data.total)}</span>
    </div>
  </div>

  <div class="info-box">
    <div class="label">Forma de Pagamento</div>
    <p><strong>${data.paymentMethod}</strong></p>
  </div>

  ${(data.customerName || data.customerEmail) ? `
  <div class="info-box customer">
    <div class="section-title">Dados do Cliente</div>
    ${data.customerName ? `<p><span class="cl">Nome:</span> ${data.customerName}</p>` : ""}
    ${data.customerEmail ? `<p><span class="cl">E-mail:</span> ${data.customerEmail}</p>` : ""}
    ${data.customerPhone ? `<p><span class="cl">Telefone:</span> ${data.customerPhone}</p>` : ""}
    ${data.customerAddress ? `<p><span class="cl">Endereço:</span> ${data.customerAddress}</p>` : ""}
  </div>` : ""}

  <div class="footer">
    Documento gerado em ${data.date}<br>
    ${data.storeName} • Obrigado pela preferência! 💜
  </div>
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  }
}
