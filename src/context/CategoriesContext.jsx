import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, supabaseRestQuery } from '../lib/supabase';
import { useAuth } from './AuthContext';

const CategoriesContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useCategories = () => useContext(CategoriesContext);

// Fallback icons mapping (same as before)
const ICON_NAMES = [
  'PenTool', 'Gift', 'Cpu', 'Cookie', 'Shirt', 'Trophy',
  'Server', 'Gamepad2', 'Megaphone', 'Settings', 'Package',
  'Wrench', 'Zap', 'ShoppingCart', 'Box', 'Archive',
  'Layers', 'Tag', 'Folder', 'Database'
];

// Columns that are system-managed and should never appear in forms
const SYSTEM_COLUMNS = ['id', 'created_at', 'updated_at'];

const fetchCategoriesFromSupabase = async () => {
  try {
    // Try REST API first (avoids gotrue lock deadlocks on reload)
    const data = await supabaseRestQuery('categories', {
      select: '*',
      order: 'title.asc',
    });
    return data;
  } catch (restErr) {
    console.warn('[Categories] REST query failed, trying SDK:', restErr.message);
    // Fallback to SDK
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('title');
      if (error) throw error;
      return data;
    } catch (sdkErr) {
      console.error('[Categories] SDK also failed:', sdkErr.message);
      return null;
    }
  }
};

/**
 * Fetch the real Postgres columns for a table using the get_table_columns RPC.
 * Returns an array of { name, label, type } for non-system columns.
 */
const fetchTableSchema = async (tableName) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const { data, error } = await supabase.rpc('get_table_columns', {
      p_table_name: tableName
    });
    
    clearTimeout(timeoutId);

    if (error) throw error;
    if (!Array.isArray(data)) return null;

    // Filter out system columns and transform to schema format
    let schema = data
      .filter(col => !SYSTEM_COLUMNS.includes(col.column_name))
      .map(col => ({
        name: col.column_name,
        label: col.column_name.charAt(0).toUpperCase() + col.column_name.slice(1).replace(/_/g, ' '),
        type: col.data_type,
      }));

    // No inyectamos campos artificiales porque Supabase rechazará los inserts
    // si las columnas no existen físicamente en la tabla.

    return schema;
  } catch (err) {
    console.error(`[Categories] Schema introspection failed for ${tableName}:`, err.message);
    return null;
  }
};

// Transform Supabase row to the format the app expects
const transformCategory = (row) => {
  let colNames = [];
  try {
    const parsedSchema = typeof row.schema === 'string' ? JSON.parse(row.schema) : (row.schema || []);
    colNames = Array.isArray(parsedSchema) ? parsedSchema.map(c => c.name?.toLowerCase()).filter(Boolean) : [];
  } catch { /* ignore */ }
  
  const smartFindColumn = (goodWords, badWords = []) => {
    let bestMatch = null;
    let maxScore = 0;

    for (const col of colNames) {
      if (col === 'id' || col === 'created_at' || col === 'updated_at') continue;
      let score = 0;
      const lowerCol = col.toLowerCase();

      if (goodWords.includes(lowerCol)) {
        score += 100; // Exact match huge bonus
      } else {
        for (const w of goodWords) {
          if (lowerCol.includes(w)) score += 30; // Partial match points
        }
      }

      for (const w of badWords) {
        if (lowerCol.includes(w)) score -= 100; // Heavy penalty
      }

      if (score > maxScore) {
        maxScore = score;
        bestMatch = col;
      }
    }
    return bestMatch;
  };

  return {
    id: row.slug,
    title: row.title,
    shortTitle: row.short_title,
    route: row.route,
    viewId: row.view_id,
    iconName: row.icon_name || 'Package',
    zone: row.zone || 'arcade',
    tableName: row.table_name,
    // schema will be overwritten by real columns after introspection
    schema: typeof row.schema === 'string' ? JSON.parse(row.schema) : (row.schema || []),
    fieldMappings: typeof row.field_mappings === 'string' ? JSON.parse(row.field_mappings) : (row.field_mappings || {
      name: smartFindColumn(['nombre', 'titulo', 'title', 'producto', 'articulo', 'name', 'nom'], ['desc', 'obs', 'detal']) || 'name',
      qty: smartFindColumn(['cantidad', 'canticad', 'stock', 'existencias', 'piezas', 'qty', 'cant', 'can', 'unidades', 'uds', 'pz', 'num', 'total'], ['min', 'limit', 'alert', 'thresh', 'bajo', 'max']) || 'qty',
      observaciones: smartFindColumn(['detalles', 'notas', 'descripcion', 'observaciones', 'obs', 'coment'], ['nom', 'name', 'tit']) || 'observaciones',
      threshold: smartFindColumn(['stock_min', 'minimo', 'min', 'threshold', 'limite', 'alerta', 'bajo'], ['nom', 'name']) || 'threshold'
    }),
    supabaseId: row.id,
  };
};

