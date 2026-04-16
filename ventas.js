// ventas.js — Escritura de ventas a Google Sheets (OAuth2) + cola local
// Samsa Café POS

const VentasModule = (() => {

  const QUEUE_KEY = 'samsa_ventas_queue';

  // ── Formato de fecha/hora ─────────────────────────────────────────────────
  function _fmtDate(d) {
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  function _fmtTime(d) {
    return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  }

  // ── Construir filas para VENTAS ───────────────────────────────────────────
  // Una fila por ítem. Cols:
  // A:# ORDEN  B:FECHA  C:HORA  D:CLIENTE  E:CATEGORÍA  F:PRODUCTO
  // G:VARIANTE  H:TEMPERATURA  I:TAMAÑO  J:EXTRAS  K:PRECIO UNITARIO
  // L:PRECIO EXTRAS  M:SUBTOTAL ÍTEM  N:MÉTODO PAGO  O:TOTAL ORDEN

  function _buildRows(order) {
    const fecha = _fmtDate(order.fecha);
    const hora  = _fmtTime(order.fecha);

    return order.items.map((item, idx) => [
      order.folio,
      fecha,
      hora,
      order.cliente,
      item.categoria,
      item.nombre,
      item.variante,
      item.temp        || '',
      item.tamano      || '',
      item.extras.map(e => e.nombre).join(', '),
      item.precioUnit,
      item.precioExtras,
      item.subtotal,
      order.metodoPago,
      idx === 0 ? order.total : '', // total solo en la primera fila de la orden
    ]);
  }

  // ── OAuth2 token ──────────────────────────────────────────────────────────
  // Usa Google Identity Services (GIS) cargado en el HTML si se configura OAUTH_CLIENT_ID
  function _getToken() {
    return new Promise((resolve, reject) => {
      if (!CONFIG.OAUTH_CLIENT_ID) {
        reject(new Error('OAUTH_CLIENT_ID no configurado. Ventas solo guardadas localmente.'));
        return;
      }
      if (typeof google === 'undefined' || !google.accounts) {
        reject(new Error('Google Identity Services no cargado.'));
        return;
      }
      const client = google.accounts.oauth2.initTokenClient({
        client_id: CONFIG.OAUTH_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        callback: (resp) => {
          if (resp.error) reject(new Error(resp.error));
          else resolve(resp.access_token);
        },
      });
      client.requestAccessToken({ prompt: '' });
    });
  }

  // ── Append a Google Sheets ────────────────────────────────────────────────
  async function _appendToSheet(rows) {
    const token = await _getToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SHEET_ID}/values/${encodeURIComponent(CONFIG.VENTAS_RANGE)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS&key=${CONFIG.API_KEY}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ values: rows }),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Sheets API error ${res.status}: ${txt}`);
    }
    return res.json();
  }

  // ── Cola local (offline) ──────────────────────────────────────────────────
  function _enqueue(order) {
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    queue.push({
      ...order,
      fecha: order.fecha.toISOString(), // serializar fecha
    });
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }

  function _dequeue() {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    try {
      const queue = JSON.parse(raw);
      return queue.map(o => ({ ...o, fecha: new Date(o.fecha) }));
    } catch { return []; }
  }

  function _clearQueue() {
    localStorage.removeItem(QUEUE_KEY);
  }

  // ── API pública ───────────────────────────────────────────────────────────

  async function save(order) {
    const rows = _buildRows(order);

    // Intentar flush de cola pendiente primero
    await _flushQueue();

    try {
      await _appendToSheet(rows);
      console.log('[VentasModule] Venta guardada en Sheet:', order.folio);
    } catch (err) {
      console.warn('[VentasModule] No se pudo guardar en Sheet. Encolando:', err.message);
      _enqueue(order);
      throw err; // re-lanzar para que App sepa
    }
  }

  async function _flushQueue() {
    const queue = _dequeue();
    if (!queue.length) return;

    const flushed = [];
    for (const order of queue) {
      try {
        await _appendToSheet(_buildRows(order));
        flushed.push(order.folio);
      } catch {
        break; // dejar el resto en cola
      }
    }

    if (flushed.length === queue.length) {
      _clearQueue();
    } else {
      // Guardar solo los que no se pudieron enviar
      const remaining = queue.filter(o => !flushed.includes(o.folio));
      localStorage.setItem(QUEUE_KEY, JSON.stringify(
        remaining.map(o => ({ ...o, fecha: o.fecha.toISOString() }))
      ));
    }

    if (flushed.length) {
      console.log('[VentasModule] Cola flusheada:', flushed);
    }
  }

  // Intentar flush cuando se recupera conexión
  window.addEventListener('online', () => {
    console.log('[VentasModule] Conexión restaurada, intentando flush…');
    _flushQueue().catch(() => {});
  });

  return { save };

})();
