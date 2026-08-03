import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testFlow() {
  // 1. Fetch categories
  const { data: categories } = await supabase.from('categories').select('*');
  const cat = categories.find(c => c.title === 'asd');
  console.log('Category ASD:', cat);

  // 2. Fetch items
  const tableName = cat.table_name || 'cat_asd';
  const { data: rows } = await supabase.from(tableName).select('*');
  console.log('Items in DB:', rows.length, rows);

  // 3. Process like loadAllItems
  const newItemsMap = {};
  if (rows.length > 0) {
    const firstRow = rows[0];
    const keys = Object.keys(firstRow).map(k => k.toLowerCase());
    
    const smartFindColumn = (goodWords, badWords = []) => {
      let bestMatch = null; let maxScore = 0;
      for (const col of keys) {
        if (['id', 'created_at', 'updated_at'].includes(col)) continue;
        let score = 0;
        if (goodWords.includes(col)) score += 100;
        else for (const w of goodWords) if (col.includes(w)) score += 30;
        for (const w of badWords) if (col.includes(w)) score -= 50;
        if (score > maxScore) { maxScore = score; bestMatch = col; }
      }
      return bestMatch;
    };

    let fieldMappings = {};
    if (typeof cat.field_mappings === 'string') fieldMappings = JSON.parse(cat.field_mappings);
    else fieldMappings = cat.field_mappings || {};

    const map = fieldMappings;
    const nameKey = smartFindColumn(['nombre', 'titulo', 'title', 'producto', 'articulo', 'name', 'nom'], ['desc', 'obs', 'detal']);
    const descKey = smartFindColumn(['desc', 'observ', 'detal', 'info']);
    const qtyKey = smartFindColumn(['qty', 'cantidad', 'stock', 'cant']);

    rows.forEach(row => {
      const normalizedRow = { ...row };
      if (nameKey && normalizedRow.name === undefined) normalizedRow.name = row[nameKey];
      if (qtyKey && normalizedRow.qty === undefined) normalizedRow.qty = row[qtyKey];
      newItemsMap[normalizedRow.id] = { ...normalizedRow, category: cat.title, _tableName: tableName };
    });
  }

  const items = Object.values(newItemsMap);
  console.log('Processed Items:', items);

  // 4. Filter Worker logic
  const filtered = [];
  const categoryTitle = 'asd';
  for (const item of items) {
    if (item.category !== categoryTitle) {
      console.log('Filtered out by category:', item.category, '!==', categoryTitle);
      continue;
    }
    filtered.push(item);
  }
  console.log('Final filtered items:', filtered.length);
}
testFlow();
