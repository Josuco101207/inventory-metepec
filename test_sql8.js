import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function check() {
  await supabase.rpc('exec_sql', { query: 'CREATE OR REPLACE FUNCTION get_movements_policies() RETURNS json AS $$ DECLARE result json; BEGIN SELECT json_agg(t) INTO result FROM pg_policies t WHERE tablename = \'movements\'; RETURN result; END; $$ LANGUAGE plpgsql;' });
  const { data } = await supabase.rpc('get_movements_policies');
  console.log('POLICIES:', data);
}
check();
