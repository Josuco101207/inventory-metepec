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

export const fetchMovements = async (limit = 2000) => {
  try {
    const data = await restFetch(`movements?select=*&order=timestamp.desc&limit=${limit}`);
    return data || [];
  } catch (err) {
    console.error('[SupabaseStorage] fetchMovements:', err.message);
    return [];
  }
};

export const fetchMovementsByDate = async (dateStr) => {
  try {
    // Use local midnight offsets to cover full local day regardless of UTC offset
    const localStart = new Date(`${dateStr}T00:00:00`);
    const localEnd   = new Date(`${dateStr}T23:59:59.999`);
    const data = await restFetch(
      `movements?select=*&timestamp=gte.${localStart.toISOString()}&timestamp=lte.${localEnd.toISOString()}&order=timestamp.desc`
    );
    return data || [];
  } catch (err) {
    console.error('[SupabaseStorage] fetchMovementsByDate:', err.message);
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

// ─── PERSONNEL ───

export const fetchPersonnel = async () => {
  try {
    const data = await restFetch('personnel?select=*&order=created_at.asc');
    return data || [];
  } catch (err) {
    console.error('[SupabaseStorage] fetchPersonnel:', err.message);
    return [];
  }
};

export const insertPersonnel = async (person) => {
  try {
    const { id, createdAt, created_at, ...rest } = person;
    const data = await restFetch('personnel', { method: 'POST', body: JSON.stringify(rest) });
    return data?.[0] || data;
  } catch (err) {
    console.error('[SupabaseStorage] insertPersonnel:', err.message);
    return null;
  }
};

export const deletePersonnel = async (id) => {
  try {
    await restFetch(`personnel?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
    return true;
  } catch (err) {
    console.error('[SupabaseStorage] deletePersonnel:', err.message);
    return false;
  }
};

// ─── BRANDS ───

export const fetchBrands = async () => {
  try {
    const data = await restFetch('brands?select=*&order=name.asc');
    return data || [];
  } catch (err) {
    console.error('[SupabaseStorage] fetchBrands:', err.message);
    return [];
  }
};

export const insertBrand = async (name) => {
  try {
    const data = await restFetch('brands', { method: 'POST', body: JSON.stringify({ name }) });
    return data?.[0] || data;
  } catch (err) {
    console.error('[SupabaseStorage] insertBrand:', err.message);
    return null;
  }
};

export const deleteBrand = async (id) => {
  try {
    await restFetch(`brands?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
    return true;
  } catch (err) {
    console.error('[SupabaseStorage] deleteBrand:', err.message);
    return false;
  }
};

// ─── LOCATIONS ───

export const fetchLocations = async () => {
  try {
    const data = await restFetch('locations?select=*&order=name.asc');
    return data || [];
  } catch (err) {
    console.error('[SupabaseStorage] fetchLocations:', err.message);
    return [];
  }
};

export const insertLocation = async (name, zone = '') => {
  try {
    const data = await restFetch('locations', { method: 'POST', body: JSON.stringify({ name, zone }) });
    return data?.[0] || data;
  } catch (err) {
    console.error('[SupabaseStorage] insertLocation:', err.message);
    return null;
  }
};

export const deleteLocation = async (id) => {
  try {
    await restFetch(`locations?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
    return true;
  } catch (err) {
    console.error('[SupabaseStorage] deleteLocation:', err.message);
    return false;
  }
};
