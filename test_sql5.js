import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function check() {
  await supabase.rpc('exec_sql', { query: 'DROP POLICY IF EXISTS "auth_select_categories" ON public."categories"; CREATE POLICY "auth_select_categories" ON public."categories" FOR SELECT USING (true);' });
  const { data, error } = await supabase.from('categories').select('*');
  console.log('CATEGORIES:', data);
}
check();
