const itemParser = require('./src/utils/itemParser.js');
const rows = [
  { id: 'c18089d6-b08b-444e-8ed8-1c0a67f1340f', created_at: '2026-07-31T17:53:33.862413+00:00', name: 'asd', qty: 1, stock_min: 1, subcategoria: null, marca: 'asd', location: null },
  { id: 'bbff2652-3eb4-47a3-ab1a-964223f62c0e', created_at: '2026-07-31T17:54:19.467888+00:00', name: 'dsa', qty: 1, stock_min: 1, subcategoria: null, marca: 'dsa', location: null }
];
const cat = { title: 'Ejemplo', tableName: 'cat_ejemplo', fieldMappings: {} };

const keys = Object.keys(rows[0]).map(k => k.toLowerCase());
const actualKeysMap = {};
Object.keys(rows[0]).forEach(k => { actualKeysMap[k.toLowerCase()] = k; });

const smartFindColumn = (goodWords, badWords = []) => {
  let bestMatch = null;
  let maxScore = 0;
  for (const col of keys) {
    if (col === 'id' || col === 'created_at' || col === 'updated_at') continue;
    let score = 0;
    if (goodWords.includes(col)) score += 100;
    else {
      for (const w of goodWords) if (col.includes(w)) score += 30;
    }
    for (const w of badWords) if (col.includes(w)) score -= 100;
    if (score > maxScore) { maxScore = score; bestMatch = col; }
  }
  return bestMatch ? actualKeysMap[bestMatch] : null;
};

const map = cat.fieldMappings || {};
const nameKey = smartFindColumn(['nombre', 'titulo', 'title', 'producto', 'articulo', 'name', 'nom'], ['desc', 'obs', 'detal']);
const threshKey = smartFindColumn(['stock_min', 'minimo', 'min', 'threshold', 'limite', 'alerta', 'bajo'], ['nom', 'name']);
const obsKey = smartFindColumn(['detalles', 'notas', 'descripcion', 'observaciones', 'obs', 'coment'], ['nom', 'name', 'tit']);
const qtyKey = smartFindColumn(['cantidad', 'canticad', 'stock', 'existencias', 'piezas', 'qty', 'cant', 'can', 'unidades', 'uds', 'pz', 'num', 'total'], ['min', 'limit', 'alert', 'thresh', 'bajo', 'max']);

const newItems = rows.map(row => {
  const normalizedRow = { ...row };
  if (map.name && row[map.name] !== undefined && normalizedRow.name === undefined) normalizedRow.name = row[map.name];
  if (map.qty && row[map.qty] !== undefined && normalizedRow.qty === undefined) normalizedRow.qty = row[map.qty];
  if (map.observaciones && row[map.observaciones] !== undefined && normalizedRow.observaciones === undefined) normalizedRow.observaciones = row[map.observaciones];
  if (map.threshold && row[map.threshold] !== undefined && normalizedRow.threshold === undefined) normalizedRow.threshold = row[map.threshold];

  if (nameKey && normalizedRow.name === undefined) normalizedRow.name = row[nameKey];
  if (qtyKey && normalizedRow.qty === undefined) normalizedRow.qty = row[qtyKey];
  if (obsKey && normalizedRow.observaciones === undefined) normalizedRow.observaciones = row[obsKey];
  if (threshKey && normalizedRow.threshold === undefined) normalizedRow.threshold = row[threshKey];
  
  return { ...normalizedRow, category: cat.title, _tableName: cat.tableName };
});

console.log(newItems);
