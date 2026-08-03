import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function check() {
  const { data, error } = await supabase.rpc('exec_sql', { query: "SELECT policyname, permissive, roles, cmd, qual FROM pg_policies WHERE tablename = 'cat_asd';" });
  console.log('POLICIES:', data, 'ERROR:', error);
}
check();
