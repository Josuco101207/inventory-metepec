import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function check() {
  await supabase.rpc('exec_sql', { query: 'DROP POLICY IF EXISTS "auth_select_cat_ejemplo" ON public."cat_ejemplo"; CREATE POLICY "auth_select_cat_ejemplo" ON public."cat_ejemplo" FOR SELECT USING (true);' });
  const { data, error } = await supabase.from('cat_ejemplo').select('*');
  console.log('ROWS:', data);
  console.log('ERROR:', error);
}
check();
