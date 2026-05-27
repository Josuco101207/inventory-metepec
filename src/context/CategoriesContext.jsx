import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const CategoriesContext = createContext();

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

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const fetchCategoriesFromSupabase = async (accessToken) => {
  const url = `${supabaseUrl}/rest/v1/categories?select=*&order=title`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    clearTimeout(timeout);
    console.error('[Categories] Fetch error:', err.message);
    return null;
  }
};

/**
 * Fetch the real Postgres columns for a table using the get_table_columns RPC.
 * Returns an array of { name, label, type } for non-system columns.
 */
const fetchTableSchema = async (tableName, accessToken) => {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/get_table_columns`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_table_name: tableName }),
    });
    if (!res.ok) return null;
    const columns = await res.json();
    if (!Array.isArray(columns)) return null;

    // Filter out system columns and transform to schema format
    return columns
      .filter(col => !SYSTEM_COLUMNS.includes(col.column_name))
      .map(col => ({
        name: col.column_name,
        label: col.column_name.charAt(0).toUpperCase() + col.column_name.slice(1).replace(/_/g, ' '),
        type: col.data_type,
      }));
  } catch (err) {
    console.error(`[Categories] Schema introspection failed for ${tableName}:`, err.message);
    return null;
  }
};

// Transform Supabase row to the format the app expects
const transformCategory = (row) => ({
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
  supabaseId: row.id,
});

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
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setCategories([]);
        setLoading(false);
        return;
      }

      const data = await fetchCategoriesFromSupabase(session.access_token);
      if (data && Array.isArray(data)) {
        const baseCats = data.map(transformCategory);

        // Introspect real table columns for each category (in parallel)
        const enriched = await Promise.all(
          baseCats.map(async (cat) => {
            if (!cat.tableName) return cat;
            const realSchema = await fetchTableSchema(cat.tableName, session.access_token);
            if (realSchema && realSchema.length > 0) {
              return { ...cat, schema: realSchema };
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
      setLoading(false);
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
