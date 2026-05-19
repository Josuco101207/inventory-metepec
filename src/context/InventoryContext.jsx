import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useCategories } from './CategoriesContext';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import {
  getMovements, addMovement as addLocalStorageMovement, updateMovement as updateLocalStorageMovement,
  getPersonnel, getBrands, getLocations,
  clearAllData
} from '../storage/localStorage';
import {
  fetchItems as sbFetchItems,
  insertItem as sbInsertItem,
  updateItem as sbUpdateItem,
  deleteItem as sbDeleteItem,
  fetchMovements as sbFetchMovements,
  insertMovement as sbInsertMovement,
  updateMovement as sbUpdateMovement,
  fetchPersonnel as sbFetchPersonnel,
  insertPersonnel as sbInsertPersonnel,
  deletePersonnel as sbDeletePersonnel,
  fetchBrands as sbFetchBrands,
  insertBrand as sbInsertBrand,
  deleteBrand as sbDeleteBrand,
  fetchLocations as sbFetchLocations,
  insertLocation as sbInsertLocation,
  deleteLocation as sbDeleteLocation,
} from '../storage/supabaseStorage';

const InventoryContext = createContext();

/**
 * Contexto principal para manejar los datos del inventario.
 * Items se cargan desde Supabase (una tabla por categoría).
 * Movements, brands, locations y personnel siguen en localStorage.
 */
