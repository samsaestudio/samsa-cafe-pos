// menu.js — Lectura dinámica del menú desde Google Sheets
// Samsa Café POS

const MenuModule = (() => {

  // ── Mapa de imágenes locales (por nombre de producto normalizado) ──────────
  const LOCAL_IMAGES = {
    'espresso doble':    'cafe-espressodoble.png',
    'lungo':             'cafe-lungo.png',
    'capuchino':         'cafe-capuccino.png',
    'latte':             'cafe-latte.png',
    'recovery':          'smoothie-recovery.png',
    'berry glow':        'smoothie-berry glow.png',
    'verde':             'smoothie-verde.png',
    'pan de masa madre': 'alimentos-panmasamadre.png',
    'granola artesanal': 'alimentos-granola.png',
    'caldo de hueso':    'alimentos-caldohueso.png',
  };

  // ── Estado interno ────────────────────────────────────────────────────────
  let _menuData   = {}; // { FAMILIA: [ producto, ... ] }
  let _extrasData = {}; // { GRUPO:   [ extra,    ... ] }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function norm(str) {
    return (str || '').trim().toLowerCase();
  }

  function naOrValue(val) {
    if (!val || norm(val) === 'n/a' || norm(val) === '') return null;
    return val.trim();
  }

  // Parsea precio. Devuelve:
  //   número   → precio válido
  //   null     → el campo tenía contenido no numérico (ej: "?") → precio por definir
  //   0        → campo vacío / no aplica
  function parsePrice(val) {
    if (!val || String(val).trim() === '') return 0;
    const str     = String(val).trim();
    const cleaned = str.replace(/[^0-9.]/g, '');
    if (!cleaned) return null; // "?" u otro no-numérico
    return parseFloat(cleaned) || 0;
  }

  function sheetsUrl(range) {
    return (
      `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SHEET_ID}` +
      `/values/${encodeURIComponent(range)}?key=${CONFIG.API_KEY}`
    );
  }

  function getImage(productName, imgUrl) {
    if (imgUrl && imgUrl.startsWith('http')) return { type: 'url',   src: imgUrl };
    const local = LOCAL_IMAGES[norm(productName)];
    if (local) return { type: 'local', src: local };
    return { type: 'emoji', src: _familyEmoji(productName) };
  }

  function _familyEmoji(name) {
    const n = norm(name);
    if (n.includes('recovery') || n.includes('berry') || n.includes('verde')) return '🥤';
    if (n.includes('pan') || n.includes('granola') || n.includes('caldo'))    return '🍞';
    if (n.includes('coca') || n.includes('agua'))                              return '🧴';
    return '☕';
  }

  // ── Parseo del MENÚ ───────────────────────────────────────────────────────
  // Columnas (base 0):
  //  A:0  ID          B:1  CATEGORÍA (legacy)  C:2  PRODUCTO    D:3  VARIANTE
  //  E:4  PRECIO      F:5  TEMP                G:6  TAMAÑO      H:7  TIPO LECHE
  //  I:8  EXTRAS      J:9  DESCRIPCIÓN         K:10 NOTA        L:11 ACTIVO (S/N)
  //  M:12 IMG_URL     N:13 FAMILIA  ← agrupación principal

  function parseMenuRows(rows) {
    const byProduct = {}; // clave = "FAMILIA||PRODUCTO"

    for (const row of rows) {
      if (norm(row[11]) !== 's') continue; // solo activos (col L)

      const id       = (row[0]  || '').trim();
      const producto = (row[2]  || '').trim();
      const variante = (row[3]  || '').trim();
      const precio   = parsePrice(row[4]);
      const temp     = naOrValue(row[5]);
      const tamano   = naOrValue(row[6]);
      const leche    = naOrValue(row[7]);
      const extras   = naOrValue(row[8]);
      const desc     = (row[9]  || '').trim();
      const imgUrl   = (row[12] || '').trim(); // col M
      const familia  = (row[13] || '').trim().toUpperCase(); // col N ← FAMILIA

      if (!familia || !producto) continue; // fila incompleta

      const key = `${familia}||${producto}`;

      if (!byProduct[key]) {
        byProduct[key] = {
          id,
          familia,
          nombre:      producto,
          descripcion: desc,
          imagen:      getImage(producto, imgUrl),
          variantes:   [],
          // flags derivados
          tieneTempOptions:     false,
          tieneTamanoOptions:   false,
          tieneExtras:          false,
          tieneVarianteOptions: false,
          grupoExtras:          null,
        };
      }

      byProduct[key].variantes.push({ id, variante, precio, temp, tamano, leche, extras });
      if (desc && !byProduct[key].descripcion) byProduct[key].descripcion = desc;
    }

    // ── Derivar flags ──────────────────────────────────────────────────────
    for (const p of Object.values(byProduct)) {
      const temps   = [...new Set(p.variantes.map(v => v.temp).filter(Boolean))];
      const tamanos = [...new Set(p.variantes.map(v => v.tamano).filter(Boolean))];
      const grupos  = [...new Set(p.variantes.map(v => v.extras).filter(Boolean))];

      p.tieneTempOptions   = temps.length > 0;
      p.tieneTamanoOptions = tamanos.length > 0;
      p.tieneExtras        = grupos.length > 0;
      p.grupoExtras        = grupos[0] || null;
      p.tempsDisponibles   = temps;
      p.precioPorVariante  = _buildPriceMap(p.variantes);

      // Variantes con precio propio (sin temp ni tamano) — ej: Pan de Masa Madre
      const allNoTemp   = p.variantes.every(v => !v.temp);
      const allNoTamano = p.variantes.every(v => !v.tamano);
      p.tieneVarianteOptions = p.variantes.length > 1 && allNoTemp && allNoTamano;

      if (p.tieneVarianteOptions) {
        p.variantesDisponibles = p.variantes.map(v => {
          let label = v.variante.trim();
          const prefix = p.nombre.trim().toLowerCase();
          if (label.toLowerCase().startsWith(prefix)) {
            label = label.slice(p.nombre.trim().length).trim();
          }
          return { label: label || v.variante, varianteFull: v.variante, precio: v.precio };
        });
      }
    }

    // ── Agrupar por FAMILIA ────────────────────────────────────────────────
    const result = {};
    for (const p of Object.values(byProduct)) {
      if (!result[p.familia]) result[p.familia] = [];
      result[p.familia].push(p);
    }
    return result;
  }

  function _buildPriceMap(variantes) {
    const map = {};
    for (const v of variantes) {
      const key = `${v.temp || ''}||${v.tamano || ''}`;
      map[key] = v.precio;
    }
    return map;
  }

  // ── Parseo de EXTRAS ──────────────────────────────────────────────────────
  // Cols: A:ID  B:GRUPO  C:NOMBRE  D:DESC  E:PRECIO  F:ACTIVO  G:EXCLUSIVO
  function parseExtrasRows(rows) {
    const result = {};
    for (const row of rows) {
      if (norm(row[5]) !== 's') continue;
      const grupo     = (row[1] || '').trim().toUpperCase();
      const nombre    = (row[2] || '').trim();
      const desc      = (row[3] || '').trim();
      const precio    = parsePrice(row[4]) || 0;
      const exclusivo = naOrValue(row[6]);
      if (!result[grupo]) result[grupo] = [];
      result[grupo].push({ nombre, desc, precio, exclusivo });
    }
    return result;
  }

  // ── Carga principal ───────────────────────────────────────────────────────
  async function load() {
    const loadingEl  = document.getElementById('menu-loading');
    const errorEl    = document.getElementById('menu-error');
    const carouselEl = document.getElementById('products-carousel');

    loadingEl.classList.remove('hidden');
    errorEl.classList.add('hidden');
    carouselEl.innerHTML = '';

    try {
      const [menuRes, extrasRes] = await Promise.all([
        fetch(sheetsUrl(CONFIG.MENU_RANGE)),
        fetch(sheetsUrl(CONFIG.EXTRAS_RANGE)),
      ]);

      if (!menuRes.ok) throw new Error(`Menu fetch failed: ${menuRes.status}`);

      const menuJson   = await menuRes.json();
      const extrasJson = extrasRes.ok ? await extrasRes.json() : { values: [] };

      _menuData   = parseMenuRows(menuJson.values   || []);
      _extrasData = parseExtrasRows(extrasJson.values || []);

      loadingEl.classList.add('hidden');

      if (typeof App !== 'undefined') {
        App.onMenuLoaded(_menuData, _extrasData);
      }

    } catch (err) {
      console.error('[MenuModule] Error cargando menú:', err);
      loadingEl.classList.add('hidden');
      errorEl.classList.remove('hidden');
    }
  }

  // ── API pública ───────────────────────────────────────────────────────────

  // Precio por temp + tamano
  function getPrice(producto, temp, tamano) {
    const key = `${temp || ''}||${tamano || ''}`;
    return (producto.precioPorVariante && producto.precioPorVariante[key]) || 0;
  }

  // Precio base (primera variante). Devuelve null si el precio es indefinido ("?")
  function getBasePrice(producto) {
    if (!producto.variantes.length) return null;
    const p = producto.variantes[0].precio;
    return (p === null) ? null : (p || 0);
  }

  // Tamaños disponibles para una temperatura
  function getTamanosForTemp(producto, temp) {
    return producto.variantes
      .filter(v => v.temp === temp && v.tamano)
      .map(v => ({ tamano: v.tamano, precio: v.precio }));
  }

  // Extras de un grupo
  function getExtras(grupo) {
    if (!grupo) return [];
    return _extrasData[grupo.toUpperCase()] || [];
  }

  // Precio por varianteFull (para tieneVarianteOptions)
  function getPriceForVariante(producto, varianteFull) {
    const v = producto.variantes.find(v => v.variante === varianteFull);
    return v ? (v.precio || 0) : 0;
  }

  return { load, getPrice, getBasePrice, getTamanosForTemp, getExtras, getPriceForVariante };

})();
