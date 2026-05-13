import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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

const fetchCategoriesFromSupabase = async (accessToken) => {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/categories?select=*&order=title`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
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
        setCategories(data.map(transformCategory));
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

  // Helper functions (same API as before)
  const allCategoryTitles = categories.map(c => c.title);
  const allCategoryViewIds = categories.map(c => c.viewId);

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

  return (
    <CategoriesContext.Provider value={{
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
    }}>
      {children}
    </CategoriesContext.Provider>
  );
};
