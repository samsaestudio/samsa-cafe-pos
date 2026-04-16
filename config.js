// config.js — Samsa Café POS
// IMPORTANTE: este archivo está en .gitignore. No subir al repositorio.

const CONFIG = {
  SHEET_ID: '19SmPH3-xRrumrHPy0aq3KeMrSdavGQQ6yI9hYMND4Rg',
  API_KEY:  'AIzaSyCbEFRCPPcPrDjj50WtwoESctCm-0WH8vA',
  OAUTH_CLIENT_ID: '', // Llenar con tu OAuth Client ID para habilitar escritura
  SHEET_NAME_MENU:   'MENÚ',
  SHEET_NAME_EXTRAS: 'EXTRAS',
  SHEET_NAME_VENTAS: 'VENTAS',
  // Rango: encabezados en fila 3, datos desde fila 4
  MENU_RANGE:   'MENÚ!A4:N',   // hasta col N (FAMILIA)
  EXTRAS_RANGE: 'EXTRAS!A4:G',
  VENTAS_RANGE: 'VENTAS!A4:O',
};

// Colores por categoría. Se puede extender sin tocar lógica.
const CATEGORY_COLORS = {
  'CAFÉ':      { bg: '#AED768', text: '#1A1A1A' },
  'CAFE':      { bg: '#AED768', text: '#1A1A1A' },
  'SMOOTHIE':  { bg: '#E6AFFC', text: '#1A1A1A' },
  'SMOOTHIES': { bg: '#E6AFFC', text: '#1A1A1A' },
  'ALIMENTO':  { bg: '#FFB012', text: '#1A1A1A' },
  'ALIMENTOS': { bg: '#FFB012', text: '#1A1A1A' },
  'BEBIDA':    { bg: '#000000', text: '#FFFFFF' },
  'BEBIDAS':   { bg: '#000000', text: '#FFFFFF' },
};

const DEFAULT_CATEGORY_COLOR = { bg: '#C47F2C', text: '#FFFFFF' };
