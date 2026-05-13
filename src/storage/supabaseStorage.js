/**
 * Supabase storage layer for inventory items and movements.
 * Each category has its own table in Supabase (e.g. cat_herramientas).
 * Movements are stored in a shared `movements` table.
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

// ─── ITEMS ───

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

export const insertItem = async (tableName, item) => {
  if (!tableName) throw new Error('No table name');
  const { id, createdAt, created_at, ...rest } = item;
  const data = await restFetch(tableName, {
    method: 'POST',
    body: JSON.stringify(rest),
  });
  return data?.[0] || data;
};

export const updateItem = async (tableName, itemId, updates) => {
  if (!tableName || !itemId) throw new Error('Missing table or id');
  const { id, createdAt, created_at, ...rest } = updates;
  const data = await restFetch(`${tableName}?id=eq.${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(rest),
  });
  return data?.[0] || data;
};

export const deleteItem = async (tableName, itemId) => {
  if (!tableName || !itemId) throw new Error('Missing table or id');
  await restFetch(`${tableName}?id=eq.${itemId}`, {
    method: 'DELETE',
    prefer: 'return=minimal',
  });
  return true;
};

// ─── MOVEMENTS ───

export const fetchMovements = async (limit = 500) => {
  try {
    const data = await restFetch(`movements?select=*&order=timestamp.desc&limit=${limit}`);
    return data || [];
  } catch (err) {
    console.error('[SupabaseStorage] fetchMovements:', err.message);
    return [];
  }
};

export const insertMovement = async (movement) => {
  try {
    const { id, ...rest } = movement;
    const data = await restFetch('movements', {
      method: 'POST',
      body: JSON.stringify(rest),
    });
    return data?.[0] || data;
  } catch (err) {
    console.error('[SupabaseStorage] insertMovement:', err.message);
    return null;
  }
};

export const updateMovement = async (movementId, updates) => {
  try {
    const data = await restFetch(`movements?id=eq.${movementId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    return data?.[0] || data;
  } catch (err) {
    console.error('[SupabaseStorage] updateMovement:', err.message);
    return null;
  }
};