export const CategoriesProvider = ({ children }) => {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadCategories = useCallback(async () => {
    if (!user) {
      setCategories([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let done = false;

    // Safety timeout — prevent hanging forever
    const loadingTimeout = setTimeout(() => {
      if (!done) {
        console.warn('Categories loading timeout — forcing load');
        done = true;
        setLoading(false);
      }
    }, 8000);

    try {
      // console.log('[Categories] Fetching categories...');
      const data = await fetchCategoriesFromSupabase();
      // console.log('[Categories] Fetched:', data ? data.length : 'null');
      
      if (data && Array.isArray(data)) {
        const baseCats = data.map(transformCategory);

        // Introspect real table columns for each category (in parallel, with individual timeouts)
        const enriched = await Promise.all(
          baseCats.map(async (cat) => {
            if (!cat.tableName) return cat;
            try {
              const schemaPromise = fetchTableSchema(cat.tableName);
              let timer;
              const timeoutPromise = new Promise(resolve => timer = setTimeout(() => resolve(null), 5000));
              const realSchema = await Promise.race([schemaPromise, timeoutPromise]);
              if (timer) clearTimeout(timer);
              
              if (realSchema && realSchema.length > 0) {
                // Recalculate fieldMappings based on the REAL physical columns
                const colNames = realSchema.map(c => c.name?.toLowerCase()).filter(Boolean);
                
                const smartFindColumn = (goodWords, badWords = []) => {
                  let bestMatch = null;
                  let maxScore = 0;
                  for (const col of colNames) {
                    if (col === 'id' || col === 'created_at' || col === 'updated_at') continue;
                    let score = 0;
                    const lowerCol = col.toLowerCase();
                    if (goodWords.includes(lowerCol)) score += 100;
                    else {
                      for (const w of goodWords) if (lowerCol.includes(w)) score += 30;
                    }
                    for (const w of badWords) if (lowerCol.includes(w)) score -= 100;
                    if (score > maxScore) { maxScore = score; bestMatch = col; }
                  }
                  return bestMatch;
                };

                const newFieldMappings = {
                  name: smartFindColumn(['nombre', 'titulo', 'title', 'producto', 'articulo', 'name', 'nom'], ['desc', 'obs', 'detal']) || 'name',
                  qty: smartFindColumn(['cantidad', 'canticad', 'stock', 'existencias', 'piezas', 'qty', 'cant', 'can', 'unidades', 'uds', 'pz', 'num', 'total'], ['min', 'limit', 'alert', 'thresh', 'bajo', 'max']) || 'qty',
                  observaciones: smartFindColumn(['detalles', 'notas', 'descripcion', 'observaciones', 'obs', 'coment'], ['nom', 'name', 'tit']) || 'observaciones',
                  threshold: smartFindColumn(['stock_min', 'minimo', 'min', 'threshold', 'limite', 'alerta', 'bajo'], ['nom', 'name']) || 'threshold'
                };

                return { ...cat, schema: realSchema, fieldMappings: newFieldMappings };
              }
            } catch (err) {
              console.warn(`[Categories] Schema fetch failed for ${cat.tableName}`, err);
            }
            // Fallback to the static schema from the categories table
            return cat;
          })
        );

        setCategories(enriched);
      }
    } catch (err) {
      console.error('[Categories] Load error:', err);
    } finally {
      if (!done) {
        done = true;
        clearTimeout(loadingTimeout);
        setLoading(false);
      }
    }
  }, [user]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Helper functions and state value in a single optimized useMemo
  const providerValue = useMemo(() => {
    const allCategoryTitles = categories.map(cat => cat.title);
    const allCategoryViewIds = categories.map(cat => cat.viewId);

    const categoryToRoute = (categoryTitle) => {
      const cat = categories.find(c => c.title === categoryTitle);
      return cat?.route || '/';
    };

    const categoryToViewId = (categoryTitle) => {
      const cat = categories.find(c => c.title === categoryTitle);
      return cat?.viewId || null;
    };

    const getCategoryByViewId = (viewId) => {
      return categories.find(c => c.viewId === viewId) || null;
    };

    const getCategoryByTitle = (title) => {
      return categories.find(c => c.title === title) || null;
    };

    const getCategoryBySlug = (slug) => {
      return categories.find(c => c.id === slug) || null;
    };

    return {
      categories,
      loading,
      reload: loadCategories,
      allCategoryTitles,
      allCategoryViewIds,
      categoryToRoute,
      categoryToViewId,
      getCategoryByViewId,
      getCategoryByTitle,
      getCategoryBySlug,
      ICON_NAMES,
    };
  }, [categories, loading, loadCategories]);

  return (
    <CategoriesContext.Provider value={providerValue}>
      {children}
    </CategoriesContext.Provider>
  );
};
