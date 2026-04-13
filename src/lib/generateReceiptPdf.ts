
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
  storeLogoUrl?: string;
  storeAddress?: string;
  storePhone?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerCpf?: string;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  paymentMethod: string;
  notes?: string;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

export function generateReceiptPdf(data: ReceiptData): void {
  const shortId = data.orderId.slice(0, 8).toUpperCase();
  
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Recibo de Compra #${shortId}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Inter', sans-serif;
      color: #1a1a1a;
      background: #fff;
      font-size: 11px;
      line-height: 1.5;
      padding: 40px;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #f0f0f0;
    }

    .store-brand {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .logo {
      max-height: 50px;
      max-width: 200px;
      object-fit: contain;
    }

    .store-name {
      font-size: 18px;
      font-weight: 800;
      color: #000;
    }

    .receipt-info {
      text-align: right;
    }

    .receipt-title {
      font-size: 24px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: -0.5px;
      margin-bottom: 5px;
      color: #000;
    }

    .order-number {
      font-size: 14px;
      font-weight: 600;
      color: #666;
    }

    .details-grid {
      display: grid;
      grid-template-cols: 1fr 1fr;
      gap: 40px;
      margin-bottom: 40px;
    }

    .detail-section h3 {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #999;
      margin-bottom: 10px;
      border-bottom: 1px solid #f0f0f0;
      padding-bottom: 5px;
    }

    .detail-item {
      margin-bottom: 4px;
    }

    .detail-label {
      font-weight: 600;
      color: #444;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }

    th {
      text-align: left;
      padding: 12px 8px;
      background: #f9f9f9;
      border-bottom: 2px solid #eee;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.5px;
    }

    td {
      padding: 12px 8px;
      border-bottom: 1px solid #f0f0f0;
      vertical-align: middle;
    }

    .item-name {
      font-weight: 600;
      font-size: 12px;
    }

    .totals-container {
      display: flex;
      justify-content: flex-end;
      margin-top: 20px;
    }

    .totals-box {
      width: 300px;
      background: #fdfdfd;
      padding: 20px;
      border-radius: 8px;
      border: 1px solid #eee;
    }

    .total-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .total-row.grand-total {
      margin-top: 15px;
      padding-top: 15px;
      border-top: 2px solid #000;
      font-size: 16px;
      font-weight: 900;
      color: #000;
    }

    .notes-section {
      margin-top: 40px;
      padding: 15px;
      background: #f9f9f9;
      border-radius: 4px;
      border-left: 4px solid #eee;
    }

    .footer {
      margin-top: 60px;
      text-align: center;
      color: #aaa;
      font-size: 9px;
      border-top: 1px solid #f0f0f0;
      padding-top: 20px;
    }

    @media print {
      body { padding: 0; }
      .container { width: 100%; max-width: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="store-brand">
        ${data.storeLogoUrl ? `<img src="${data.storeLogoUrl}" class="logo" />` : `<div class="store-name">${data.storeName}</div>`}
        <div class="detail-item">
          <div class="detail-value">${data.storeAddress || ""}</div>
          <div class="detail-value">${data.storePhone || ""}</div>
        </div>
      </div>
      <div class="receipt-info">
        <h1 class="receipt-title">RECIBO</h1>
        <p class="order-number">Pedido #${shortId}</p>
        <p style="margin-top: 5px; color: #888;">Emitido em ${data.date}</p>
      </div>
    </div>

    <div class="details-grid">
      <div class="detail-section">
        <h3>Cliente</h3>
        <div class="detail-item">
          <p class="item-name">${data.customerName}</p>
          <p>${data.customerEmail || ""}</p>
          <p>${data.customerPhone || ""}</p>
          ${data.customerCpf ? `<p>CPF: ${data.customerCpf}</p>` : ""}
        </div>
      </div>
      <div class="detail-section">
        <h3>Entrega / Endereço</h3>
        <div class="detail-item">
          <p>${data.customerAddress || "Retirada em mãos"}</p>
          <p style="margin-top: 10px;"><span class="detail-label">Pagamento:</span> ${data.paymentMethod}</p>
        </div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 60%;">Descrição do Item</th>
          <th style="width: 10%; text-align: center;">Qtd</th>
          <th style="width: 15%; text-align: right;">Unitário</th>
          <th style="width: 15%; text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${data.items.map(item => `
          <tr>
            <td>
              <div class="item-name">${item.name}</div>
            </td>
            <td style="text-align: center;">${item.quantity}</td>
            <td style="text-align: right;">${formatPrice(item.price)}</td>
            <td style="text-align: right;">${formatPrice(item.price * item.quantity)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>

    <div class="totals-container">
      <div class="totals-box">
        <div class="total-row">
          <span>Subtotal:</span>
          <span>${formatPrice(data.subtotal)}</span>
        </div>
        ${data.shipping > 0 ? `
          <div class="total-row">
            <span>Frete:</span>
            <span>${formatPrice(data.shipping)}</span>
          </div>
        ` : ""}
        ${data.discount > 0 ? `
          <div class="total-row" style="color: #10b981;">
            <span>Desconto:</span>
            <span>-${formatPrice(data.discount)}</span>
          </div>
        ` : ""}
        <div class="total-row grand-total">
          <span>TOTAL:</span>
          <span>${formatPrice(data.total)}</span>
        </div>
      </div>
    </div>

    ${data.notes ? `
      <div class="notes-section">
        <p style="font-weight: 800; font-size: 9px; text-transform: uppercase; color: #999; margin-bottom: 5px;">Observações:</p>
        <p>${data.notes}</p>
      </div>
    ` : ""}

    <div class="footer">
      Obrigado pela sua compra na ${data.storeName}!<br/>
      Este documento não possui valor de Nota Fiscal Eletrônica oficial.
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
        window.close();
      }, 500);
    }
  </script>
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
