/**
 * Supabase storage layer for inventory items and movements.
 * Each category has its own table in Supabase (e.g. cat_herramientas).
 * Movements are stored in a shared `movements` table.
 */
import { supabase } from '../lib/supabase';

// ─── ITEMS ───

export const fetchItems = async (tableName) => {
  if (!tableName) return [];
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(10000)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error(`[SupabaseStorage] fetchItems(${tableName}):`, err.message);
    return [];
  }
};

export const insertItem = async (tableName, item) => {
  if (!tableName) throw new Error('No table name');
  try {
    const { id: _id, createdAt: _createdAt, created_at: _created_at, ...rest } = item;
    const { data, error } = await supabase
      .from(tableName)
      .insert([rest])
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    console.error(`[SupabaseStorage] insertItem(${tableName}):`, err.message);
    throw err;
  }
};

export const updateItem = async (tableName, itemId, updates) => {
  if (!tableName || !itemId) throw new Error('Missing table or id');
  try {
    const { id: _id, createdAt: _createdAt, created_at: _created_at, ...rest } = updates;
    const { data, error } = await supabase
      .from(tableName)
      .update(rest)
      .eq('id', itemId)
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    console.error(`[SupabaseStorage] updateItem(${tableName}, ${itemId}):`, err.message);
    throw err;
  }
};

export const deleteItem = async (tableName, itemId) => {
  if (!tableName || !itemId) throw new Error('Missing table or id');
  try {
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq('id', itemId);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error(`[SupabaseStorage] deleteItem(${tableName}, ${itemId}):`, err.message);
    throw err;
  }
};

// ─── MOVEMENTS ───

export const fetchMovements = async (page = 1, pageSize = 2000) => {
  try {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    
    const { data, error, count } = await supabase
      .from('movements')
      .select('*', { count: 'exact' })
      .order('timestamp', { ascending: false })
      .range(from, to);
      
    if (error) throw error;
    return { data: data || [], count: count || 0 };
  } catch (err) {
    console.error('[SupabaseStorage] fetchMovements:', err.message);
    return { data: [], count: 0 };
  }
};

export const fetchGlobalStats = async (categoryTables) => {
  try {
    let totalItems = 0;
    let criticalItems = [];

    // Fetch only essential columns from all tables to minimize bandwidth
    await Promise.all(categoryTables.map(async (table) => {
      if (!table.tableName) return;
      
      const validCols = new Set((table.schema || []).map(f => f.name?.toLowerCase()));
      const colsToSelect = new Set();
      
      // Always select id if it exists
      if (validCols.has('id')) colsToSelect.add('id');
      
      const map = table.fieldMappings || {};
      const nameCol = map.name || 'name';
      const qtyCol = map.qty || 'qty';
      const threshCol = map.threshold || 'threshold';
      
      if (validCols.has(nameCol.toLowerCase())) colsToSelect.add(nameCol);
      if (validCols.has(qtyCol.toLowerCase())) colsToSelect.add(qtyCol);
      if (validCols.has(threshCol.toLowerCase())) colsToSelect.add(threshCol);
      if (map.unit && validCols.has(map.unit.toLowerCase())) colsToSelect.add(map.unit);

      // Si no tenemos validCols (schema vacío), fallamos seguro usando select(*)
      // pero esto casi nunca pasa porque schema siempre viene de CategoriesContext
      const selectStr = colsToSelect.size > 0 ? Array.from(colsToSelect).join(', ') : '*';

      const { data, error } = await supabase
        .from(table.tableName)
        .select(selectStr);
      
      if (!error && data) {
        totalItems += data.length;
        const criticals = data.filter(i => {
           const q = i[qtyCol] || 0;
           const t = i[threshCol] || 0;
           return q <= t && t > 0;
        });
        criticalItems.push(...criticals.map(c => ({
           id: c.id,
           name: c[nameCol],
           qty: c[qtyCol] || 0,
           threshold: c[threshCol] || 0,
           category: table.title,
           unit: c[map.unit || 'unit'] || 'pz'
        })));
      } else if (error) {
         console.warn(`[SupabaseStorage] fetchGlobalStats error for ${table.tableName}:`, error.message);
      }
    }));

    // Fetch movements count
    const { count: movementsCount } = await supabase
      .from('movements')
      .select('*', { count: 'exact', head: true });

    return {
      items: totalItems,
      critical: criticalItems.length,
      criticalItems: criticalItems,
      movements: movementsCount || 0
    };
  } catch (err) {
    console.error('[SupabaseStorage] fetchGlobalStats:', err.message);
    return null;
  }
};

