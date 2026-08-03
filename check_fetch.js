import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
async function check() {
  const res = await fetch(supabaseUrl + '/rest/v1/cat_asd?select=*', {
    headers: { 'apikey': supabaseKey }
  });
  console.log('ANON:', await res.json());
}
check();
