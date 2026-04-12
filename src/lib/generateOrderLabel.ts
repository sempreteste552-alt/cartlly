
interface OrderLabelItem {
  name: string;
  quantity: number;
  variation?: string;
  price: number;
}

interface OrderLabelData {
  orderId: string;
  date: string;
  customerName: string;
  customerPhone?: string;
  customerCpf?: string;
  customerEmail?: string;
  // Address fields
  customerAddress?: string;
  shippingStreet?: string;
  shippingNumber?: string;
  shippingComplement?: string;
  shippingNeighborhood?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingCep?: string;
  // Sender
  storeName: string;
  storeLogo?: string;
  storeCity?: string;
  storeState?: string;
  storePhone?: string;
  storeEmail?: string;
  storeCep?: string;
  // Order
  items: OrderLabelItem[];
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  notes?: string;
  // Shipping
  shippingMethod?: string;
  shippingType?: string;
  trackingCode?: string;
  estimatedDelivery?: string;
  shippingCost?: number;
}

export function generateOrderLabel(data: OrderLabelData): void {
  const formatPrice = (price: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

  const shortId = data.orderId.slice(0, 8).toUpperCase();
  const barcodeValue = data.orderId.replace(/-/g, "").slice(0, 20);

  const fullAddress = buildFullAddress(data);
  const maskedCpf = data.customerCpf
    ? data.customerCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.***.***-$4")
    : "";

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Etiqueta de Envio #${shortId}</title>
  <style>
    @page { size: 148mm 105mm; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', Courier, monospace;
      width: 148mm;
      min-height: 105mm;
      padding: 4mm;
      font-size: 10px;
      line-height: 1.3;
      color: #000;
      background: #fff;
    }
    .label-container {
      border: 2px solid #000;
      width: 100%;
      min-height: 97mm;
    }

    /* ── HEADER ── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 3mm 4mm;
      border-bottom: 2px solid #000;
      background: #f5f5f5;
    }
    .header-left { display: flex; align-items: center; gap: 6px; }
    .header-logo { max-height: 22px; max-width: 80px; object-fit: contain; }
    .header-store { font-weight: bold; font-size: 12px; text-transform: uppercase; }
    .header-right { text-align: right; }
    .header-order {
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 1px;
      background: #000;
      color: #fff;
      padding: 2px 8px;
      display: inline-block;
      margin-bottom: 2px;
    }
    .header-date { font-size: 9px; color: #444; }

    /* ── BODY GRID ── */
    .body-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      min-height: 58mm;
    }

    /* ── DESTINATÁRIO ── */
    .dest-section {
      padding: 3mm 4mm;
      border-right: 1px dashed #999;
    }
    .section-label {
      font-size: 8px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #666;
      margin-bottom: 2px;
      border-bottom: 1px solid #ccc;
      padding-bottom: 1px;
    }
    .dest-name {
      font-size: 13px;
      font-weight: 900;
      text-transform: uppercase;
      margin: 3px 0 2px;
    }
    .dest-address {
      font-size: 10px;
      margin-top: 2px;
      line-height: 1.4;
    }
    .dest-cep {
      font-size: 18px;
      font-weight: 900;
      letter-spacing: 2px;
      margin-top: 4px;
      background: #000;
      color: #fff;
      display: inline-block;
      padding: 1px 8px;
    }
    .dest-phone { font-size: 9px; margin-top: 3px; }
    .dest-cpf { font-size: 9px; color: #666; }

    /* ── RIGHT COLUMN ── */
    .right-col { display: flex; flex-direction: column; }

    /* ── REMETENTE ── */
    .sender-section {
      padding: 3mm 4mm;
      border-bottom: 1px dashed #999;
      flex: 0 0 auto;
    }
    .sender-name { font-weight: bold; font-size: 10px; text-transform: uppercase; }
    .sender-info { font-size: 9px; color: #444; }

    /* ── ENVIO ── */
    .shipping-section {
      padding: 3mm 4mm;
      border-bottom: 1px dashed #999;
      flex: 0 0 auto;
    }
    .shipping-method {
      font-weight: bold;
      font-size: 11px;
      text-transform: uppercase;
    }
    .shipping-detail { font-size: 9px; color: #444; }
    .tracking-code {
      font-family: monospace;
      font-size: 11px;
      font-weight: bold;
      letter-spacing: 1px;
      background: #eee;
      padding: 2px 6px;
      margin-top: 2px;
      display: inline-block;
    }

    /* ── ITEMS ── */
    .items-section {
      padding: 3mm 4mm;
      flex: 1 1 auto;
    }
    .items-table { width: 100%; font-size: 9px; border-collapse: collapse; }
    .items-table th {
      text-align: left;
      font-size: 8px;
      border-bottom: 1px solid #999;
      padding-bottom: 1px;
    }
    .items-table td { padding: 1px 0; vertical-align: top; }
    .items-total {
      font-weight: bold;
      font-size: 11px;
      text-align: right;
      margin-top: 3px;
      padding-top: 2px;
      border-top: 1px solid #999;
    }

    /* ── FOOTER (BARCODE + QR + NOTES) ── */
    .footer {
      display: flex;
      align-items: stretch;
      border-top: 2px solid #000;
      min-height: 22mm;
    }
    .footer-barcode {
      flex: 1;
      padding: 2mm 4mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border-right: 1px dashed #999;
    }
    .barcode-svg { width: 100%; max-height: 28px; }
    .barcode-text { font-size: 8px; letter-spacing: 2px; margin-top: 2px; }
    .footer-qr {
      flex: 0 0 22mm;
      padding: 2mm;
      display: flex;
      align-items: center;
      justify-content: center;
      border-right: 1px dashed #999;
    }
    .qr-canvas { width: 18mm; height: 18mm; }
    .footer-notes {
      flex: 1;
      padding: 2mm 4mm;
      font-size: 8px;
      color: #444;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .footer-notes .note-warn {
      font-weight: bold;
      text-transform: uppercase;
      color: #000;
      font-size: 9px;
    }
    .footer-notes .note-support {
      font-size: 7px;
      color: #888;
      margin-top: 3px;
    }
    .payment-badge {
      font-size: 9px;
      padding: 1px 6px;
      border: 1px solid #000;
      display: inline-block;
      margin-top: 2px;
    }

    @media print {
      body { width: 148mm; min-height: 105mm; }
    }
  </style>
</head>
<body>
  <div class="label-container">
    <!-- HEADER -->
    <div class="header">
      <div class="header-left">
        ${data.storeLogo ? `<img src="${data.storeLogo}" class="header-logo" alt="" />` : ""}
        <span class="header-store">${data.storeName}</span>
      </div>
      <div class="header-right">
        <div class="header-order">#${shortId}</div>
        <div class="header-date">${data.date}</div>
      </div>
    </div>

    <!-- BODY -->
    <div class="body-grid">
      <!-- DESTINATÁRIO -->
      <div class="dest-section">
        <div class="section-label">📍 Destinatário</div>
        <div class="dest-name">${data.customerName}</div>
        ${maskedCpf ? `<div class="dest-cpf">CPF: ${maskedCpf}</div>` : ""}
        ${data.customerPhone ? `<div class="dest-phone">☎ ${data.customerPhone}</div>` : ""}
        <div class="dest-address">${fullAddress || "Endereço não informado"}</div>
        ${data.shippingCep ? `<div class="dest-cep">${formatCep(data.shippingCep)}</div>` : ""}
      </div>

      <!-- RIGHT COLUMN -->
      <div class="right-col">
        <!-- REMETENTE -->
        <div class="sender-section">
          <div class="section-label">🏪 Remetente</div>
          <div class="sender-name">${data.storeName}</div>
          ${data.storeCity || data.storeState ? `<div class="sender-info">${[data.storeCity, data.storeState].filter(Boolean).join(" / ")}</div>` : ""}
          ${data.storeCep ? `<div class="sender-info">CEP: ${formatCep(data.storeCep)}</div>` : ""}
          ${data.storePhone ? `<div class="sender-info">☎ ${data.storePhone}</div>` : ""}
          ${data.storeEmail ? `<div class="sender-info">✉ ${data.storeEmail}</div>` : ""}
        </div>

        <!-- ENVIO -->
        <div class="shipping-section">
          <div class="section-label">🚚 Envio</div>
          ${data.shippingMethod ? `<div class="shipping-method">${data.shippingMethod}${data.shippingType ? ` — ${data.shippingType}` : ""}</div>` : `<div class="shipping-method">PADRÃO</div>`}
          ${data.trackingCode ? `<div class="tracking-code">${data.trackingCode}</div>` : ""}
          ${data.estimatedDelivery ? `<div class="shipping-detail">Prazo: ${data.estimatedDelivery}</div>` : ""}
          ${data.shippingCost != null && data.shippingCost > 0 ? `<div class="shipping-detail">Frete: ${formatPrice(data.shippingCost)}</div>` : ""}
          <div class="payment-badge">${data.paymentMethod.toUpperCase()} • ${data.paymentStatus.toUpperCase()}</div>
        </div>

        <!-- ITENS -->
        <div class="items-section">
          <div class="section-label">📦 Itens (${data.items.reduce((s, i) => s + i.quantity, 0)})</div>
          <table class="items-table">
            <thead><tr><th>Qtd</th><th>Produto</th><th style="text-align:right">Valor</th></tr></thead>
            <tbody>
              ${data.items.map(i => `
                <tr>
                  <td>${i.quantity}x</td>
                  <td>${i.name.substring(0, 30)}${i.variation ? ` (${i.variation})` : ""}</td>
                  <td style="text-align:right">${formatPrice(i.price * i.quantity)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          <div class="items-total">TOTAL: ${formatPrice(data.total)}</div>
        </div>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="footer">
      <div class="footer-barcode">
        <svg class="barcode-svg" id="barcode"></svg>
        <div class="barcode-text">${barcodeValue}</div>
      </div>
      <div class="footer-qr">
        <canvas class="qr-canvas" id="qrcode"></canvas>
      </div>
      <div class="footer-notes">
        ${data.notes ? `<div class="note-warn">⚠ ${data.notes}</div>` : `<div class="note-warn">⚠ Manuseie com cuidado</div>`}
        <div class="note-support">Em caso de problemas, entre em contato com o vendedor ou suporte da plataforma.</div>
      </div>
    </div>
  </div>

  <script>
    // ── Simple Code128B barcode generator ──
    (function() {
      const CODE128B = {
        START: [2,1,1,4,1,2],
        STOP: [2,3,3,1,1,1,2],
        PATTERNS: [
          [2,1,2,2,2,2],[2,2,2,1,2,2],[2,2,2,2,2,1],[1,2,1,2,2,3],[1,2,1,3,2,2],
          [1,3,1,2,2,2],[1,2,2,2,1,3],[1,2,2,3,1,2],[1,3,2,2,1,2],[2,2,1,2,1,3],
          [2,2,1,3,1,2],[2,3,1,2,1,2],[1,1,2,2,3,2],[1,2,2,1,3,2],[1,2,2,2,3,1],
          [1,1,3,2,2,2],[1,2,3,1,2,2],[1,2,3,2,2,1],[2,2,3,2,1,1],[2,2,1,1,3,2],
          [2,2,1,2,3,1],[2,1,3,2,1,2],[2,2,3,1,1,2],[3,1,2,1,3,1],[3,1,1,2,2,2],
          [3,2,1,1,2,2],[3,2,1,2,2,1],[3,1,2,2,1,2],[3,2,2,1,1,2],[3,2,2,2,1,1],
          [2,1,2,1,2,3],[2,1,2,3,2,1],[2,3,2,1,2,1],[1,1,1,3,2,3],[1,3,1,1,2,3],
          [1,3,1,3,2,1],[1,1,2,3,1,3],[1,3,2,1,1,3],[1,3,2,3,1,1],[2,1,1,3,1,3],
          [2,3,1,1,1,3],[2,3,1,3,1,1],[1,1,2,1,3,3],[1,1,2,3,3,1],[1,3,2,1,3,1],
          [1,1,3,1,2,3],[1,1,3,3,2,1],[1,3,3,1,2,1],[3,1,3,1,2,1],[2,1,1,3,3,1],
          [2,3,1,1,3,1],[2,1,3,1,1,3],[2,1,3,3,1,1],[2,1,3,1,3,1],[3,1,1,1,2,3],
          [3,1,1,3,2,1],[3,3,1,1,2,1],[3,1,2,1,1,3],[3,1,2,3,1,1],[3,3,2,1,1,1],
          [3,1,4,1,1,1],[2,2,1,4,1,1],[4,3,1,1,1,1],[1,1,1,2,2,4],[1,1,1,4,2,2],
          [1,2,1,1,2,4],[1,2,1,4,2,1],[1,4,1,1,2,2],[1,4,1,2,2,1],[1,1,2,2,1,4],
          [1,1,2,4,1,2],[1,2,2,1,1,4],[1,2,2,4,1,1],[1,4,2,1,1,2],[1,4,2,2,1,1],
          [2,4,1,2,1,1],[2,2,1,1,1,4],[4,1,3,1,1,1],[2,4,1,1,1,2],[1,3,4,1,1,1],
          [1,1,1,2,4,2],[1,2,1,1,4,2],[1,2,1,2,4,1],[1,1,4,2,1,2],[1,2,4,1,1,2],
          [1,2,4,2,1,1],[4,1,1,2,1,2],[4,2,1,1,1,2],[4,2,1,2,1,1],[2,1,2,1,4,1],
          [2,1,4,1,2,1],[4,1,2,1,2,1],[1,1,1,1,4,3],[1,1,1,3,4,1],[1,3,1,1,4,1],
          [1,1,4,1,1,3],[1,1,4,3,1,1],[4,1,1,1,1,3],[4,1,1,3,1,1],[1,1,3,1,4,1],
          [1,1,4,1,3,1],[3,1,1,1,4,1],[4,1,1,1,3,1]
        ]
      };

      function encode(text) {
        let codes = [];
        let checksum = 104; // START B
        for (let i = 0; i < text.length; i++) {
          let v = text.charCodeAt(i) - 32;
          if (v < 0 || v > 94) v = 0;
          codes.push(v);
          checksum += v * (i + 1);
        }
        codes.push(checksum % 103);
        
        let bars = CODE128B.START.slice();
        codes.forEach(c => bars = bars.concat(CODE128B.PATTERNS[c]));
        bars = bars.concat(CODE128B.STOP);
        return bars;
      }

      const text = ${JSON.stringify(barcodeValue)};
      const bars = encode(text);
      const svg = document.getElementById('barcode');
      if (svg) {
        let x = 0;
        const unitW = 1.2;
        const h = 28;
        let rects = '';
        bars.forEach((w, i) => {
          if (i % 2 === 0) {
            rects += '<rect x="'+x+'" y="0" width="'+(w*unitW)+'" height="'+h+'" fill="#000"/>';
          }
          x += w * unitW;
        });
        svg.setAttribute('viewBox', '0 0 ' + x + ' ' + h);
        svg.innerHTML = rects;
      }
    })();

    // ── Simple QR code (fallback: text block) ──
    (function() {
      const canvas = document.getElementById('qrcode');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const size = 120;
      canvas.width = size;
      canvas.height = size;

      // Simple visual QR-like pattern based on order ID
      const id = ${JSON.stringify(data.orderId)};
      const grid = 15;
      const cellSize = size / grid;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#000';

      // Finder patterns
      function drawFinder(x, y) {
        ctx.fillRect(x * cellSize, y * cellSize, 7 * cellSize, 7 * cellSize);
        ctx.fillStyle = '#fff';
        ctx.fillRect((x+1) * cellSize, (y+1) * cellSize, 5 * cellSize, 5 * cellSize);
        ctx.fillStyle = '#000';
        ctx.fillRect((x+2) * cellSize, (y+2) * cellSize, 3 * cellSize, 3 * cellSize);
      }
      drawFinder(0, 0);
      drawFinder(grid - 7, 0);
      drawFinder(0, grid - 7);

      // Data area
      let hash = 0;
      for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i);
      for (let r = 0; r < grid; r++) {
        for (let c = 0; c < grid; c++) {
          if ((r < 8 && c < 8) || (r < 8 && c >= grid-8) || (r >= grid-8 && c < 8)) continue;
          if (((hash >> ((r * grid + c) % 31)) & 1) === 1) {
            ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
          }
        }
      }
    })();

    window.onload = () => {
      setTimeout(() => { window.print(); }, 400);
    };
  </script>
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}

function formatCep(cep: string): string {
  const clean = cep.replace(/\D/g, "");
  if (clean.length === 8) return clean.slice(0, 5) + "-" + clean.slice(5);
  return cep;
}

function buildFullAddress(data: OrderLabelData): string {
  if (data.shippingStreet) {
    const parts = [
      data.shippingStreet,
      data.shippingNumber ? `nº ${data.shippingNumber}` : "",
      data.shippingComplement || "",
      data.shippingNeighborhood || "",
      [data.shippingCity, data.shippingState].filter(Boolean).join("/"),
    ].filter(Boolean);
    return parts.join(", ");
  }
  return data.customerAddress || "";
}