export const fetchActivityForDays = async (days) => {
  try {
    const startDate = new Date();
    startDate.setHours(0,0,0,0);
    startDate.setDate(startDate.getDate() - (days - 1));

    const { data, error } = await supabase
      .from('movements')
      .select('timestamp')
      .gte('timestamp', startDate.toISOString());

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[SupabaseStorage] fetchActivityForDays:', err.message);
    return [];
  }
};

export const fetchMovementsByDate = async (dateStr) => {
  try {
    // Use local midnight offsets to cover full local day regardless of UTC offset
    const localStart = new Date(`${dateStr}T00:00:00`);
    const localEnd   = new Date(`${dateStr}T23:59:59.999`);
    const { data, error } = await supabase
      .from('movements')
      .select('*')
      .gte('timestamp', localStart.toISOString())
      .lte('timestamp', localEnd.toISOString())
      .order('timestamp', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[SupabaseStorage] fetchMovementsByDate:', err.message);
    return [];
  }
};

export const insertMovement = async (movement) => {
  try {
    const { id: _id, ...rest } = movement;
    const { data, error } = await supabase
      .from('movements')
      .insert([rest])
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[SupabaseStorage] insertMovement:', err.message);
    return null;
  }
};

export const updateMovement = async (movementId, updates) => {
  try {
    const { data, error } = await supabase
      .from('movements')
      .update(updates)
      .eq('id', movementId)
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[SupabaseStorage] updateMovement:', err.message);
    return null;
  }
};

// ─── PERSONNEL ───

export const fetchPersonnel = async () => {
  try {
    const { data, error } = await supabase
      .from('personnel')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[SupabaseStorage] fetchPersonnel:', err.message);
    return [];
  }
};

export const insertPersonnel = async (person) => {
  try {
    const { id: _id, createdAt: _createdAt, created_at: _created_at, ...rest } = person;
    const { data, error } = await supabase
      .from('personnel')
      .insert([rest])
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[SupabaseStorage] insertPersonnel:', err.message);
    return null;
  }
};

export const deletePersonnel = async (id) => {
  try {
    const { error } = await supabase
      .from('personnel')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('[SupabaseStorage] deletePersonnel:', err.message);
    return false;
  }
};

// ─── BRANDS ───

export const fetchBrands = async () => {
  try {
    const { data, error } = await supabase
      .from('brands')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[SupabaseStorage] fetchBrands:', err.message);
    return [];
  }
};

export const insertBrand = async (name) => {
  try {
    const { data, error } = await supabase
      .from('brands')
      .insert([{ name }])
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[SupabaseStorage] insertBrand:', err.message);
    return null;
  }
};

export const deleteBrand = async (id) => {
  try {
    const { error } = await supabase
      .from('brands')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('[SupabaseStorage] deleteBrand:', err.message);
    return false;
  }
};

// ─── SUBCATEGORIES ───

export const fetchSubcategories = async () => {
  try {
    const { data, error } = await supabase
      .from('subcategories')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[SupabaseStorage] fetchSubcategories:', err.message);
    return [];
  }
};

export const insertSubcategory = async (name) => {
  try {
    const { data, error } = await supabase
      .from('subcategories')
      .insert([{ name }])
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[SupabaseStorage] insertSubcategory:', err.message);
    return null;
  }
};

export const deleteSubcategory = async (id) => {
  try {
    const { error } = await supabase
      .from('subcategories')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('[SupabaseStorage] deleteSubcategory:', err.message);
    return false;
  }
};

// ─── LOCATIONS ───

export const fetchLocations = async () => {
  try {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[SupabaseStorage] fetchLocations:', err.message);
    return [];
  }
};

export const insertLocation = async (name, zone = '') => {
  try {
    const { data, error } = await supabase
      .from('locations')
      .insert([{ name, zone }])
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[SupabaseStorage] insertLocation:', err.message);
    return null;
  }
};

export const deleteLocation = async (id) => {
  try {
    const { error } = await supabase
      .from('locations')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('[SupabaseStorage] deleteLocation:', err.message);
    return false;
  }
};

// ─── SUPERVISOR VALIDATION ───

/**
 * Validates supervisor credentials by calling a Supabase RPC.
 * The RPC 'validate_supervisor' securely verifies email and password
 * and returns user details if role is admin or supervisor.
 */
export const validateSupervisorCredentials = async (email, password) => {
  try {
    const { data, error } = await supabase.rpc('validate_supervisor', {
      p_email: email,
      p_password: password
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data || !data.success) {
      throw new Error('Credenciales incorrectas o el usuario no tiene permisos de supervisor');
    }

    return {
      success: true,
      id: data.id,
      name: data.name || email,
      role: data.role,
    };
  } catch (err) {
    console.error('[SupabaseStorage] validateSupervisorCredentials error:', err);
    throw err;
  }
};
