// app.js — Estado central, navegación y lógica de UI
// Samsa Café POS  v3

const App = (() => {

  // ── Estado global ─────────────────────────────────────────────────────────
  let _menuData   = {};

  // Ítem siendo configurado en el popup
  let _currentProduct  = null;
  let _selectedTemp    = null;
  let _selectedTamano  = null;
  let _selectedExtras  = [];   // [{ nombre, precio }]
  let _selectedVariante = null; // para productos con tieneVarianteOptions

  // Carrito
  let _cart = [];

  // Checkout
  let _paymentMethod = null;
  let _lastOrder     = null;

  // ── Helper: hex → rgba ────────────────────────────────────────────────────
  function _rgba(hex, alpha) {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!r) return `rgba(0,0,0,${alpha})`;
    return `rgba(${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)},${alpha})`;
  }

  // ── Color de categoría ────────────────────────────────────────────────────
  function _catColor(cat) {
    return CATEGORY_COLORS[(cat || '').toUpperCase()] || DEFAULT_CATEGORY_COLOR;
  }

  // ── Reloj ─────────────────────────────────────────────────────────────────
  function _startClock() {
    const el = document.getElementById('clock');
    function tick() {
      el.textContent = new Date().toLocaleTimeString('es-MX', {
        hour: '2-digit', minute: '2-digit', hour12: true,
      });
    }
    tick();
    setInterval(tick, 1000);
  }

  // ── Folio ─────────────────────────────────────────────────────────────────
  function _nextFolio() {
    const n = parseInt(localStorage.getItem('samsa_folio') || '0', 10) + 1;
    localStorage.setItem('samsa_folio', n);
    return `ORD-${String(n).padStart(3, '0')}`;
  }

  // ── Carousel — convertir scroll vertical del mouse a horizontal ───────────
  function _addCarouselWheelHandler() {
    const carousel = document.getElementById('products-carousel');
    carousel.addEventListener('wheel', (e) => {
      // Si el usuario ya está scrolleando horizontalmente (trackpad), no intervenir
      if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
      e.preventDefault();
      carousel.scrollLeft += e.deltaY;
    }, { passive: false });
  }

  // ── Helpers de texto ──────────────────────────────────────────────────────
  function _capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  // ── CALLBACK desde MenuModule ─────────────────────────────────────────────
  function onMenuLoaded(menuData) {
    _menuData = menuData;
    _renderFamilySelector();
  }

  // ── Render selector de familias (círculos 2×2) ────────────────────────────
  function _renderFamilySelector() {
    const selector = document.getElementById('family-selector');
    selector.innerHTML = '';

    Object.keys(_menuData).forEach((familia, idx) => {
      const colors = _catColor(familia);
      const circle = document.createElement('button');
      circle.className = 'family-circle';
      circle.textContent = _capitalize(familia);
      circle.style.background = colors.bg;
      circle.style.color = colors.text;
      circle.style.animationDelay = `${idx * 90}ms`;
      circle.addEventListener('click', () => showFamilyProducts(familia));
      selector.appendChild(circle);
    });

    selector.classList.remove('hidden');
    document.getElementById('product-view').classList.add('hidden');
  }

  // ── Navegar a los productos de una familia ────────────────────────────────
  function showFamilyProducts(familia) {
    const colors = _catColor(familia);

    // Barra superior: color de fondo + nombre
    const bar     = document.getElementById('family-bar');
    const barName = document.getElementById('family-bar-name');
    bar.style.background  = colors.bg;
    barName.textContent   = _capitalize(familia);
    barName.style.color   = colors.text;

    // Ícono 4 puntos: contraste invertido respecto al fondo
    const icon  = bar.querySelector('.back-menu-icon');
    const label = bar.querySelector('.back-menu-label');
    const iconBg  = colors.text === '#FFFFFF' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.22)';
    const dotColor = colors.text;
    icon.style.background = iconBg;
    icon.querySelectorAll('span').forEach(s => s.style.background = dotColor);
    label.style.color = colors.text;

    // Cambiar vistas
    document.getElementById('family-selector').classList.add('hidden');
    document.getElementById('product-view').classList.remove('hidden');

    _renderProducts(familia);
  }

  // ── Volver al menú de familias ────────────────────────────────────────────
  function showFamilyMenu() {
    document.getElementById('product-view').classList.add('hidden');
    document.getElementById('family-selector').classList.remove('hidden');
  }

  // ── Render productos ──────────────────────────────────────────────────────
  function _renderProducts(cat) {
    const carousel = document.getElementById('products-carousel');
    carousel.innerHTML = '';
    const productos = _menuData[cat] || [];
    const colors    = _catColor(cat);

    productos.forEach((p, idx) => {
      const card = document.createElement('div');
      card.className = 'product-card';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', p.nombre);
      card.style.background      = colors.bg;
      card.style.border          = 'none';
      card.style.animationDelay  = `${idx * 80}ms`;

      // Imagen
      const imgWrap = document.createElement('div');
      imgWrap.className  = 'product-card-img-wrap';
      imgWrap.style.background = 'rgba(0,0,0,0.12)';

      if (p.imagen.type === 'emoji') {
        const ph = document.createElement('div');
        ph.className   = 'product-card-img-placeholder';
        ph.textContent = p.imagen.src;
        imgWrap.appendChild(ph);
      } else {
        const img = document.createElement('img');
        img.className = 'product-card-img';
        img.src = p.imagen.src;
        img.alt = p.nombre;
        img.onerror = () => {
          imgWrap.innerHTML = `<div class="product-card-img-placeholder">☕</div>`;
        };
        imgWrap.appendChild(img);
      }

      // Body
      const body = document.createElement('div');
      body.className = 'product-card-body';

      const name = document.createElement('div');
      name.className   = 'product-card-name';
      name.textContent = p.nombre;

      const priceEl = document.createElement('div');
      priceEl.className   = 'product-card-price';
      const base = MenuModule.getBasePrice(p);
      priceEl.textContent = (base !== null && base > 0) ? `desde $${base}` : '$—';

      // Texto adaptado al color de fondo (claro → oscuro, oscuro → blanco)
      name.style.color    = colors.text;
      priceEl.style.color = colors.text === '#FFFFFF'
        ? 'rgba(255,255,255,0.82)'
        : 'rgba(26,26,26,0.68)';

      body.append(name, priceEl);
      card.append(imgWrap, body);

      card.addEventListener('click',   () => openProductPopup(p));
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') openProductPopup(p);
      });

      carousel.appendChild(card);
    });
  }

  // ── POP-UP DE PRODUCTO ────────────────────────────────────────────────────
  function openProductPopup(producto) {
    _currentProduct   = producto;
    _selectedTemp     = null;
    _selectedTamano   = null;
    _selectedExtras   = [];
    _selectedVariante = null;

    const colors = _catColor(producto.familia);

    // Borde superior con color de familia
    document.getElementById('popup-card').style.borderTopColor = colors.bg;

    // Imagen
    const imgEl = document.getElementById('popup-product-img');
    const phEl  = document.getElementById('popup-product-img-placeholder');
    if (producto.imagen.type === 'emoji') {
      imgEl.classList.add('hidden');
      phEl.classList.remove('hidden');
      phEl.textContent = producto.imagen.src;
    } else {
      phEl.classList.add('hidden');
      imgEl.classList.remove('hidden');
      imgEl.src = producto.imagen.src;
      imgEl.onerror = () => {
        imgEl.classList.add('hidden');
        phEl.classList.remove('hidden');
        phEl.textContent = '☕';
      };
    }

    // Badge
    const badge = document.getElementById('popup-category-badge');
    badge.textContent      = producto.familia;
    badge.style.background = colors.bg;
    badge.style.color      = colors.text;

    // Nombre y descripción
    document.getElementById('popup-product-name').textContent = producto.nombre;
    document.getElementById('popup-product-desc').textContent = producto.descripcion || '';

    // Opciones
    _buildPopupOptions(producto);
    _updatePopupPrice();

    document.getElementById('product-popup').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeProductPopup() {
    document.getElementById('product-popup').classList.add('hidden');
    document.body.style.overflow = '';
  }

  // ── Opciones del popup ────────────────────────────────────────────────────
  function _buildPopupOptions(p) {
    const container = document.getElementById('popup-options');
    container.innerHTML = '';

    // CASO 1 — Variantes con precio distinto (ej: Pan de Masa Madre)
    // Cuando el producto tiene múltiples filas sin temp ni tamano.
    if (p.tieneVarianteOptions) {
      const group = _createOptionGroup('ELIGE TU OPCIÓN', 'variante-group');
      const btns  = _createOptionButtons(
        p.variantesDisponibles.map(v => ({ label: `${v.label}  $${v.precio}`, value: v.varianteFull })),
        (varianteFull) => {
          _selectedVariante = varianteFull;
          _updatePopupPrice();
        },
        'variante',
      );
      group.appendChild(btns);
      container.appendChild(group);

      // Los extras siguen aplicando si el producto los tiene
      _buildExtrasOptions(p, container);
      return;
    }

    // CASO 2 — Temperatura (Latte, etc.)
    if (p.tieneTempOptions) {
      const group = _createOptionGroup('TEMPERATURA', 'temp-group');
      const btns  = _createOptionButtons(
        p.tempsDisponibles.map(t => ({ label: t, value: t })),
        (temp) => {
          _selectedTemp   = temp;
          _selectedTamano = null;
          _selectedExtras = [];
          _rebuildDependentOptions(p);
          _updatePopupPrice();
        },
        'temp',
      );
      group.appendChild(btns);
      container.appendChild(group);
      return; // tamaño y extras se construyen en _rebuildDependentOptions
    }

    // CASO 3 — Solo tamaño (sin temp)
    _buildTamanoOptions(p, container);
    _buildExtrasOptions(p, container);
  }

  function _rebuildDependentOptions(p) {
    ['tamano-group', 'extras-group'].forEach(id => document.getElementById(id)?.remove());

    const container = document.getElementById('popup-options');

    if (_selectedTemp) {
      const tamanos = MenuModule.getTamanosForTemp(p, _selectedTemp);
      if (tamanos.length > 1) {
        _buildTamanoOptions(p, container, tamanos);
      } else if (tamanos.length === 1) {
        _selectedTamano = tamanos[0].tamano;
      }
    }

    _buildExtrasOptions(p, container);
    _updatePopupConfirmBtn();
  }

  function _buildTamanoOptions(p, container, tamanosPre) {
    const tamanos = tamanosPre || p.variantes
      .filter(v => v.tamano)
      .map(v => ({ tamano: v.tamano, precio: v.precio }));
    if (!tamanos.length) return;

    const group = _createOptionGroup('TAMAÑO', 'tamano-group');
    const btns  = _createOptionButtons(
      tamanos.map(({ tamano, precio }) => ({ label: `${tamano}  $${precio}`, value: tamano })),
      (tamano) => { _selectedTamano = tamano; _updatePopupPrice(); },
      'tamano',
    );
    group.appendChild(btns);
    container.appendChild(group);
  }

  function _buildExtrasOptions(p, container) {
    if (!p.tieneExtras) return;
    const extras = MenuModule.getExtras(p.grupoExtras);
    if (!extras.length) return;

    const group = _createOptionGroup('EXTRAS', 'extras-group');
    const list  = document.createElement('div');
    list.className = 'extras-list';

    for (const ex of extras) {
      const isRadio = !!ex.exclusivo;
      const item    = document.createElement('label');
      item.className = `extra-item${isRadio ? ' radio' : ''}`;

      const check = document.createElement('div');
      check.className   = 'extra-item-check';
      check.textContent = '✓';

      const info = document.createElement('div');
      info.className = 'extra-item-info';

      const nm = document.createElement('div');
      nm.className   = 'extra-item-name';
      nm.textContent = ex.nombre;
      info.appendChild(nm);
      if (ex.desc) {
        const ds = document.createElement('div');
        ds.style.cssText = 'font-size:11px;color:var(--brown2);margin-top:2px;opacity:.7;';
        ds.textContent = ex.desc;
        info.appendChild(ds);
      }

      const priceEl = document.createElement('div');
      priceEl.className   = 'extra-item-price';
      priceEl.textContent = ex.precio ? `+$${ex.precio}` : 'gratis';

      item.append(check, info, priceEl);

      item.addEventListener('click', () => {
        const idx = _selectedExtras.findIndex(e => e.nombre === ex.nombre);
        if (isRadio) {
          _selectedExtras = _selectedExtras.filter(e => {
            const d = extras.find(x => x.nombre === e.nombre);
            return !d || d.exclusivo !== ex.exclusivo;
          });
          list.querySelectorAll('.extra-item.radio').forEach(el => {
            const n = el.querySelector('.extra-item-name')?.textContent;
            const d = extras.find(x => x.nombre === n);
            if (d?.exclusivo === ex.exclusivo) el.classList.remove('selected');
          });
          if (idx === -1) {
            _selectedExtras.push({ nombre: ex.nombre, precio: ex.precio });
            item.classList.add('selected');
          }
        } else {
          if (idx === -1) {
            _selectedExtras.push({ nombre: ex.nombre, precio: ex.precio });
            item.classList.add('selected');
          } else {
            _selectedExtras.splice(idx, 1);
            item.classList.remove('selected');
          }
        }
        _updatePopupPrice();
      });

      list.appendChild(item);
    }

    group.appendChild(list);
    container.appendChild(group);
  }

  // ── Helpers de UI ─────────────────────────────────────────────────────────
  function _createOptionGroup(label, id) {
    const group = document.createElement('div');
    group.className = 'option-group';
    group.id = id;
    const lbl = document.createElement('div');
    lbl.className   = 'option-group-label';
    lbl.textContent = label;
    group.appendChild(lbl);
    return group;
  }

  function _createOptionButtons(options, onSelect, dataKey) {
    const wrap = document.createElement('div');
    wrap.className = 'option-buttons';
    for (const { label, value } of options) {
      const btn = document.createElement('button');
      btn.className         = 'option-btn';
      btn.textContent       = label;
      btn.dataset[dataKey]  = value;
      btn.addEventListener('click', () => {
        wrap.querySelectorAll('.option-btn').forEach(b =>
          b.classList.toggle('selected', b.dataset[dataKey] === value));
        onSelect(value);
      });
      wrap.appendChild(btn);
    }
    return wrap;
  }

  // ── Precio en tiempo real ─────────────────────────────────────────────────
  function _updatePopupPrice() {
    const p = _currentProduct;
    if (!p) return;

    let precio = 0;

    if (p.tieneVarianteOptions) {
      // Precio basado en la variante seleccionada
      if (_selectedVariante) {
        precio = MenuModule.getPriceForVariante(p, _selectedVariante);
      } else {
        precio = MenuModule.getBasePrice(p);
      }
    } else if (!p.tieneTempOptions && !p.tieneTamanoOptions) {
      // Sin opciones de dimensión: precio fijo
      precio = MenuModule.getBasePrice(p);
    } else {
      precio = MenuModule.getPrice(p, _selectedTemp, _selectedTamano)
            || MenuModule.getBasePrice(p);
    }

    precio += _selectedExtras.reduce((s, e) => s + (e.precio || 0), 0);
    const priceDisplay = (precio === null || precio === 0) ? '$—' : `$${precio}`;
    document.getElementById('popup-price').textContent = priceDisplay;
    _updatePopupConfirmBtn();
  }

  function _updatePopupConfirmBtn() {
    const p   = _currentProduct;
    const btn = document.getElementById('btn-confirm-product');
    if (!p) { btn.disabled = true; return; }

    let ok = true;

    // Variante obligatoria
    if (p.tieneVarianteOptions && !_selectedVariante) ok = false;

    // Temperatura obligatoria
    if (p.tieneTempOptions && !_selectedTemp) ok = false;

    // Tamaño obligatorio (solo si hay múltiples tamaños para el temp elegido)
    if (ok && (_selectedTemp || (!p.tieneTempOptions && p.tieneTamanoOptions))) {
      const tamanos = _selectedTemp
        ? MenuModule.getTamanosForTemp(p, _selectedTemp)
        : p.variantes.filter(v => v.tamano).map(v => ({ tamano: v.tamano }));
      if (tamanos.length > 1 && !_selectedTamano) ok = false;
    }

    btn.disabled = !ok;
  }

  // ── Confirmar producto → agregar al carrito ───────────────────────────────
  function confirmProduct() {
    const p = _currentProduct;
    if (!p) return;

    let precioUnit   = 0;
    let varianteName = p.nombre;

    if (p.tieneVarianteOptions && _selectedVariante) {
      precioUnit   = MenuModule.getPriceForVariante(p, _selectedVariante);
      const vData  = p.variantesDisponibles.find(v => v.varianteFull === _selectedVariante);
      varianteName = vData ? `${p.nombre} — ${vData.label}` : p.nombre;
    } else {
      precioUnit = MenuModule.getPrice(p, _selectedTemp, _selectedTamano)
               || MenuModule.getBasePrice(p);
      const parts = [p.nombre];
      if (_selectedTemp)   parts.push(_selectedTemp);
      if (_selectedTamano) parts.push(_selectedTamano);
      varianteName = parts.join(' ');
    }

    const precioExtras = _selectedExtras.reduce((s, e) => s + (e.precio || 0), 0);

    _cart.push({
      uid:         Date.now() + Math.random(),
      nombre:      p.nombre,
      variante:    varianteName,
      familia:     p.familia,
      temp:        _selectedTemp,
      tamano:      _selectedTamano,
      extras:      [..._selectedExtras],
      precioUnit,
      precioExtras,
      subtotal:    precioUnit + precioExtras,
    });

    _renderCart();
    closeProductPopup();
    _showToast(`${p.nombre} agregado ✦`);
  }

  // ── CARRITO — lista vertical ──────────────────────────────────────────────
  // #cart-empty es hermano de #cart-items → innerHTML='' en #cart-items
  // nunca desconecta #cart-empty del DOM.
  function _renderCart() {
    const container   = document.getElementById('cart-items');
    const emptyEl     = document.getElementById('cart-empty');
    const totalEl     = document.getElementById('cart-total');
    const checkoutBtn = document.getElementById('btn-checkout');

    if (_cart.length === 0) {
      container.innerHTML = '';
      container.classList.add('hidden');
      emptyEl.classList.remove('hidden');
      checkoutBtn.classList.add('hidden');
      totalEl.textContent = '$0';
      return;
    }

    emptyEl.classList.add('hidden');
    container.classList.remove('hidden');
    checkoutBtn.classList.remove('hidden');
    container.innerHTML = '';

    let total = 0;
    for (const item of _cart) {
      total += item.subtotal;
      const colors = _catColor(item.familia);

      const el = document.createElement('div');
      el.className = 'cart-item';

      // Bullet de color de categoría
      const bullet = document.createElement('div');
      bullet.className        = 'cart-item-bullet';
      bullet.style.background = colors.bg;

      // Info: nombre + detalle extras
      const info = document.createElement('div');
      info.className = 'cart-item-info';

      const name = document.createElement('div');
      name.className   = 'cart-item-name';
      name.textContent = item.variante;
      info.appendChild(name);

      if (item.extras.length) {
        const detail = document.createElement('div');
        detail.className   = 'cart-item-detail';
        detail.textContent = item.extras.map(e => e.nombre).join(', ');
        info.appendChild(detail);
      }

      // Precio
      const price = document.createElement('div');
      price.className   = 'cart-item-price';
      price.textContent = `$${item.subtotal}`;

      // Botón quitar
      const remove = document.createElement('button');
      remove.className  = 'cart-item-remove';
      remove.textContent = '✕';
      remove.setAttribute('aria-label', `Quitar ${item.nombre}`);
      remove.addEventListener('click', (e) => {
        e.stopPropagation();
        _cart = _cart.filter(i => i.uid !== item.uid);
        _renderCart();
      });

      el.append(bullet, info, price, remove);
      container.appendChild(el);
    }

    totalEl.textContent = `$${total}`;
  }

  // ── CHECKOUT ──────────────────────────────────────────────────────────────
  function openCheckout() {
    if (_cart.length === 0) return;
    _paymentMethod = null;

    document.getElementById('input-customer-name').value = '';
    document.querySelectorAll('.payment-btn').forEach(b => b.classList.remove('active'));
    const confirmBtn = document.getElementById('btn-confirm-order');
    confirmBtn.disabled    = true;
    confirmBtn.textContent = 'CONFIRMAR ORDEN';

    // Rellenar resumen de ítems
    const list  = document.getElementById('checkout-items-list');
    list.innerHTML = '';
    let total = 0;

    for (const item of _cart) {
      const colors = _catColor(item.familia);
      total += item.subtotal;

      const row    = document.createElement('div');
      row.className = 'checkout-item-row';

      const bullet = document.createElement('div');
      bullet.className        = 'checkout-item-bullet';
      bullet.style.background = colors.bg;

      const info = document.createElement('div');
      info.className = 'checkout-item-info';

      const nm = document.createElement('div');
      nm.className   = 'checkout-item-name';
      nm.textContent = item.variante;
      info.appendChild(nm);

      if (item.extras.length) {
        const dt = document.createElement('div');
        dt.className   = 'checkout-item-detail';
        dt.textContent = item.extras.map(e => `+ ${e.nombre}`).join('  ');
        info.appendChild(dt);
      }

      const pr = document.createElement('div');
      pr.className   = 'checkout-item-price';
      pr.textContent = `$${item.subtotal}`;

      row.append(bullet, info, pr);
      list.appendChild(row);
    }

    document.getElementById('checkout-total-display').textContent = `$${total}`;

    // Mostrar con animación spring
    const overlay = document.getElementById('checkout-overlay');
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      overlay.classList.add('is-open');
    }));
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('input-customer-name').focus(), 380);
  }

  function closeCheckout() {
    const overlay = document.getElementById('checkout-overlay');
    overlay.classList.remove('is-open');
    setTimeout(() => overlay.classList.add('hidden'), 380);
    document.body.style.overflow = '';
  }

  function selectPayment(btn) {
    _paymentMethod = btn.dataset.method;
    document.querySelectorAll('.payment-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    updateCheckoutValidity();
  }

  function updateCheckoutValidity() {
    const name = document.getElementById('input-customer-name').value.trim();
    document.getElementById('btn-confirm-order').disabled = !(name && _paymentMethod);
  }

  async function confirmOrder() {
    const name = document.getElementById('input-customer-name').value.trim();
    if (!name || !_paymentMethod) return;

    // ── SINCRÓNICO: iniciar OAuth ANTES de cualquier await ───────────────────
    // requestAccessToken() usa window.open() internamente. Los navegadores solo
    // permiten window.open() dentro de un gesto de usuario activo. Si lo llamamos
    // después de un await, el popup queda bloqueado silenciosamente.
    VentasModule.startAuth();

    const btn = document.getElementById('btn-confirm-order');
    btn.disabled    = true;
    btn.textContent = 'GUARDANDO…';

    const folio = _nextFolio();
    const total = _cart.reduce((s, i) => s + i.subtotal, 0);

    _lastOrder = {
      folio,
      fecha:      new Date(),
      cliente:    name,
      metodoPago: _paymentMethod,
      items:      [..._cart],
      total,
    };

    try {
      await VentasModule.save(_lastOrder);
    } catch (e) {
      console.warn('[App] Venta encolada localmente:', e.message);
    }

    closeCheckout();
    setTimeout(() => _showConfirmation(_lastOrder), 420);
  }

  // ── CONFIRMACIÓN ──────────────────────────────────────────────────────────
  function _showConfirmation(order) {
    document.getElementById('confirmation-folio').textContent    = order.folio;
    document.getElementById('confirmation-customer').textContent = `Para: ${order.cliente}`;
    document.getElementById('confirmation-popup').classList.remove('hidden');
    setTimeout(() => TicketModule.generate(order), 500);
  }

  function downloadTicket() {
    if (_lastOrder) TicketModule.generate(_lastOrder);
  }

  function newOrder() {
    _cart      = [];
    _lastOrder = null;
    document.getElementById('confirmation-popup').classList.add('hidden');
    document.body.style.overflow = '';
    _renderCart();
  }

  // ── TOAST ─────────────────────────────────────────────────────────────────
  let _toastTimer = null;
  function _showToast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => el.classList.add('hidden'), 2400);
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    _startClock();
    _addCarouselWheelHandler();
    MenuModule.load();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    onMenuLoaded,
    showFamilyProducts,
    showFamilyMenu,
    openProductPopup,
    closeProductPopup,
    confirmProduct,
    openCheckout,
    closeCheckout,
    selectPayment,
    updateCheckoutValidity,
    confirmOrder,
    downloadTicket,
    newOrder,
  };

})();
