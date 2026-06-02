/**
 * Text similarity utilities for intelligent product mapping.
 * Uses Levenshtein distance + token-based matching to find the best
 * match between a supplier's product name and the existing catalog.
 */

function levenshteinDistance(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function normalize(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(str) {
  return normalize(str).split(' ').filter(Boolean);
}

function levenshteinSimilarity(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  const dist = levenshteinDistance(na, nb);
  return 1 - dist / Math.max(na.length, nb.length);
}

function tokenSimilarity(a, b) {
  const tokA = tokenize(a);
  const tokB = tokenize(b);
  if (!tokA.length || !tokB.length) return 0;
  let matches = 0;
  for (const t of tokA) {
    if (tokB.some(tb => tb === t || levenshteinDistance(t, tb) <= 1)) {
      matches++;
    }
  }
  return matches / Math.max(tokA.length, tokB.length);
}

function containsSimilarity(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  return 0;
}

/**
 * Combined similarity score between two strings.
 * Returns a value between 0 and 1.
 */
export function similarity(a, b) {
  if (!a || !b) return 0;
  const lev = levenshteinSimilarity(a, b);
  const tok = tokenSimilarity(a, b);
  const con = containsSimilarity(a, b);
  return Math.max(lev * 0.4 + tok * 0.6, con);
}

/**
 * Find best matches for a given query string against a catalog of items.
 * @param {string} query - The supplier's product name
 * @param {Array} catalog - Array of { name, category, id, ... } objects
 * @param {number} threshold - Minimum similarity score (0–1)
 * @param {number} maxResults - Max number of results to return
 * @returns {Array<{ item, score, isExact }>}
 */
export function findBestMatches(query, catalog, threshold = 0.35, maxResults = 5) {
  if (!query || !catalog.length) return [];

  const results = catalog
    .map(item => ({
      item,
      score: similarity(query, item.name),
      isExact: normalize(query) === normalize(item.name),
    }))
    .filter(r => r.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  return results;
}

/**
 * Suggest the most likely category for a product name based on keyword heuristics.
 */
export function suggestCategory(productName) {
  const n = normalize(productName);
  const rules = [
    { keywords: ['papel', 'tinta', 'pluma', 'lapiz', 'engrapador', 'clip', 'carpeta', 'folder', 'sobre', 'cinta', 'pegamento', 'tijera', 'marcador', 'goma'], category: 'Insumos y Papelería' },
    { keywords: ['arcade', 'boton', 'joystick', 'pantalla', 'monitor', 'placa', 'fuente', 'pcb', 'gabinete'], category: 'Repuestos Arcades' },
    { keywords: ['premio', 'juguete', 'peluch', 'munec', 'figurin', 'peluche', 'balon', 'pelota'], category: 'Premios y Juguetes' },
    { keywords: ['cable', 'usb', 'hdmi', 'cargador', 'bateria', 'pila', 'adaptador', 'sensor', 'led', 'foco', 'lampara', 'electr'], category: 'Electrónica y Gadgets' },
    { keywords: ['dulce', 'refresco', 'agua', 'botana', 'chocolate', 'gomita', 'palomita', 'nacho', 'paleta', 'chicle', 'aliment'], category: 'Alimentos y Dulcería' },
    { keywords: ['playera', 'camiseta', 'uniforme', 'gorra', 'mandil', 'chaleco', 'textil', 'tela'], category: 'Textiles y Uniformes' },
    { keywords: ['taza', 'vaso', 'llavero', 'souvenir', 'recuerdo', 'cristal', 'porcelana'], category: 'Cristalería y Souvenirs' },
    { keywords: ['router', 'servidor', 'switch', 'red', 'computador', 'laptop', 'impresora', 'toner', 'disco'], category: 'Infraestructura y TI' },
    { keywords: ['juego', 'mesa', 'dado', 'carta', 'domino', 'loteria', 'entretenimiento'], category: 'Juegos y Entretenimiento' },
    { keywords: ['volante', 'poster', 'banner', 'lona', 'pulsera', 'promocion', 'sticker', 'etiqueta'], category: 'Promocionales' },
  ];

  for (const rule of rules) {
    if (rule.keywords.some(kw => n.includes(kw))) {
      return rule.category;
    }
  }
  return 'Insumos y Papelería';
}
