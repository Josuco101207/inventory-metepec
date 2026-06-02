import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:', { url: !!supabaseUrl, key: !!supabaseAnonKey });
}

// Use placeholder to prevent crash — auth calls will fail gracefully
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'implicit',
      // Disable the navigator.locks-based locking that deadlocks on reload
      lock: async (name, acquireTimeout, fn) => fn(),
      storageKey: 'sb-auth-token',
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
    global: {
      fetch: (...args) => {
        // Add a 10s timeout to every Supabase fetch to prevent hanging forever
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        // Merge AbortSignal into init options
        const [input, init = {}] = args;
        const mergedInit = { ...init, signal: controller.signal };

        return fetch(input, mergedInit).finally(() => clearTimeout(timeoutId));
      },
    },
  }
);

/**
 * Helper: fetch data from Supabase REST API directly with a timeout.
 * Bypasses the JS client entirely — useful for initial load on reload
 * when the gotrue client's internal state may not be ready yet.
 */
export const supabaseRestQuery = async (table, { select = '*', order, eq, single } = {}) => {
  const session = JSON.parse(localStorage.getItem('sb-auth-token') || 'null');
  const accessToken = session?.access_token;

  let url = `${supabaseUrl}/rest/v1/${table}?select=${encodeURIComponent(select)}`;

  if (order) {
    url += `&order=${order}`;
  }
  if (eq) {
    url += `&${eq.column}=eq.${eq.value}`;
  }
  if (single) {
    url += '&limit=1';
  }

  const headers = {
    'apikey': supabaseAnonKey,
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`REST ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return single ? (data[0] || null) : data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Timeout fetching ${table}`);
    }
    throw err;
  }
};
