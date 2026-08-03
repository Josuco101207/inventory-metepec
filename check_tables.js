import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function check() {
  const { data, error } = await supabase.rpc('exec_sql', { query: 'SELECT table_name FROM information_schema.tables WHERE table_schema=''public'' AND table_name LIKE ''cat_%'';' });
  console.log('DATA:', data);
}
check();
