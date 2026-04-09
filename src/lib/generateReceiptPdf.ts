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
  customerCpf?: string;
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
  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Comprovante - Pedido #${data.orderId.slice(0, 8)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      color: #1a1a1a; 
      padding: 40px; 
      background-color: #f4f4f7;
    }
    .receipt {
      max-width: 500px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      border-radius: 24px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.05);
      border: 1px solid #eee;
    }
    .header { text-align: center; margin-bottom: 30px; }
    .header .icon { 
      width: 60px; height: 60px; 
      background: #e7f9ee; 
      border-radius: 50%; 
      margin: 0 auto 16px; 
      display: flex; align-items: center; justify-content: center;
      color: #22c55e;
      font-size: 32px;
    }
    .header h1 { font-size: 18px; color: #1a1a1a; margin-bottom: 4px; font-weight: 700; }
    .header p { font-size: 14px; color: #666; }

    .amount-section {
      text-align: center;
      padding: 30px 0;
      border-bottom: 1px dashed #eee;
      margin-bottom: 30px;
    }
    .amount-section .label { 
      font-size: 10px; 
      text-transform: uppercase; 
      letter-spacing: 1px; 
      color: #999; 
      font-weight: 700;
      margin-bottom: 8px;
    }
    .amount-section .value { 
      font-size: 36px; 
      font-weight: 800; 
      color: #1a1a1a; 
      letter-spacing: -1px;
    }
    .status-badge {
      display: inline-block;
      background: #e7f9ee;
      color: #16a34a;
      padding: 4px 12px;
      border-radius: 100px;
      font-size: 12px;
      font-weight: 600;
      margin-top: 12px;
    }

    .info-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 24px; margin-bottom: 30px; }
    .info-item .label { font-size: 10px; text-transform: uppercase; color: #999; font-weight: 700; margin-bottom: 4px; }
    .info-item .value { font-size: 13px; font-weight: 600; color: #1a1a1a; }

    .items-section { margin-bottom: 30px; }
    .section-title { font-size: 11px; text-transform: uppercase; color: #999; font-weight: 700; margin-bottom: 16px; }
    .item { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 13px; }
    .item-info { flex: 1; }
    .item-name { font-weight: 600; color: #1a1a1a; }
    .item-meta { font-size: 12px; color: #666; margin-top: 2px; }
    .item-price { font-weight: 700; color: #1a1a1a; }

    .summary-box { 
      background: #f9fafb; 
      border-radius: 16px; 
      padding: 20px; 
      margin-bottom: 30px;
    }
    .summary-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; color: #666; }
    .summary-row.total { 
      margin-top: 12px; 
      padding-top: 12px; 
      border-top: 1px solid #eee; 
      font-weight: 700; 
      color: #1a1a1a;
      font-size: 15px;
    }

    .footer { text-align: center; color: #999; font-size: 11px; margin-top: 40px; }
    
    @media print {
      body { background: white; padding: 0; }
      .receipt { box-shadow: none; border: none; width: 100%; max-width: none; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <div class="icon">✓</div>
      <h1>Comprovante de Compra</h1>
      <p>Operação realizada com sucesso</p>
    </div>

    <div class="amount-section">
      <div class="label">Valor Total</div>
      <div class="value">${formatPrice(data.total)}</div>
      <div class="status-badge">Confirmado</div>
    </div>

    <div class="info-grid">
      <div class="info-item">
        <div class="label">Data e Hora</div>
        <div class="value">${data.date}</div>
      </div>
      <div class="info-item" style="text-align: right">
        <div class="label">ID da Transação</div>
        <div class="value">#${data.orderId.slice(0, 18).toUpperCase()}</div>
      </div>
      <div class="info-item">
        <div class="label">Destinatário</div>
        <div class="value">${data.storeName}</div>
      </div>
      <div class="info-item" style="text-align: right">
        <div class="label">Pagador</div>
        <div class="value">${data.customerName}</div>
      </div>
    </div>

    <div class="items-section">
      <div class="section-title">Detalhamento dos Itens</div>
      ${data.items.map(item => `
        <div class="item">
          <div class="item-info">
            <div class="item-name">${item.name}</div>
            <div class="item-meta">${item.quantity}x • ${formatPrice(item.price)}</div>
          </div>
          <div class="item-price">${formatPrice(item.price * item.quantity)}</div>
        </div>
      `).join("")}
    </div>

    <div class="summary-box">
      <div class="summary-row">
        <span>Subtotal</span>
        <span>${formatPrice(data.subtotal)}</span>
      </div>
      ${data.discount > 0 ? `
      <div class="summary-row" style="color: #16a34a">
        <span>Desconto</span>
        <span>-${formatPrice(data.discount)}</span>
      </div>` : ""}
      ${data.shipping > 0 ? `
      <div class="summary-row">
        <span>Frete</span>
        <span>${formatPrice(data.shipping)}</span>
      </div>` : ""}
      <div class="summary-row total">
        <span>Total Pago</span>
        <span>${formatPrice(data.total)}</span>
      </div>
    </div>

    <div class="info-item">
      <div class="label">Forma de Pagamento</div>
      <div class="value">${data.paymentMethod}</div>
    </div>

    <div class="footer">
      Comprovante gerado eletronicamente em ${data.date}<br>
      Este documento serve como recibo de sua transação.
    </div>
  </div>
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);
  }
}
