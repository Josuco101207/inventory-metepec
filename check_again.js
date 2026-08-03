import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function check() {
  const { data, error } = await supabase.from('categories').select('*');
  console.log('CATEGORIES:', data);
  const { data: data2, error: error2 } = await supabase.from('cat_asd').select('*');
  console.log('CAT_ASD:', data2);
}
check();