export const InventoryProvider = ({ children }) => {
  const { user } = useAuth();
  const { categories, loading: catsLoading } = useCategories();
  const [items, setItemsState] = useState([]);
  const [movements, setMovementsState] = useState([]);
  const [personnel, setPersonnelState] = useState([]);
  const [brands, setBrandsState] = useState([]);
  const [locations, setLocationsState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isAutoWiping, setIsAutoWiping] = useState(false);
  const [lastSync, setLastSync] = useState(new Date());
  const [connectionStatus, setConnectionStatus] = useState('supabase');
  const [globalStats, setGlobalStats] = useState({ 
    items: 0, 
    movements: 0, 
    critical: 0,
    activity: [] 
  });
  
  // Ref para acceso estable a items en callbacks (evita stale closures)
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);

  // Ref for categories (stable access in callbacks)
  const categoriesRef = useRef(categories);
  useEffect(() => { categoriesRef.current = categories; }, [categories]);

  // Helper: find table name for a category title
  const getTableName = useCallback((categoryTitle) => {
    const cat = categoriesRef.current.find(c => c.title === categoryTitle);
    return cat?.tableName || null;
  }, []);

  // Helper: get valid columns for a category
  const getValidColumns = useCallback((categoryTitle) => {
    const cat = categoriesRef.current.find(c => c.title === categoryTitle);
    return cat?.schema?.map(col => col.name) || null;
  }, []);

  // Helper: Smart map generic fields to table-specific valid columns
  const mapToDbFields = useCallback((rawFields, validColumns) => {
    const dbFields = {};
    if (!validColumns || !Array.isArray(validColumns)) {
      Object.assign(dbFields, rawFields);
      return dbFields;
    }

    const safeColumns = validColumns.filter(c => typeof c === 'string');

    const mappedNameKey = safeColumns.includes('name') ? 'name' : safeColumns.find(c => ['nombre', 'titulo', 'title', 'producto', 'articulo'].includes(c.toLowerCase()));
    const mappedQtyKey = safeColumns.includes('qty') ? 'qty' : safeColumns.find(c => ['cantidad', 'stock', 'existencias'].includes(c.toLowerCase()));
    const mappedObsKey = safeColumns.includes('observaciones') ? 'observaciones' : safeColumns.find(c => ['detalles', 'notas', 'descripcion'].includes(c.toLowerCase()) && c !== mappedNameKey);

    for (const key of Object.keys(rawFields)) {
      if (safeColumns.includes(key)) {
        dbFields[key] = rawFields[key];
      } else {
        if (key === 'name' && mappedNameKey) dbFields[mappedNameKey] = rawFields[key];
        if (key === 'qty' && mappedQtyKey) dbFields[mappedQtyKey] = rawFields[key];
        if (key === 'observaciones' && mappedObsKey) dbFields[mappedObsKey] = rawFields[key];
      }
    }
    return dbFields;
  }, []);

  // ─── Limpieza al logout ───
  useEffect(() => {
    if (!user) {
      setItemsState([]);
      setMovementsState([]);
      setPersonnelState([]);
      setBrandsState([]);
      setLocationsState([]);
      setGlobalStats({ items: 0, movements: 0, critical: 0, activity: [] });
      setLoading(true);
    }
  }, [user]);

  // ─── Cargar items de TODAS las tablas de categorías en Supabase ───
  const loadAllItems = useCallback(async () => {
    if (!categories.length) return;
    try {
      const allItems = [];
      await Promise.all(categories.map(async (cat) => {
        if (!cat.tableName) return;
        const rows = await sbFetchItems(cat.tableName);
        // Tag each row with category info so the rest of the app works
        rows.forEach(row => {
          const normalizedRow = { ...row };
          // Normalizar nombre si viene en español
          if (row.nombre && !row.name) normalizedRow.name = row.nombre;
          // Normalizar cantidad si viene en español
          if (row.cantidad !== undefined && row.qty === undefined) normalizedRow.qty = row.cantidad;
          // Normalizar observaciones si viene como detalles
          if (row.detalles && !row.observaciones) normalizedRow.observaciones = row.detalles;
          
          allItems.push({ ...normalizedRow, category: cat.title, _tableName: cat.tableName });
        });
      }));

      // Enriquecer items con factura_url extraída de los movements de "Alta"
      const movements = await sbFetchMovements(500);
      const urlMap = {};
      movements.forEach(m => {
        if (m.details && m.details.includes('factura_url:')) {
          const match = m.details.match(/factura_url:(https?:\/\/\S+)/);
          if (match) {
            const itemName = m.item;
            if (itemName && !urlMap[itemName]) urlMap[itemName] = match[1];
          }
        }
      });
      allItems.forEach(item => {
        if (!item.factura_url && item.name && urlMap[item.name]) {
          item.factura_url = urlMap[item.name];
        }
      });

      setItemsState(allItems);
    } catch (err) {
      console.error('[Inventory] Load items error:', err);
    }
  }, [categories]);

  // ─── Cargar datos ───
  useEffect(() => {
    if (!user || catsLoading) {
      if (!user) {
        setItemsState([]);
        setMovementsState([]);
        setPersonnelState([]);
        setBrandsState([]);
        setLocationsState([]);
        setGlobalStats({ items: 0, movements: 0, critical: 0, activity: [] });
        setLoading(true);
      }
      return;
    }

    const init = async () => {
      setLoadError(null);
      try {
        // Load all data from Supabase in parallel
        const [, sbMovements, sbPersonnel, sbBrands, sbLocations] = await Promise.all([
          loadAllItems(),
          sbFetchMovements(500),
          sbFetchPersonnel(),
          sbFetchBrands(),
          sbFetchLocations(),
        ]);

        setMovementsState(sbMovements.length > 0 ? sbMovements : getMovements());
        setPersonnelState(sbPersonnel.length > 0 ? sbPersonnel : getPersonnel());
        setBrandsState(sbBrands.length > 0 ? sbBrands : getBrands());
        setLocationsState(sbLocations.length > 0 ? sbLocations : getLocations());

        setLastSync(new Date());
      } catch (err) {
        console.error('[Inventory] Init error:', err);
        setLoadError(err.message);
        setMovementsState(getMovements());
        setPersonnelState(getPersonnel());
        setBrandsState(getBrands());
        setLocationsState(getLocations());
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [user, catsLoading, loadAllItems]);

  // ─── Actualizar estadísticas desde state (no localStorage) ───
  useEffect(() => {
    if (!user) return;
    const last7Days = [6,5,4,3,2,1,0].map(i => {
      const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-i); return d;
    });
    const activity = last7Days.map(day => ({
      name: day.toLocaleDateString('es-ES', { weekday: 'short' }),
      movimientos: movements.filter(m => new Date(m.timestamp).toDateString() === day.toDateString()).length
    }));
    setGlobalStats({
      items: items.length,
      movements: movements.length,
      critical: items.filter(i => (i.qty || 0) <= (i.threshold || 0) && (i.threshold || 0) > 0).length,
      activity,
    });
  }, [user, items, movements]);

  // ─── Helpers ───
  const addMovement = useCallback(async (action, itemName, qty, userName = 'Jonathan', details = '', category = 'General', originalValues = null) => {
    try {
      const relatedItem = itemsRef.current.find(i => i.name === itemName);
      const subcategory = relatedItem?.subcategory || '';

      const movementData = {
        action,
        item: itemName,
        user: userName,
        details,
        category,
        subcategory,
        qty: Math.abs(qty),
        timestamp: new Date().toISOString(),
        time: new Date().toLocaleString(),
      };

      // Save original values for annulment (if provided)
      if (originalValues) {
        movementData.originalValues = originalValues;
      }

      // Save to Supabase (fire-and-forget, fallback to localStorage on error)
      const saved = await sbInsertMovement(movementData);
      const finalMovement = saved || { ...movementData, id: Date.now().toString() + Math.random().toString(36).substr(2, 9) };

      // Keep localStorage in sync as local cache
      addLocalStorageMovement(movementData);

      setMovementsState(prev => [finalMovement, ...prev]);
    } catch (e) {
      console.error("Error adding movement:", e);
    }
  }, []);

  // ─── Stock Update ───
  const updateStock = useCallback(async (itemId, change, userName = 'Jonathan', customDetails = '') => {
    const currentItems = itemsRef.current;
    const itemIndex = currentItems.findIndex(i => i.id === itemId);
    if (itemIndex === -1) return;

    const item = currentItems[itemIndex];

    // Bloqueo: No permitir stock negativo
    if ((item.qty || 0) + change < 0) {
      toast.error("Error: Stock insuficiente", {
        description: `Solo quedan ${item.qty} unidades de ${item.name}.`
      });
      return;
    }

    const newQty = (item.qty || 0) + change;
    const tableName = item._tableName || getTableName(item.category);
    const validColumns = getValidColumns(item.category);
    
    try {
      if (tableName) {
        const updates = mapToDbFields({ qty: newQty }, validColumns);
        await sbUpdateItem(tableName, itemId, updates);
      }
      // Extraer factura_url del customDetails si viene incluida
      const urlMatch = customDetails?.match(/factura_url:(https?:\/\/\S+)/);
      const facturaUrl = urlMatch ? urlMatch[1] : null;
      setItemsState(prev => {
        const updated = [...prev];
        updated[itemIndex] = {
          ...updated[itemIndex],
          qty: newQty,
          ...(facturaUrl && !updated[itemIndex].factura_url ? { factura_url: facturaUrl } : {}),
        };
        return updated;
      });
      
      const defaultDetails = `${change > 0 ? 'Reposición' : 'Gasto'} de material`;
      await addMovement(
        change > 0 ? 'Entrada' : 'Salida', 
        item.name, 
        Math.abs(change), 
        userName, 
        customDetails || defaultDetails,
        item.category
      );
      toast.success(`${change > 0 ? 'Entrada' : 'Salida'} registrada: ${item.name}`);
    } catch (err) {
      console.error('[updateStock] ERROR:', err);
      toast.error(`Error: ${err.message}`, { duration: 6000 });
    }
  }, [addMovement, getTableName]);

  const loanItem = useCallback(async (itemId, borrower, userName = 'Jonathan') => {
    const item = itemsRef.current.find(i => i.id === itemId);
    if (!item || (item.qty || 0) <= 0) {
      toast.error("No hay stock disponible para préstamo");
      return;
    }

    const tableName = item._tableName || getTableName(item.category);
    const qtyNum = parseInt(item.qty) || 0;
    const prestadosNum = parseInt(item.prestados) || (item.status === 'Prestado' ? 1 : 0);
    const remainingQty = Math.max(qtyNum - 1, 0);
    const totalLent = prestadosNum + 1;
    const updates = {
      qty: remainingQty,
      prestados: totalLent,
      status: remainingQty <= 0 ? 'Prestado' : 'Disponible',
      borrowedBy: borrower || null,
      lentBy: userName || null,
      loanDate: new Date().toISOString()
    };

    try {
      if (tableName) await sbUpdateItem(tableName, itemId, updates);
      setItemsState(prev => prev.map(i => i.id === itemId ? { ...i, ...updates } : i));
      addMovement('Préstamo', item.name, 1, userName, borrower, item.category);
      toast.success(`Artículo prestado a ${borrower} (Disponibles: ${remainingQty})`);
    } catch (err) {
      toast.error(`Error al registrar préstamo: ${err.message}`);
    }
  }, [addMovement, getTableName]);

  const bulkLoanItems = useCallback(async (itemIds, borrower, userName = 'Jonathan') => {
    const availableItems = itemsRef.current.filter(i => itemIds.includes(i.id) && (i.qty || 0) > 0);
    if (availableItems.length === 0) {
      toast.error("Ninguno de los artículos seleccionados tiene stock");
      return;
    }

    try {
      const updatesList = availableItems.map(item => {
        const remainingQty = Math.max((parseInt(item.qty) || 0) - 1, 0);
        const totalLent = (parseInt(item.prestados) || 0) + 1;
        return {
          item,
          updates: {
            qty: remainingQty,
            prestados: totalLent,
            status: remainingQty <= 0 ? 'Prestado' : 'Disponible',
            borrowedBy: borrower || null,
            lentBy: userName || null,
            loanDate: new Date().toISOString()
          }
        };
      });

      await Promise.all(updatesList.map(({ item, updates }) => {
        const tableName = item._tableName || getTableName(item.category);
        return tableName ? sbUpdateItem(tableName, item.id, updates) : Promise.resolve();
      }));

      setItemsState(prev => prev.map(i => {
        const found = updatesList.find(u => u.item.id === i.id);
        return found ? { ...i, ...found.updates } : i;
      }));

      for (const { item } of updatesList) {
        addMovement('Préstamo', item.name, 1, userName, borrower, item.category);
      }
      toast.success(`${availableItems.length} artículos prestados a ${borrower}`);
    } catch (err) {
      toast.error(`Error en préstamo masivo: ${err.message}`);
    }
  }, [addMovement, getTableName]);

  const returnItem = useCallback(async (itemId, userName = 'Jonathan') => {
    const item = itemsRef.current.find(i => i.id === itemId);
    if (!item) return;

    const tableName = item._tableName || getTableName(item.category);
    const newQty = (parseInt(item.qty) || 0) + 1;
    const newLent = Math.max((parseInt(item.prestados) || 0) - 1, 0);
    const updates = {
      qty: newQty,
      prestados: newLent,
      status: 'Disponible',
      borrowedBy: newLent === 0 ? null : (item.borrowedBy || null),
      lentBy: newLent === 0 ? null : (item.lentBy || null),
      loanDate: newLent === 0 ? null : (item.loanDate || null)
    };

    try {
      if (tableName) await sbUpdateItem(tableName, itemId, updates);
      setItemsState(prev => prev.map(i => i.id === itemId ? { ...i, ...updates } : i));
      addMovement('Devolución', item.name, 1, userName, 'Devuelto a almacén', item.category);
      toast.success(`Herramienta devuelta (En almacén: ${newQty})`);
    } catch (err) {
      toast.error(`Error al registrar devolución: ${err.message}`);
    }
  }, [addMovement, getTableName]);

  const reportMaintenance = useCallback(async (itemId, reason, userName = 'Jonathan') => {
    const item = itemsRef.current.find(i => i.id === itemId);
    if (!item) return;

    const tableName = item._tableName || getTableName(item.category);
    const remainingQty = Math.max((item.qty || 0) - 1, 0);
    const updates = {
      qty: remainingQty,
      observaciones: `Falla: ${reason} (Reportó: ${userName})`,
      status: 'Mantenimiento'
    };

    try {
      if (tableName) await sbUpdateItem(tableName, itemId, updates);
      setItemsState(prev => prev.map(i => i.id === itemId ? { ...i, ...updates } : i));
      addMovement('Falla/Manto', item.name, 1, userName, reason, item.category);
      toast.warning(`Reporte registrado: 1x ${item.name} retirado por falla`);
    } catch (err) {
      toast.error(`Error al reportar falla: ${err.message}`);
    }
  }, [addMovement, getTableName]);

  const completeMaintenance = useCallback(async (itemId, userName = 'Jonathan') => {
    const item = itemsRef.current.find(i => i.id === itemId);
    if (!item) return;

    const tableName = item._tableName || getTableName(item.category);
    const newQty = (item.qty || 0) + 1;
    const updates = {
      qty: newQty,
      status: 'Disponible',
      observaciones: `Reparado el ${new Date().toLocaleDateString()} por ${userName}`
    };

    try {
      if (tableName) await sbUpdateItem(tableName, itemId, updates);
      setItemsState(prev => prev.map(i => i.id === itemId ? { ...i, ...updates } : i));
      addMovement('Entrada', item.name, 1, userName, 'Reparado / Fin de mantenimiento', item.category);
      toast.success(`Herramienta reparada: ${item.name} vuelve a estar disponible`);
    } catch (err) {
      toast.error(`Error al completar mantenimiento: ${err.message}`);
    }
  }, [addMovement, getTableName]);

  const auditStock = useCallback(async (itemId, physicalQty, userName = 'Jonathan', reason = '') => {
    const item = itemsRef.current.find(i => i.id === itemId);
    if (!item) return;

    const tableName = item._tableName || getTableName(item.category);
    const diff = physicalQty - (item.qty || 0);

    try {
      if (tableName) await sbUpdateItem(tableName, itemId, { qty: physicalQty });
      setItemsState(prev => prev.map(i => i.id === itemId ? { ...i, qty: physicalQty } : i));
      const finalReason = reason ? `Audit: ${reason} (Ajuste: ${diff > 0 ? '+' : ''}${diff})` : `Conteo físico: ${physicalQty} (Ajuste: ${diff > 0 ? '+' : ''}${diff})`;
      addMovement('Auditoría', item.name, Math.abs(diff), userName, finalReason, item.category);
      toast.success("Auditoría registrada exitosamente");
    } catch (err) {
      toast.error(`Error en auditoría: ${err.message}`);
    }
  }, [addMovement, getTableName]);

  const addItem = useCallback(async (newItem, userName = 'Jonathan', facturaUrl = null) => {
    const tableName = getTableName(newItem.category);
    if (!tableName) {
      toast.error('No se encontró la tabla para esta categoría');
      return;
    }
    const validColumns = getValidColumns(newItem.category);

    try {
      // Remove category and _tableName — they're not DB columns
      const { category: _cat, _tableName, ...rawFields } = newItem;
      
      const dbFields = mapToDbFields(rawFields, validColumns);
      
      const createdItem = await sbInsertItem(tableName, dbFields);

      if (createdItem) {
        const details = facturaUrl
          ? `Artículo agregado al inventario | factura_url:${facturaUrl}`
          : 'Artículo agregado al inventario';
        // Guardar factura_url en memoria para mostrar botón inmediatamente
        setItemsState(prev => [...prev, { ...createdItem, category: newItem.category, _tableName: tableName, factura_url: facturaUrl || undefined }]);
        addMovement('Alta', newItem.name || 'Sin nombre', parseInt(newItem.qty) || 0, userName, details, newItem.category || 'General');
        toast.success(`Artículo creado: ${newItem.name || 'Sin nombre'}`);
      }
    } catch (err) {
      console.error('Add item error:', err);
      toast.error(`Error al crear: ${err.message}`);
    }
  }, [addMovement, getTableName]);

  const deleteItem = useCallback(async (itemId, userName = 'Jonathan') => {
    const item = itemsRef.current.find(i => i.id === itemId);
    const tableName = item?._tableName || getTableName(item?.category);

    try {
      if (tableName) {
        await sbDeleteItem(tableName, itemId);
      }
      setItemsState(prev => prev.filter(i => i.id !== itemId));
      addMovement('Eliminación', item?.name || 'Desconocido', 0, userName, 'Artículo eliminado del inventario', item?.category || 'General');
      toast.info(`Artículo eliminado: ${item?.name}`);
    } catch (err) {
      console.error('Delete item error:', err);
      toast.error(`Error al eliminar: ${err.message}`);
    }
  }, [addMovement, getTableName]);

  const editItem = useCallback(async (itemId, updatedFields, userName = 'Jonathan') => {
    const item = itemsRef.current.find(i => i.id === itemId);
    const tableName = item?._tableName || getTableName(item?.category);
    const validColumns = getValidColumns(item?.category);

    try {
      if (tableName) {
        const { category: _cat, _tableName, id, created_at, createdAt, ...rawFields } = updatedFields;
        
        const dbFields = mapToDbFields(rawFields, validColumns);

        // Build changes details for annulment
        const changes = [];
        const originalValues = {};
        Object.keys(dbFields).forEach(key => {
          if (item[key] !== dbFields[key]) {
            changes.push(`${key}: "${item[key]}" → "${dbFields[key]}"`);
            originalValues[key] = item[key];
          }
        });
        
        const updated = await sbUpdateItem(tableName, itemId, dbFields);
        if (updated) {
          setItemsState(prev => prev.map(i => i.id === itemId ? { ...i, ...updated } : i));
        }
        
        // Save changes in details for annulment
        const details = changes.length > 0 
          ? `Cambios: ${changes.join(', ')}`
          : 'Artículo editado (sin cambios detectados)';
        
        addMovement('Edición', item?.name || updatedFields.name || 'Desconocido', 0, userName, details, item?.category || updatedFields.category || 'General', originalValues);
        toast.success("Cambios guardados");
      }
    } catch (err) {
      console.error('Edit item error:', err);
      toast.error(`Error al editar: ${err.message}`);
    }
  }, [addMovement, getTableName]);

  const bulkAddItems = useCallback(async (itemsArray) => {
    try {
      toast.loading(`Importando ${itemsArray.length} artículos...`, { id: 'bulk-add' });
      const results = await Promise.all(
        itemsArray.map(async (item) => {
          const tableName = getTableName(item.category);
          if (!tableName) return null;
          const validColumns = getValidColumns(item.category);
          
          const { category: _cat, _tableName, id, createdAt, created_at, ...rawFields } = item;
          const initialItem = {
            ...rawFields,
            qty: parseInt(item.qty) || 0,
            threshold: parseInt(item.threshold) || 1,
            status: null,
          };

          const dbItem = mapToDbFields(initialItem, validColumns);

          const created = await sbInsertItem(tableName, dbItem);
          if (created) return { ...created, category: item.category, _tableName: tableName };
          return null;
        })
      );
      const validItems = results.filter(Boolean);
      setItemsState(prev => [...prev, ...validItems]);
      toast.success(`Importación exitosa: ${validItems.length} artículos añadidos`, { id: 'bulk-add' });
    } catch (err) {
      console.error('bulkAddItems error:', err);
      toast.error(`Error en importación: ${err.message}`, { id: 'bulk-add' });
    }
  }, [getTableName]);

  const bulkAddPersonnel = useCallback(async (personnelArray) => {
    const results = await Promise.all(personnelArray.map(person => sbInsertPersonnel({
      ...person,
      created_at: new Date().toISOString()
    })));
    const valid = results.filter(Boolean);
    setPersonnelState(prev => [...prev, ...valid]);
    toast.success(`Personal importado: ${valid.length} trabajadores añadidos`);
  }, []);

  const addWorker = useCallback(async (workerData) => {
    const created = await sbInsertPersonnel({
      ...workerData,
      created_at: new Date().toISOString()
    });
    if (created) {
      setPersonnelState(prev => [...prev, created]);
      toast.success(`Trabajador añadido: ${workerData.name}`);
    }
  }, []);

  const deleteWorker = useCallback(async (workerId) => {
    await sbDeletePersonnel(workerId);
    setPersonnelState(prev => prev.filter(p => p.id !== workerId));
    toast.info("Trabajador eliminado de la lista");
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
    const created = await sbInsertLocation(name, zone);
    if (created) {
      setLocationsState(prev => [...prev, created]);
      toast.success(`Ubicación añadida: ${name}`);
    }
  }, []);

  const deleteLocation = useCallback(async (id) => {
    await sbDeleteLocation(id);
    setLocationsState(prev => prev.filter(l => l.id !== id));
    toast.info("Ubicación eliminada");
  }, []);

  const wipeAllData = useCallback((currentUserId) => {
    if (isAutoWiping) return;
    try {
      setIsAutoWiping(true);
      toast.loading("ELIMINANDO TODA LA BASE DE DATOS...", { id: 'wipe' });
      
      clearAllData();
      
      setItemsState([]);
      setMovementsState([]);
      setPersonnelState([]);
      setBrandsState([]);
      setLocationsState([]);
      setGlobalStats({ items: 0, movements: 0, critical: 0, activity: [] });
      
      toast.success("BASE DE DATOS COMPLETAMENTE LIMPIA (0 REGISTROS)", { id: 'wipe' });
      return true;
    } catch (e) {
      console.error("Wipe error:", e);
      toast.error(`Error crítico: ${e.message}`, { id: 'wipe' });
      return false;
    } finally {
      setIsAutoWiping(false);
    }
  }, [isAutoWiping]);

  const deleteItemsByCategory = useCallback(async (category, userName = 'Jonathan') => {
    try {
      const categoryItems = itemsRef.current.filter(i => i.category === category);
      if (categoryItems.length === 0) {
        toast.info(`No hay artículos en la categoría: ${category}`);
        return;
      }

      toast.loading(`ELIMINANDO ${categoryItems.length} ARTÍCULOS...`, { id: 'category-delete' });

      await Promise.all(categoryItems.map(item => {
        const tableName = item._tableName || getTableName(item.category);
        return tableName ? sbDeleteItem(tableName, item.id) : Promise.resolve();
      }));

      setItemsState(prev => prev.filter(i => i.category !== category));
      addMovement(
        'Eliminación Masiva', `Todo ${category}`, categoryItems.length,
        userName, `Se eliminaron todos los elementos del apartado ${category}`, category
      );
      toast.success(`Se eliminaron ${categoryItems.length} artículos de ${category}`, { id: 'category-delete' });
      return true;
    } catch (e) {
      console.error("Delete category error:", e);
      toast.error(`Error al eliminar categoría: ${e.message}`, { id: 'category-delete' });
      return false;
    }
  }, [addMovement, getTableName]);

  const clearDatabaseCategories = useCallback(async (categories, userName = 'Jonathan') => {
    try {
      toast.loading("LIMPIANDO ÁREAS SELECCIONADAS...", { id: 'clear-db' });

      const itemsToDelete = itemsRef.current.filter(i => categories.includes(i.category));
      await Promise.all(itemsToDelete.map(item => {
        const tableName = item._tableName || getTableName(item.category);
        return tableName ? sbDeleteItem(tableName, item.id) : Promise.resolve();
      }));

      setItemsState(prev => prev.filter(i => !categories.includes(i.category)));
      // Filter movements from state too
      setMovementsState(prev => prev.filter(m => !categories.includes(m.category)));

      toast.success("Mantenimiento completado exitosamente", { id: 'clear-db' });
      return true;
    } catch (e) {
      console.error("Clear DB error:", e);
      toast.error(`Error en mantenimiento: ${e.message}`, { id: 'clear-db' });
      return false;
    }
  }, [getTableName]);

  const deleteItemsWithInvalidCategories = useCallback(async (validCategories, userName = 'Jonathan') => {
    try {
      const invalidItems = itemsRef.current.filter(i => !validCategories.includes(i.category));
      if (invalidItems.length === 0) {
        toast.info("No hay artículos con categorías inválidas");
        return false;
      }

      if (!window.confirm(`¿Eliminar ${invalidItems.length} artículos que no pertenecen a las categorías válidas? Esta acción es irreversible.`)) {
        return false;
      }

      toast.loading(`ELIMINANDO ${invalidItems.length} ARTÍCULOS INVÁLIDOS...`, { id: 'invalid-delete' });

      await Promise.all(invalidItems.map(item => {
        const tableName = item._tableName || getTableName(item.category);
        return tableName ? sbDeleteItem(tableName, item.id) : Promise.resolve();
      }));

      setItemsState(prev => prev.filter(i => validCategories.includes(i.category)));

      addMovement(
        'Eliminación Masiva', 'Categorías Inválidas', invalidItems.length,
        userName, `Se eliminaron artículos con categorías antiguas/inválidas`, 'General'
      );

      toast.success(`Se eliminaron ${invalidItems.length} artículos con categorías inválidas`, { id: 'invalid-delete' });
      return true;
    } catch (e) {
      console.error("Delete invalid categories error:", e);
      toast.error(`Error al eliminar categorías inválidas: ${e.message}`, { id: 'invalid-delete' });
      return false;
    }
  }, [addMovement]);

  const annulMovement = useCallback(async (movementId, adminName) => {
    const mov = movements.find(m => m.id === movementId);
    if (!mov || mov.annulled) return;

    try {
      const item = itemsRef.current.find(i => i.name === mov.item && i.category === mov.category);
      
      if (item) {
        let qtyChange = 0;
        let extraFields = {};
        
        if (mov.action === 'Entrada' || mov.action === 'Alta') {
          qtyChange = -(parseInt(mov.qty) || 0);
        } else if (mov.action === 'Salida') {
          qtyChange = (parseInt(mov.qty) || 0);
        } else if (mov.action === 'Préstamo') {
          qtyChange = 1;
          extraFields.prestados = Math.max((parseInt(item.prestados) || 0) - 1, 0);
          if (extraFields.prestados === 0) extraFields.status = 'Disponible';
        } else if (mov.action === 'Devolución') {
          qtyChange = -1;
          extraFields.prestados = (parseInt(item.prestados) || 0) + 1;
        } else if (mov.action === 'Auditoría') {
          // Parse diff from details: "Conteo físico: 201 (Ajuste: +1)" or "Audit: reason (Ajuste: -5)"
          const match = mov.details?.match(/Ajuste:\s*([+-]?\d+)/);
          if (match) {
            qtyChange = -parseInt(match[1]); // Reverse the adjustment
          } else {
            // Old audit without diff - mark as annulled but don't reverse stock
            console.warn('[annulMovement] Old audit without diff - cannot reverse stock automatically');
            toast.warning('Auditoría antigua: no se puede revertir el stock automáticamente. Solo se marcará como anulada.');
          }
        } else if (mov.action === 'Edición' && mov.originalValues) {
          // Restore original values
          extraFields = { ...mov.originalValues };
        }

        if (qtyChange !== 0 || Object.keys(extraFields).length > 0) {
          const newQty = (parseInt(item.qty) || 0) + qtyChange;
          const tableName = item._tableName || getTableName(item.category);
          if (tableName) {
            await sbUpdateItem(tableName, item.id, { qty: newQty, ...extraFields });
          }
          setItemsState(prev => prev.map(i => i.id === item.id ? { ...i, qty: newQty, ...extraFields } : i));
        }
      }

      const annulFields = {
        annulled: true
      };

      // Update in Supabase
      const sbUpdated = await sbUpdateMovement(movementId, annulFields);
      // Also update localStorage cache
      updateLocalStorageMovement(movementId, annulFields);

      const updatedMovement = sbUpdated || { ...mov, ...annulFields };
      setMovementsState(prev => prev.map(m => m.id === movementId ? updatedMovement : m));

      addMovement(
        'Anulación', mov.item, mov.qty, adminName,
        `Reversión de ${mov.action}. Movimiento #${movementId.substring(0,5)}`,
        mov.category
      );

      toast.success("Movimiento anulado correctamente");
    } catch (e) {
      console.error("Annul error:", e);
      toast.error("Error al anular movimiento");
    }
  }, [movements, addMovement]);

  // ─── Supabase Realtime subscriptions ───
  useEffect(() => {
    if (!user || catsLoading || !categories.length) return;

    const channels = [];
    let subscribedCount = 0;
    const totalChannels = categories.filter(c => c.tableName).length + 1;

    const onChannelReady = () => {
      subscribedCount++;
      if (subscribedCount >= totalChannels) {
        setConnectionStatus('online');
        setLastSync(new Date());
      }
    };

    const onChannelError = () => {
      setConnectionStatus('offline');
    };

    // Subscribe to movements table
    const movCh = supabase
      .channel('realtime-movements')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'movements' }, (payload) => {
        setLastSync(new Date());
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
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') onChannelReady();
        else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') onChannelError();
        else if (status === 'TIMED_OUT') setConnectionStatus('reconnecting');
      });
    channels.push(movCh);

    // Subscribe to each category item table
    categories.forEach(cat => {
      if (!cat.tableName) return;
      const ch = supabase
        .channel(`realtime-${cat.tableName}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: cat.tableName }, (payload) => {
          console.log('[Realtime] Table:', cat.tableName, 'Event:', payload.eventType, 'Payload:', payload);
          setLastSync(new Date());
          if (payload.eventType === 'INSERT') {
            setItemsState(prev => {
              if (prev.find(i => i.id === payload.new.id)) return prev;
              return [...prev, { ...payload.new, category: cat.title, _tableName: cat.tableName }];
            });
          } else if (payload.eventType === 'UPDATE') {
            console.log('[Realtime UPDATE] Updating item:', payload.new.id, 'New qty:', payload.new.qty);
            setItemsState(prev => prev.map(i =>
              i.id === payload.new.id ? { ...i, ...payload.new, category: cat.title, _tableName: cat.tableName } : i
            ));
          } else if (payload.eventType === 'DELETE') {
            setItemsState(prev => prev.filter(i => i.id !== payload.old.id));
          }
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') onChannelReady();
          else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') onChannelError();
          else if (status === 'TIMED_OUT') setConnectionStatus('reconnecting');
        });
      channels.push(ch);
    });

    return () => {
      setConnectionStatus('offline');
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [user, categories, catsLoading]);

  // Sync: reload items from Supabase
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

  // ─── Context Value (memoized) ───
  const contextValue = useMemo(() => ({
    items,
    movements,
    personnel,
    brands,
    locations,
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
    wipeAllData,
    deleteItemsByCategory,
    clearDatabaseCategories,
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
    wipeAllData,
    deleteItemsByCategory,
    clearDatabaseCategories,
    deleteItemsWithInvalidCategories,
    isAutoWiping,
    lastSync,
    connectionStatus,
    annulMovement,
    syncInventory,
  ]);

  return (
    <InventoryContext.Provider value={contextValue}>
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => useContext(InventoryContext);
