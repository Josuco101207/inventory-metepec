const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  // Check categories
  const { data: cats, error: catErr } = await supabase.from('categories').select('*');
  console.log('Categories:', cats);
  if (catErr) console.error('CatErr:', catErr);

  if (cats && cats.length > 0) {
    for (const cat of cats) {
      const { data: items, error: itemErr } = await supabase.from(cat.table_name).select('*');
      console.log(`Table ${cat.table_name} items:`, items);
      if (itemErr) console.error(`ItemErr for ${cat.table_name}:`, itemErr);
    }
  }
}
check();
