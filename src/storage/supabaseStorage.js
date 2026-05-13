/**
 * Supabase storage layer for inventory items.
 * Each category has its own table in Supabase (e.g. cat_herramientas).
 * The table name comes from the category's `tableName` field.
 */
import { supabase } from '../lib/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const getToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
};

const restFetch = async (path, options = {}) => {
  const token = await getToken();
  if (!token) throw new Error('No auth session');
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || 'return=representation',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Supabase REST error: ${res.status}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
};

/**
 * Fetch all items from a category table
 */
export const fetchItems = async (tableName) => {
  if (!tableName) return [];
  try {
    const data = await restFetch(`${tableName}?select=*&order=created_at.desc`);
    return data || [];
  } catch (err) {
    console.error(`[SupabaseStorage] fetchItems(${tableName}):`, err.message);
    return [];
  }
};

/**
 * Insert a new item into a category table
 */
export const insertItem = async (tableName, item) => {
  if (!tableName) throw new Error('No table name');
  // Remove fields that don't belong in the DB (id and created_at are auto-generated)
  const { id, createdAt, created_at, ...rest } = item;
  const data = await restFetch(tableName, {
    method: 'POST',
    body: JSON.stringify(rest),
  });
  return data?.[0] || data;
};

/**
 * Update an item in a category table
 */
export const updateItem = async (tableName, itemId, updates) => {
  if (!tableName || !itemId) throw new Error('Missing table or id');
  const { id, createdAt, created_at, ...rest } = updates;
  const data = await restFetch(`${tableName}?id=eq.${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(rest),
  });
  return data?.[0] || data;
};

/**
 * Delete an item from a category table
 */
export const deleteItem = async (tableName, itemId) => {
  if (!tableName || !itemId) throw new Error('Missing table or id');
  await restFetch(`${tableName}?id=eq.${itemId}`, {
    method: 'DELETE',
    prefer: 'return=minimal',
  });
  return true;
};
