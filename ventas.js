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
  // A:# ORDEN  B:FECHA  C:HORA  D:CLIENTE  E:FAMILIA  F:PRODUCTO
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
      item.familia || item.categoria || '',
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
  // IMPORTANTE: el popup de Google solo puede abrirse desde un gesto del usuario.
  // Por eso separamos startAuth() (síncrono, llamado en el clic) de _getToken()
  // (async, llamado después cuando ya tenemos la promesa en vuelo).

  let _tokenClient  = null; // cliente GIS reutilizable
  let _cachedToken  = null; // { value, expiresAt } — válido 55 min
  let _tokenPromise = null; // promesa en vuelo o resuelta

  function _ensureClient() {
    if (_tokenClient) return true;
    if (!CONFIG.OAUTH_CLIENT_ID) return false;
    if (typeof google === 'undefined' || !google.accounts) return false;
    _tokenClient = google.accounts.oauth2.initTokenClient({
      client_id:      CONFIG.OAUTH_CLIENT_ID,
      scope:          'https://www.googleapis.com/auth/spreadsheets',
      callback:       () => {}, // se reemplaza en startAuth()
      error_callback: () => {},
    });
    return true;
  }

  // Llamar SINCRÓNICAMENTE dentro del handler del clic, antes de cualquier await.
  // Si el token en caché sigue vigente, resuelve sin popup.
  // Si no, abre el popup de Google en contexto de gesto de usuario.
  function startAuth() {
    const now = Date.now();

    // Token en caché y válido (con 1 min de margen)
    if (_cachedToken && _cachedToken.expiresAt > now + 60_000) {
      return (_tokenPromise = Promise.resolve(_cachedToken.value));
    }

    if (!_ensureClient()) {
      return (_tokenPromise = Promise.reject(new Error(
        CONFIG.OAUTH_CLIENT_ID
          ? 'Google Identity Services aún no cargado. Reintenta en unos segundos.'
          : 'OAUTH_CLIENT_ID no configurado. Venta guardada localmente.'
      )));
    }

    return (_tokenPromise = new Promise((resolve, reject) => {
      _tokenClient.callback = (resp) => {
        if (resp.error) return reject(new Error(resp.error));
        _cachedToken = { value: resp.access_token, expiresAt: now + 55 * 60 * 1000 };
        resolve(resp.access_token);
      };
      _tokenClient.error_callback = ({ type }) =>
        reject(new Error(type || 'oauth_error'));

      // requestAccessToken() abre el popup sincrónicamente si es necesario.
      // Al llegar aquí seguimos dentro del gesto de usuario (clic).
      _tokenClient.requestAccessToken();
    }));
  }

  function _getToken() {
    return _tokenPromise
      || Promise.reject(new Error('startAuth() debe llamarse antes de guardar.'));
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

  return { save, startAuth };

})();
