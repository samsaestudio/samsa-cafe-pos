# Samsa Café — Sistema POS Web

POS web para Samsa Café. Lee el menú desde Google Sheets y escribe las ventas al mismo Sheet. Sin backend propio.

---

## Stack

- HTML + CSS + JS vanilla
- Google Sheets API v4 (API Key lectura / OAuth2 escritura)
- jsPDF (CDN) para tickets PDF
- Deploy: Netlify vía GitHub

---

## Setup paso a paso

### 1. Google Cloud Console — API Key (lectura del menú)

1. Ve a [console.cloud.google.com](https://console.cloud.google.com)
2. Crea un proyecto nuevo o selecciona uno existente
3. Menú lateral → **APIs y Servicios** → **Biblioteca**
4. Busca y habilita: **Google Sheets API**
5. Ve a **Credenciales** → **Crear credenciales** → **Clave de API**
6. Copia la clave. Opcionalmente restringe el uso a:
   - Aplicaciones HTTP con tu dominio (ej: `https://tu-sitio.netlify.app/*`)
   - Solo la API de Sheets
7. En `config.js`, pega la clave en `API_KEY`

### 2. Google Sheets — Sheet ID y permisos de lectura

1. Abre tu Google Sheet del menú
2. El Sheet ID está en la URL:
   `https://docs.google.com/spreadsheets/d/**SHEET_ID**/edit`
3. En `config.js`, pega el ID en `SHEET_ID`
4. Para que el menú sea visible sin login: **Compartir** → **Cualquier persona con el enlace** → **Lector**

### 3. Estructura del Google Sheet

El Sheet debe tener exactamente estas hojas con estos encabezados:

**Hoja: `MENÚ`** (encabezados en fila 3, datos desde fila 4)

| A: ID | B: CATEGORÍA | C: PRODUCTO | D: VARIANTE | E: PRECIO | F: TEMP | G: TAMAÑO | H: TIPO LECHE | I: EXTRAS | J: DESCRIPCIÓN CORTA | K: NOTA INTERNA | L: ACTIVO |
|-------|-------------|------------|------------|---------|--------|---------|-------------|--------|---------------------|----------------|---------|
| CAF-01 | CAFÉ | Espresso Doble | Espresso Doble | 50 | N/A | N/A | N/A | N/A | Espresso doble shot | | S |
| CAF-04 | CAFÉ | Latte | Latte Caliente | 60 | Caliente | N/A | N/A | N/A | | | S |
| CAF-05 | CAFÉ | Latte | Latte Frío Chico | 65 | Frío | Chico | N/A | N/A | | | S |

- Columna **L: ACTIVO** = `S` para visible, `N` para oculto
- Columna **M (opcional)**: URL de imagen del producto
- `N/A` en columnas de opciones = esa dimensión no aplica

**Hoja: `EXTRAS`** (datos desde fila 4)

| A: ID | B: GRUPO | C: NOMBRE DEL EXTRA | D: DESCRIPCIÓN | E: PRECIO | F: ACTIVO | G: EXCLUSIVO |
|-------|---------|-------------------|--------------|---------|---------|------------|
| EX-01 | SMOOTHIES | Creatina | | 25 | S | |
| EX-02 | SMOOTHIES | Proteína Vainilla | | 30 | S | proteína |
| EX-03 | SMOOTHIES | Proteína Chocolate | | 30 | S | proteína |
| EX-04 | SMOOTHIES | Colágeno | | 30 | S | |

- Columna **G: EXCLUSIVO**: si dos extras comparten el mismo valor aquí, son radio buttons (solo se puede elegir uno). Dejar vacío para checkboxes independientes.

**Hoja: `VENTAS`** (el sistema escribe aquí)

| A: # ORDEN | B: FECHA | C: HORA | D: CLIENTE | E: CATEGORÍA | F: PRODUCTO | G: VARIANTE | H: TEMPERATURA | I: TAMAÑO | J: EXTRAS | K: PRECIO UNITARIO | L: PRECIO EXTRAS | M: SUBTOTAL ÍTEM | N: MÉTODO PAGO | O: TOTAL ORDEN |
|-----------|--------|-------|-----------|------------|-----------|-----------|--------------|---------|--------|------------------|---------------|----------------|--------------|-------------|

### 4. OAuth2 — Escritura de ventas (opcional pero recomendado)

Sin OAuth2, las ventas se guardan en `localStorage` del navegador como cola pendiente y nunca llegan al Sheet. Para habilitarla:

1. En Google Cloud Console → **Credenciales** → **Crear credenciales** → **ID de cliente OAuth 2.0**
2. Tipo de aplicación: **Aplicación web**
3. Orígenes JS autorizados: tu dominio (ej: `https://tu-sitio.netlify.app`)
4. Copia el **Client ID**
5. En `config.js`, pégalo en `OAUTH_CLIENT_ID`
6. En `index.html`, antes del cierre de `</body>`, agrega:
   ```html
   <script src="https://accounts.google.com/gsi/client" async defer></script>
   ```

> **Nota:** La primera vez que una barista confirme una orden, el navegador pedirá permisos de Google una sola vez.

### 5. Deploy en Netlify vía GitHub

1. Sube el proyecto a un repositorio de GitHub (**sin** `config.js` — está en `.gitignore`)
2. Ve a [netlify.com](https://netlify.com) → **Add new site** → **Import from Git**
3. Conecta tu repo de GitHub
4. Build settings: directorio base = `/`, sin build command, publish directory = `/`
5. Deploy
6. **Variables de entorno** no son necesarias (config.js se maneja localmente)

> Para producción: crea `config.js` manualmente en el servidor o injéctalo en el CI/CD de Netlify usando un build script.

---

## Imágenes de productos

Las imágenes locales están en la raíz del proyecto con el esquema `categoria-producto.png`. Para agregar la URL de imagen desde el Sheet, agrega una **columna M** (`IMG_URL`) en la hoja MENÚ con la URL directa de la imagen.

---

## Agregar productos y categorías nuevas

- **Nuevo producto**: agrega filas al Sheet en la hoja MENÚ. No toques el código.
- **Nueva categoría**: agrega filas con la nueva categoría. Para asignarle color, agrega una entrada en `CATEGORY_COLORS` en `config.js`.
- **Desactivar producto**: cambia columna L de `S` a `N`.

---

## Archivos

```
samsa-cafe-pos/
├── index.html       ← interfaz principal
├── styles.css       ← todos los estilos
├── app.js           ← lógica principal, navegación y estado
├── menu.js          ← lectura dinámica del menú desde Google Sheets
├── ventas.js        ← escritura de ventas a Google Sheets
├── ticket.js        ← generación de PDF del ticket
├── config.js        ← API keys y Sheet ID (gitignored)
├── .gitignore
└── README.md
```

---

## Contacto

Samsa Estudio — [@samsaestudio](https://instagram.com/samsaestudio)
