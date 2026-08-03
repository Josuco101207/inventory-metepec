import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function check() {
  const { data, error } = await supabase.rpc('exec_sql', { query: "SELECT routine_name FROM information_schema.routines WHERE routine_name = 'exec_sql';" });
  console.log('RPC:', data, 'ERROR:', error);
}
check();
