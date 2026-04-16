// ticket.js — Generación de PDF del ticket (recibo 80mm)
// Samsa Café POS  —  usa jsPDF (cargado desde CDN)

const TicketModule = (() => {

  // Ancho recibo 80mm → ~226pt en jsPDF (unidad: pt)
  // jsPDF usa mm por default; 80mm de ancho con margen de 8mm a cada lado
  const PAGE_W  = 80;   // mm
  const MARGIN  = 6;    // mm
  const CONTENT = PAGE_W - MARGIN * 2;  // 68mm

  function generate(order) {
    if (typeof window.jspdf === 'undefined' && typeof jsPDF === 'undefined') {
      console.error('[TicketModule] jsPDF no cargado.');
      return;
    }

    const { jsPDF } = window.jspdf || window;
    const doc = new jsPDF({
      unit:     'mm',
      format:   [PAGE_W, 297], // alto dinámico: usamos A4 y luego recortamos
      compress: true,
    });

    let y = MARGIN;

    // ── Helpers ───────────────────────────────────────────────────────────
    function text(str, x, opts = {}) {
      doc.text(str, x, y, opts);
    }

    function line() {
      y += 1;
      doc.setDrawColor(180, 180, 160);
      doc.setLineWidth(0.2);
      doc.line(MARGIN, y, PAGE_W - MARGIN, y);
      y += 3;
    }

    function dashes() {
      y += 1;
      doc.setDrawColor(180, 180, 160);
      doc.setLineDashPattern([1, 1.5], 0);
      doc.setLineWidth(0.2);
      doc.line(MARGIN, y, PAGE_W - MARGIN, y);
      doc.setLineDashPattern([], 0);
      y += 3;
    }

    function nl(h = 4) { y += h; }

    function setFont(size, style = 'normal', family = 'helvetica') {
      doc.setFont(family, style);
      doc.setFontSize(size);
    }

    function fmtDate(d) {
      return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    function fmtTime(d) {
      return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });
    }

    // ── HEADER ────────────────────────────────────────────────────────────
    // Intentar incluir logo si está disponible como imagen base64/URL
    // (jsPDF puede incluir PNG con addImage — se hace si la imagen ya está cacheada en el DOM)
    const logoImg = document.querySelector('.logo-img');
    if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width  = logoImg.naturalWidth;
        canvas.height = logoImg.naturalHeight;
        canvas.getContext('2d').drawImage(logoImg, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        const logoH   = 10; // mm
        const logoW   = (logoImg.naturalWidth / logoImg.naturalHeight) * logoH;
        const logoX   = (PAGE_W - logoW) / 2;
        doc.addImage(dataUrl, 'PNG', logoX, y, logoW, logoH);
        y += logoH + 2;
      } catch {
        // Si falla canvas (CORS, etc.) → texto plano
        setFont(13, 'bold');
        doc.setTextColor(59, 42, 26);
        text('samsa café', PAGE_W / 2, { align: 'center' });
        nl(5);
      }
    } else {
      setFont(13, 'bold');
      doc.setTextColor(59, 42, 26);
      text('samsa café', PAGE_W / 2, { align: 'center' });
      nl(5);
    }

    setFont(7, 'normal');
    doc.setTextColor(92, 61, 30);
    text('Samsa Café by Samsa Estudio', PAGE_W / 2, { align: 'center' });
    nl(3.5);
    text('Av. Acueducto 4283, Colinas de San Javier', PAGE_W / 2, { align: 'center' });
    nl(3.5);
    text('44660 Guadalajara, Jal. — Urbanta Colinas', PAGE_W / 2, { align: 'center' });
    nl(3.5);
    text('samsapilates.com  |  +523323429996', PAGE_W / 2, { align: 'center' });
    nl(3.5);
    text('@samsaestudio', PAGE_W / 2, { align: 'center' });
    nl(3);

    line();

    // ── INFO ORDEN ────────────────────────────────────────────────────────
    setFont(8, 'bold');
    doc.setTextColor(59, 42, 26);
    text(order.folio, MARGIN);
    doc.setFont('helvetica', 'normal');
    text(fmtDate(order.fecha), PAGE_W - MARGIN, { align: 'right' });
    nl(4);

    setFont(7, 'normal');
    doc.setTextColor(92, 61, 30);
    text(fmtTime(order.fecha), MARGIN);
    nl(4);

    setFont(8, 'bold');
    doc.setTextColor(59, 42, 26);
    text(`ORDEN PARA: ${order.cliente}`, MARGIN);
    nl(4);

    setFont(7.5, 'normal');
    doc.setTextColor(92, 61, 30);
    text(`PAGO: ${order.metodoPago}`, MARGIN);
    nl(3);

    dashes();

    // ── ÍTEMS ─────────────────────────────────────────────────────────────
    for (const item of order.items) {
      setFont(8, 'bold');
      doc.setTextColor(59, 42, 26);

      // Nombre variante — puede ser largo, truncar si es necesario
      const nombreLines = doc.splitTextToSize(item.variante, CONTENT - 14);
      doc.text(nombreLines, MARGIN, y);
      const priceStr = `$${item.precioUnit}`;
      setFont(8, 'normal');
      doc.setTextColor(196, 127, 44);
      text(priceStr, PAGE_W - MARGIN, { align: 'right' });
      y += nombreLines.length * 4;

      // Extras
      if (item.extras && item.extras.length) {
        setFont(7, 'normal');
        doc.setTextColor(92, 61, 30);
        for (const ex of item.extras) {
          text(`  + ${ex.nombre}`, MARGIN);
          doc.setTextColor(196, 127, 44);
          text(`+$${ex.precio}`, PAGE_W - MARGIN, { align: 'right' });
          doc.setTextColor(92, 61, 30);
          nl(3.5);
        }
      }

      nl(2);
    }

    line();

    // ── TOTAL ─────────────────────────────────────────────────────────────
    setFont(11, 'bold');
    doc.setTextColor(59, 42, 26);
    text('TOTAL', MARGIN);
    doc.setTextColor(196, 127, 44);
    text(`$${order.total}`, PAGE_W - MARGIN, { align: 'right' });
    nl(6);

    dashes();
    nl(2);

    // ── FOOTER ────────────────────────────────────────────────────────────
    setFont(7, 'normal');
    doc.setTextColor(92, 61, 30);
    text('¡Gracias por tu visita!  ✦  @samsaestudio', PAGE_W / 2, { align: 'center' });
    nl(8);

    // Recortar el PDF al contenido real
    const finalH = y + 4;
    const docFinal = new jsPDF({
      unit:   'mm',
      format: [PAGE_W, finalH],
    });

    // Re-generar en el doc con tamaño correcto
    // (jsPDF no soporta redimensionar después de crear, así que generamos de nuevo)
    _generateToDoc(docFinal, order, PAGE_W, MARGIN, CONTENT);
    docFinal.save(`${order.folio}-samsa-cafe.pdf`);
  }

  // ─── Re-generación limpia en doc con tamaño correcto ─────────────────────
  function _generateToDoc(doc, order, PAGE_W, MARGIN, CONTENT) {
    let y = MARGIN;

    function t(str, x, opts = {}) { doc.text(str, x, y, opts); }
    function nl(h = 4) { y += h; }
    function sf(size, style = 'normal') { doc.setFont('helvetica', style); doc.setFontSize(size); }
    function clr(r, g, b) { doc.setTextColor(r, g, b); }

    function line() {
      y += 1;
      doc.setDrawColor(180, 180, 160); doc.setLineWidth(0.2);
      doc.line(MARGIN, y, PAGE_W - MARGIN, y); y += 3;
    }
    function dashes() {
      y += 1;
      doc.setDrawColor(180, 180, 160);
      doc.setLineDashPattern([1, 1.5], 0); doc.setLineWidth(0.2);
      doc.line(MARGIN, y, PAGE_W - MARGIN, y);
      doc.setLineDashPattern([], 0); y += 3;
    }
    function fmtDate(d) { return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
    function fmtTime(d) { return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true }); }

    // Logo / nombre
    const logoImg = document.querySelector('.logo-img');
    if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width  = logoImg.naturalWidth;
        canvas.height = logoImg.naturalHeight;
        canvas.getContext('2d').drawImage(logoImg, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        const logoH = 10;
        const logoW = (logoImg.naturalWidth / logoImg.naturalHeight) * logoH;
        doc.addImage(dataUrl, 'PNG', (PAGE_W - logoW) / 2, y, logoW, logoH);
        y += logoH + 2;
      } catch {
        sf(13, 'bold'); clr(59, 42, 26);
        t('samsa café', PAGE_W / 2, { align: 'center' }); nl(5);
      }
    } else {
      sf(13, 'bold'); clr(59, 42, 26);
      t('samsa café', PAGE_W / 2, { align: 'center' }); nl(5);
    }

    sf(7); clr(92, 61, 30);
    t('Samsa Café by Samsa Estudio', PAGE_W / 2, { align: 'center' }); nl(3.5);
    t('Av. Acueducto 4283, Colinas de San Javier', PAGE_W / 2, { align: 'center' }); nl(3.5);
    t('44660 Guadalajara, Jal. — Urbanta Colinas', PAGE_W / 2, { align: 'center' }); nl(3.5);
    t('samsapilates.com  |  +523323429996', PAGE_W / 2, { align: 'center' }); nl(3.5);
    t('@samsaestudio', PAGE_W / 2, { align: 'center' }); nl(3);

    line();

    sf(8, 'bold'); clr(59, 42, 26);
    t(order.folio, MARGIN);
    sf(8); t(fmtDate(order.fecha), PAGE_W - MARGIN, { align: 'right' });
    nl(4);
    sf(7); clr(92, 61, 30);
    t(fmtTime(order.fecha), MARGIN); nl(4);

    sf(8, 'bold'); clr(59, 42, 26);
    t(`ORDEN PARA: ${order.cliente}`, MARGIN); nl(4);
    sf(7.5); clr(92, 61, 30);
    t(`PAGO: ${order.metodoPago}`, MARGIN); nl(3);

    dashes();

    for (const item of order.items) {
      sf(8, 'bold'); clr(59, 42, 26);
      const nombreLines = doc.splitTextToSize(item.variante, CONTENT - 14);
      doc.text(nombreLines, MARGIN, y);
      sf(8); clr(196, 127, 44);
      t(`$${item.precioUnit}`, PAGE_W - MARGIN, { align: 'right' });
      y += nombreLines.length * 4;

      if (item.extras && item.extras.length) {
        sf(7); clr(92, 61, 30);
        for (const ex of item.extras) {
          t(`  + ${ex.nombre}`, MARGIN);
          clr(196, 127, 44);
          t(`+$${ex.precio}`, PAGE_W - MARGIN, { align: 'right' });
          clr(92, 61, 30);
          nl(3.5);
        }
      }
      nl(2);
    }

    line();

    sf(11, 'bold'); clr(59, 42, 26);
    t('TOTAL', MARGIN);
    clr(196, 127, 44);
    t(`$${order.total}`, PAGE_W - MARGIN, { align: 'right' });
    nl(6);

    dashes(); nl(2);

    sf(7); clr(92, 61, 30);
    t('¡Gracias por tu visita!  ✦  @samsaestudio', PAGE_W / 2, { align: 'center' });
  }

  return { generate };

})();
