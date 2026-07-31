import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useCategories } from './CategoriesContext';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import {
  getMovements,
  getPersonnel, getBrands, getLocations,
  clearAllData
} from '../storage/localStorage';
import {
  fetchItems as sbFetchItems,
  fetchMovements as sbFetchMovements,
  fetchPersonnel as sbFetchPersonnel,
  insertPersonnel as sbInsertPersonnel,
  deletePersonnel as sbDeletePersonnel,
  fetchBrands as sbFetchBrands,
  insertBrand as sbInsertBrand,
  deleteBrand as sbDeleteBrand,
  fetchLocations as sbFetchLocations,
  insertLocation as sbInsertLocation,
  deleteLocation as sbDeleteLocation,
  fetchSubcategories as sbFetchSubcategories,
  insertSubcategory as sbInsertSubcategory,
  deleteSubcategory as sbDeleteSubcategory,
  updateItem as sbUpdateItem,
  fetchGlobalStats
} from '../storage/supabaseStorage';
import { enrichItemsWithFacturaUrl, mapToDbFields } from '../utils/itemParser';
import { useInventoryMovements } from '../hooks/useInventoryMovements';
import { useInventoryItems } from '../hooks/useInventoryItems';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const rpcCall = async (fnName, params = {}) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No session');
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `RPC ${fnName} failed: ${res.status}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
};

const InventoryContext = createContext();

export const InventoryProvider = ({ children }) => {
  const { user } = useAuth();
  const { categories, loading: catsLoading } = useCategories();
  const [items, setItemsState] = useState([]);
  const [personnel, setPersonnelState] = useState([]);
  const [brands, setBrandsState] = useState([]);
  const [locations, setLocationsState] = useState([]);
  const [subcategories, setSubcategoriesState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isAutoWiping, setIsAutoWiping] = useState(false);
  const [lastSync, setLastSync] = useState(new Date());
  const [connectionStatus, setConnectionStatus] = useState('supabase');
  const [globalStats, setGlobalStats] = useState({ 
    items: 0, 
    movements: 0, 
    critical: 0,
    criticalItems: [],
    activity: [] 
  });
  
  // Ref para llevar control de las categorías ya cargadas
  const loadedCategoriesRef = useRef(new Set());
  
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);

  const categoriesRef = useRef(categories);
  useEffect(() => { categoriesRef.current = categories; }, [categories]);

  const getTableName = useCallback((categoryTitle) => {
    const cat = categoriesRef.current.find(c => c.title === categoryTitle);
    return cat?.tableName || null;
  }, []);

  const getValidColumns = useCallback((categoryTitle) => {
    const cat = categoriesRef.current.find(c => c.title === categoryTitle);
    return cat?.schema?.map(col => col.name) || null;
  }, []);

  const getFieldMappings = useCallback((categoryTitle) => {
    const cat = categoriesRef.current.find(c => c.title === categoryTitle);
    return cat?.fieldMappings || {};
  }, []);

  // Use the new hooks
  const { movements, setMovementsState, addMovement, annulMovement } = useInventoryMovements({
    itemsRef,
    setItemsState,
    getTableName,
    sbUpdateItem
  });

  const {
    updateStock,
    loanItem,
    bulkLoanItems,
    returnItem,
    reportMaintenance,
    completeMaintenance,
    auditStock,
    addItem,
    deleteItem,
    editItem,
    bulkAddItems,
    deleteItemsByCategory,
    clearDatabaseCategories,
    deleteItemsWithInvalidCategories
  } = useInventoryItems({
    itemsRef,
    setItemsState,
    addMovement,
    getTableName,
    getValidColumns,
    getFieldMappings,
    mapToDbFields
  });

  // ─── Limpieza al logout ───
  useEffect(() => {
    if (!user) {
      setItemsState([]);
      loadedCategoriesRef.current.clear();
      setMovementsState([]);
      setPersonnelState([]);
      setBrandsState([]);
      setLocationsState([]);
      setSubcategoriesState([]);
      setGlobalStats({ items: 0, movements: 0, critical: 0, criticalItems: [], activity: [] });
      setLoading(true);
    }
  }, [user, setMovementsState]);

  // ─── Cargar items de TODAS las tablas de categorías en Supabase ───
  const loadAllItems = useCallback(async (cachedMovements = null) => {
    if (!categories.length) return;
    try {
      const allItems = [];
      await Promise.all(categories.map(async (cat) => {
        if (!cat.tableName) return;
        const rows = await sbFetchItems(cat.tableName);
        if (rows.length === 0) return;

        // Perform smart column mapping ONCE per table
        const firstRow = rows[0];
        const keys = Object.keys(firstRow).map(k => k.toLowerCase());
        const actualKeysMap = {};
        Object.keys(firstRow).forEach(k => { actualKeysMap[k.toLowerCase()] = k; });

        const smartFindColumn = (goodWords, badWords = []) => {
          let bestMatch = null;
          let maxScore = 0;

          for (const col of keys) {
            if (col === 'id' || col === 'created_at' || col === 'updated_at') continue;
            let score = 0;

            if (goodWords.includes(col)) {
              score += 100;
            } else {
              for (const w of goodWords) {
                if (col.includes(w)) score += 30;
              }
            }

            for (const w of badWords) {
              if (col.includes(w)) score -= 100;
            }

            if (score > maxScore) {
              maxScore = score;
              bestMatch = col;
            }
          }
          return bestMatch ? actualKeysMap[bestMatch] : null;
        };

        const map = cat.fieldMappings || {};
        const nameKey = smartFindColumn(['nombre', 'titulo', 'title', 'producto', 'articulo', 'name', 'nom'], ['desc', 'obs', 'detal']);
        const threshKey = smartFindColumn(['stock_min', 'minimo', 'min', 'threshold', 'limite', 'alerta', 'bajo'], ['nom', 'name']);
        const obsKey = smartFindColumn(['detalles', 'notas', 'descripcion', 'observaciones', 'obs', 'coment'], ['nom', 'name', 'tit']);
        const qtyKey = smartFindColumn(['cantidad', 'canticad', 'stock', 'existencias', 'piezas', 'qty', 'cant', 'can', 'unidades', 'uds', 'pz', 'num', 'total'], ['min', 'limit', 'alert', 'thresh', 'bajo', 'max']);

        rows.forEach(row => {
          const normalizedRow = { ...row };
          
          if (map.name && row[map.name] !== undefined && normalizedRow.name === undefined) {
             normalizedRow.name = row[map.name];
          }
          if (map.qty && row[map.qty] !== undefined && normalizedRow.qty === undefined) {
             normalizedRow.qty = row[map.qty];
          }
          if (map.observaciones && row[map.observaciones] !== undefined && normalizedRow.observaciones === undefined) {
             normalizedRow.observaciones = row[map.observaciones];
          }
          if (map.threshold && row[map.threshold] !== undefined && normalizedRow.threshold === undefined) {
             normalizedRow.threshold = row[map.threshold];
          }

          if (nameKey && normalizedRow.name === undefined) normalizedRow.name = row[nameKey];
          if (qtyKey && normalizedRow.qty === undefined) normalizedRow.qty = row[qtyKey];
          if (obsKey && normalizedRow.observaciones === undefined) normalizedRow.observaciones = row[obsKey];
          if (threshKey && normalizedRow.threshold === undefined) normalizedRow.threshold = row[threshKey];
          
          allItems.push({ ...normalizedRow, category: cat.title, _tableName: cat.tableName });
        });
      }));

      const movementsToUse = cachedMovements ?? (await sbFetchMovements(1, 2000)).data;
      enrichItemsWithFacturaUrl(allItems, movementsToUse);

      setItemsState(allItems);
      categories.forEach(c => loadedCategoriesRef.current.add(c.title));
    } catch (err) {
      console.error('[Inventory] Load items error:', err);
    }
  }, [categories]);

  // Cargar artículos de una categoría específica (bajo demanda)
  const loadCategoryItems = useCallback(async (categoryTitle) => {
    if (loadedCategoriesRef.current.has(categoryTitle)) return; // ya cargada
    const cat = categories.find(c => c.title === categoryTitle);
    if (!cat || !cat.tableName) return;
    
    try {
      const rows = await sbFetchItems(cat.tableName);
      if (rows.length === 0) {
        loadedCategoriesRef.current.add(categoryTitle);
        return;
      }
      
      const firstRow = rows[0];
      const keys = Object.keys(firstRow).map(k => k.toLowerCase());
      const actualKeysMap = {};
      Object.keys(firstRow).forEach(k => { actualKeysMap[k.toLowerCase()] = k; });

      const smartFindColumn = (goodWords, badWords = []) => {
        let bestMatch = null;
        let maxScore = 0;
        for (const col of keys) {
          if (col === 'id' || col === 'created_at' || col === 'updated_at') continue;
          let score = 0;
          if (goodWords.includes(col)) score += 100;
          else {
            for (const w of goodWords) if (col.includes(w)) score += 30;
          }
          for (const w of badWords) if (col.includes(w)) score -= 100;
          if (score > maxScore) { maxScore = score; bestMatch = col; }
        }
        return bestMatch ? actualKeysMap[bestMatch] : null;
      };

      const map = cat.fieldMappings || {};
      const nameKey = smartFindColumn(['nombre', 'titulo', 'title', 'producto', 'articulo', 'name', 'nom'], ['desc', 'obs', 'detal']);
      const threshKey = smartFindColumn(['stock_min', 'minimo', 'min', 'threshold', 'limite', 'alerta', 'bajo'], ['nom', 'name']);
      const obsKey = smartFindColumn(['detalles', 'notas', 'descripcion', 'observaciones', 'obs', 'coment'], ['nom', 'name', 'tit']);
      const qtyKey = smartFindColumn(['cantidad', 'canticad', 'stock', 'existencias', 'piezas', 'qty', 'cant', 'can', 'unidades', 'uds', 'pz', 'num', 'total'], ['min', 'limit', 'alert', 'thresh', 'bajo', 'max']);

      const newItems = rows.map(row => {
        const normalizedRow = { ...row };
        if (map.name && row[map.name] !== undefined && normalizedRow.name === undefined) normalizedRow.name = row[map.name];
        if (map.qty && row[map.qty] !== undefined && normalizedRow.qty === undefined) normalizedRow.qty = row[map.qty];
        if (map.observaciones && row[map.observaciones] !== undefined && normalizedRow.observaciones === undefined) normalizedRow.observaciones = row[map.observaciones];
        if (map.threshold && row[map.threshold] !== undefined && normalizedRow.threshold === undefined) normalizedRow.threshold = row[map.threshold];

        if (nameKey && normalizedRow.name === undefined) normalizedRow.name = row[nameKey];
        if (qtyKey && normalizedRow.qty === undefined) normalizedRow.qty = row[qtyKey];
        if (obsKey && normalizedRow.observaciones === undefined) normalizedRow.observaciones = row[obsKey];
        if (threshKey && normalizedRow.threshold === undefined) normalizedRow.threshold = row[threshKey];
        
        return { ...normalizedRow, category: cat.title, _tableName: cat.tableName };
      });

      // Se usa la función auxiliar existente
      enrichItemsWithFacturaUrl(newItems, movements);

      setItemsState(prev => [...prev, ...newItems]);
      loadedCategoriesRef.current.add(categoryTitle);
    } catch (err) {
      console.error(`[Inventory] Error loading category ${categoryTitle}:`, err);
    }
  }, [categories, movements, setItemsState]);

  // ─── Cargar datos ───
  useEffect(() => {
    if (!user || catsLoading) return;

    let initialDone = false;
    const timeoutId = setTimeout(() => {
      if (!initialDone) {
        console.warn('Inventory loading timeout — forcing load from local storage');
        initialDone = true;
        setLoadError('Conexión inestable (timeout). Cargando caché.');
        setMovementsState(getMovements());
        setPersonnelState(getPersonnel());
        setBrandsState(getBrands());
        setLocationsState(getLocations());
        setLoading(false);
      }
    }, 12000);

    const init = async () => {
      setLoadError(null);
      try {
        const [sbMovements, sbPersonnel, sbBrands, sbLocations, sbSubcategories, stats] = await Promise.all([
          sbFetchMovements(1, 2000).then(res => res.data),
          sbFetchPersonnel(),
          sbFetchBrands(),
          sbFetchLocations(),
          sbFetchSubcategories(),
          fetchGlobalStats(categories)
        ]);

        if (stats) {
           setGlobalStats(prev => ({ ...prev, ...stats }));
        }

        // Ya NO cargamos todos los ítems por defecto para no bloquear.
        // Se cargarán bajo demanda con loadCategoryItems().
        // loadAllItems() queda disponible para herramientas de exportación masiva.

        if (!initialDone) {
          setMovementsState(sbMovements.length > 0 ? sbMovements : getMovements());
          setPersonnelState(sbPersonnel.length > 0 ? sbPersonnel : getPersonnel());
          setBrandsState(sbBrands.length > 0 ? sbBrands : getBrands());
          setLocationsState(sbLocations.length > 0 ? sbLocations : getLocations());
          setSubcategoriesState(sbSubcategories || []);
          setLastSync(new Date());
          setConnectionStatus('online');
        }
      } catch (err) {
        if (!initialDone) {
          console.error('[Inventory] Init error:', err);
          setLoadError(err.message);
          setMovementsState(getMovements());
          setPersonnelState(getPersonnel());
          setBrandsState(getBrands());
          setLocationsState(getLocations());
        }
      } finally {
        if (!initialDone) {
          initialDone = true;
          clearTimeout(timeoutId);
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      initialDone = true;
      clearTimeout(timeoutId);
    };
  }, [user, catsLoading, loadAllItems, setMovementsState, categories]);

  // ─── Actualizar estadísticas dinámicamente desde state combinado con globalStats ───
  useEffect(() => {
    if (!user) return;
    const last7Days = [6,5,4,3,2,1,0].map(i => {
      const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-i); return d;
    });
    const activity = last7Days.map(day => ({
      name: day.toLocaleDateString('es-ES', { weekday: 'short' }),
      movimientos: movements.filter(m => new Date(m.timestamp).toDateString() === day.toDateString()).length
    }));
    
    // Solo actualizamos "activity" basado en "movements" local, los totales 
    // vienen de globalStats (consultado al servidor).
    setGlobalStats(prev => ({
      ...prev,
      activity
    }));
  }, [user, movements]);

  // ─── Supabase Realtime subscriptions ───
  useEffect(() => {
    if (!user || catsLoading || !categories.length) return;

    const onChannelReady = () => {
      setConnectionStatus('online');
      setLastSync(new Date());
    };

    const onChannelError = (err) => {
      if (err) console.warn('[Inventory] Realtime channel error', err);
      setConnectionStatus('reconnecting');
    };

    const globalChannel = supabase
      .channel('inventory-global')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        setLastSync(new Date());
        const tableName = payload.table;

        if (tableName === 'movements') {
          if (payload.eventType === 'INSERT') {
            setMovementsState(prev => {
              if (prev.find(m => m.id === payload.new.id)) return prev;
              return [payload.new, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            setMovementsState(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
          } else if (payload.eventType === 'DELETE') {
            setMovementsState(prev => prev.filter(m => m.id !== payload.old.id));
          }
        } else {
          // Verificar si la tabla corresponde a una categoría
          const cat = categories.find(c => c.tableName === tableName);
          if (cat) {
            if (payload.eventType === 'INSERT') {
              setItemsState(prev => {
                if (prev.find(i => i.id === payload.new.id)) return prev;
                const newItem = { ...payload.new, category: cat.title, _tableName: cat.tableName };
                if (newItem.stock_min !== undefined && newItem.threshold === undefined) newItem.threshold = newItem.stock_min;
                if (newItem.minimo !== undefined && newItem.threshold === undefined) newItem.threshold = newItem.minimo;
                return [...prev, newItem];
              });
            } else if (payload.eventType === 'UPDATE') {
              setItemsState(prev => prev.map(i => {
                if (i.id === payload.new.id) {
                  const updatedItem = { ...i, ...payload.new, category: cat.title, _tableName: cat.tableName };
                  if (updatedItem.stock_min !== undefined) updatedItem.threshold = updatedItem.stock_min;
                  if (updatedItem.minimo !== undefined) updatedItem.threshold = updatedItem.minimo;
                  return updatedItem;
                }
                return i;
              }));
            } else if (payload.eventType === 'DELETE') {
              setItemsState(prev => prev.filter(i => i.id !== payload.old.id));
            }
          }
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') onChannelReady();
        else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') onChannelError();
        else if (status === 'TIMED_OUT') setConnectionStatus('reconnecting');
      });

    return () => {
      supabase.removeChannel(globalChannel);
    };
  }, [user, categories, catsLoading, setMovementsState]);

  const syncInventory = useCallback(async () => {
    try {
      await loadAllItems();
      setLastSync(new Date());
      return true;
    } catch (err) {
      console.error('Sync error:', err);
      return false;
    }
  }, [loadAllItems]);

  const bulkAddPersonnel = useCallback(async (personnelArray) => {
    try {
      const results = await Promise.allSettled(personnelArray.map(person => sbInsertPersonnel({
        ...person,
        created_at: new Date().toISOString()
      })));
      const valid = results.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);
      setPersonnelState(prev => [...prev, ...valid]);
      toast.success(`Personal importado: ${valid.length} trabajadores añadidos`);
    } catch (err) {
      console.error('Error importando personal:', err);
      toast.error('Error importando personal');
    }
  }, []);

  const addWorker = useCallback(async (workerData) => {
    try {
      const created = await sbInsertPersonnel({
        ...workerData,
        created_at: new Date().toISOString()
      });
      if (created) {
        setPersonnelState(prev => [...prev, created]);
        toast.success(`Trabajador añadido: ${workerData.name}`);
      }
    } catch (err) {
      console.error('Error adding worker:', err);
      toast.error('Error al añadir trabajador');
    }
  }, []);

  const deleteWorker = useCallback(async (workerId) => {
    try {
      await sbDeletePersonnel(workerId);
      setPersonnelState(prev => prev.filter(p => p.id !== workerId));
      toast.info("Trabajador eliminado de la lista");
    } catch (err) {
      console.error('Error deleting worker:', err);
      toast.error('Error al eliminar trabajador');
    }
  }, []);

  const addBrand = useCallback(async (name) => {
    const existing = brands.find(b => b.name === name);
    if (existing) { toast.error("Esta marca ya existe"); return; }
    const created = await sbInsertBrand(name);
    if (created) {
      setBrandsState(prev => [...prev, created]);
      toast.success(`Marca añadida: ${name}`);
    }
  }, [brands]);

  const deleteBrand = useCallback(async (id) => {
    await sbDeleteBrand(id);
    setBrandsState(prev => prev.filter(b => b.id !== id));
    toast.info("Marca eliminada");
  }, []);

  const addLocation = useCallback(async (name, zone = '') => {
    try {
      const added = await sbInsertLocation(name, zone);
      if (added) {
        setLocationsState(prev => [...prev, added]);
        toast.success(`Ubicación agregada`);
      }
    } catch {
      toast.error('Error al agregar ubicación');
    }
  }, []);

  const deleteLocation = useCallback(async (id) => {
    try {
      const ok = await sbDeleteLocation(id);
      if (ok) {
        setLocationsState(prev => prev.filter(l => l.id !== id));
        toast.success(`Ubicación eliminada`);
      }
    } catch {
      toast.error('Error al eliminar ubicación');
    }
  }, []);

  const addSubcategory = useCallback(async (name) => {
    try {
      const added = await sbInsertSubcategory(name);
      if (added) {
        setSubcategoriesState(prev => [...prev, added]);
        toast.success(`Subcategoría agregada`);
      }
    } catch {
      toast.error('Error al agregar subcategoría');
    }
  }, []);

  const deleteSubcategory = useCallback(async (id) => {
    try {
      const ok = await sbDeleteSubcategory(id);
      if (ok) {
        setSubcategoriesState(prev => prev.filter(s => s.id !== id));
        toast.success(`Subcategoría eliminada`);
      }
    } catch {
      toast.error('Error al eliminar subcategoría');
    }
  }, []);

  const wipeAllData = useCallback(async () => {
    if (isAutoWiping) return;
    try {
      setIsAutoWiping(true);
      toast.loading("ELIMINANDO INVENTARIO Y MOVIMIENTOS...", { id: 'wipe' });
      
      // 1. Generar SQL de limpieza
      let sql = `TRUNCATE TABLE approval_requests;\nTRUNCATE TABLE movements;\n`;
      categories.forEach(cat => {
         if (cat.tableName) {
            sql += `TRUNCATE TABLE ${cat.tableName};\n`;
         }
      });
      
      // 2. Eliminar personnel y profiles excepto el admin actual
      if (user && user.email) {
         sql += `DELETE FROM personnel WHERE email != '${user.email}';\n`;
         sql += `DELETE FROM profiles WHERE email != '${user.email}';\n`;
      }

      // Ejecutar en Supabase
      await rpcCall('exec_sql', { query: sql });
      
      // Limpiar estados locales
      setItemsState([]);
      setMovementsState([]);
      setPersonnelState(prev => prev.filter(p => p.email === user?.email));
      setGlobalStats(prev => ({ ...prev, items: 0, movements: 0, critical: 0 }));
      
      toast.success("BASE DE DATOS VACIADA (Se conservaron configuraciones)", { id: 'wipe' });
      return true;
    } catch (e) {
      console.error("Wipe error:", e);
      toast.error(`Error crítico: ${e.message}`, { id: 'wipe' });
      return false;
    } finally {
      setIsAutoWiping(false);
    }
  }, [isAutoWiping, categories, user]);

  const contextValue = useMemo(() => ({
    items,
    movements,
    personnel,
    brands,
    locations,
    subcategories,
    loading,
    loadError,
    globalStats,
    updateStock,
    addItem,
    deleteItem,
    editItem,
    loanItem,
    bulkLoanItems,
    returnItem,
    bulkAddItems,
    bulkAddPersonnel,
    addWorker,
    deleteWorker,
    reportMaintenance,
    completeMaintenance,
    auditStock,
    addBrand,
    deleteBrand,
    addLocation,
    deleteLocation,
    addSubcategory,
    deleteSubcategory,
    wipeAllData,
    deleteItemsByCategory,
    clearDatabaseCategories: (cats) => clearDatabaseCategories(cats, setMovementsState),
    deleteItemsWithInvalidCategories,
    isAutoWiping,
    lastSync,
    connectionStatus,
    annulMovement,
    syncInventory,
    fetchMoreItems: () => {},
    hasMore: false,
  }), [
    items,
    movements,
    personnel,
    brands,
    locations,
    subcategories,
    loading,
    loadError,
    globalStats,
    updateStock,
    addItem,
    deleteItem,
    editItem,
    loanItem,
    bulkLoanItems,
    returnItem,
    bulkAddItems,
    bulkAddPersonnel,
    addWorker,
    deleteWorker,
    reportMaintenance,
    completeMaintenance,
    auditStock,
    addBrand,
    deleteBrand,
    addLocation,
    deleteLocation,
    addSubcategory,
    deleteSubcategory,
    wipeAllData,
    deleteItemsWithInvalidCategories,
    isAutoWiping,
    lastSync,
    connectionStatus,
    annulMovement,
    syncInventory,
    loadCategoryItems,
    loadAllItems,
    clearDatabaseCategories,
    deleteItemsByCategory,
    setMovementsState
  ]);

  return (
    <InventoryContext.Provider value={contextValue}>
      {children}
    </InventoryContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useInventory = () => useContext(InventoryContext);
