import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useCategories } from './CategoriesContext';
import { toast } from 'sonner';
import {
  getItems, setItems, addItem as addLocalStorageItem, updateItem as updateLocalStorageItem, deleteItem as deleteLocalStorageItem,
  getMovements, setMovements, addMovement as addLocalStorageMovement, updateMovement as updateLocalStorageMovement,
  getPersonnel, setPersonnel, addPerson as addLocalStoragePerson, deletePerson as deleteLocalStoragePerson,
  getBrands, setBrands, addBrand as addLocalStorageBrand, deleteBrand as deleteLocalStorageBrand,
  getLocations, setLocations, addLocation as addLocalStorageLocation, deleteLocation as deleteLocalStorageLocation,
  clearAllData, getStats
} from '../storage/localStorage';
import {
  fetchItems as sbFetchItems,
  insertItem as sbInsertItem,
  updateItem as sbUpdateItem,
  deleteItem as sbDeleteItem,
  fetchMovements as sbFetchMovements,
  insertMovement as sbInsertMovement,
  updateMovement as sbUpdateMovement,
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
          allItems.push({ ...row, category: cat.title, _tableName: cat.tableName });
        });
      }));
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
        // Load personnel, brands, locations from localStorage
        setPersonnelState(getPersonnel());
        setBrandsState(getBrands());
        setLocationsState(getLocations());

        // Load items and movements from Supabase in parallel
        const [, sbMovements] = await Promise.all([
          loadAllItems(),
          sbFetchMovements(500),
        ]);

        if (sbMovements.length > 0) {
          setMovementsState(sbMovements);
        } else {
          // Fallback: show localStorage movements if Supabase table not yet created
          setMovementsState(getMovements());
        }

        setGlobalStats(getStats());
        setLastSync(new Date());
      } catch (err) {
        console.error('[Inventory] Init error:', err);
        setLoadError(err.message);
        // Fallback to localStorage on error
        setMovementsState(getMovements());
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [user, catsLoading, loadAllItems]);

  // ─── Actualizar estadísticas ───
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      setGlobalStats(prev => ({
        ...prev,
        items: items.length,
        movements: movements.length,
        critical: items.filter(i => (i.qty || 0) <= (i.threshold || 0) && (i.threshold || 0) > 0).length,
      }));
    }, 30000);
    return () => clearInterval(interval);
  }, [user, items, movements]);

  // ─── Helpers ───
  const addMovement = useCallback(async (action, itemName, qty, userName = 'Jonathan', details = '', category = 'General') => {
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

      // Save to Supabase (fire-and-forget, fallback to localStorage on error)
      const saved = await sbInsertMovement(movementData);
      const finalMovement = saved || { ...movementData, id: Date.now().toString() + Math.random().toString(36).substr(2, 9) };

      // Always keep localStorage in sync as local cache
      addLocalStorageMovement(movementData);

      setMovementsState(prev => [finalMovement, ...prev]);
      setGlobalStats(getStats());
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
    
    try {
      if (tableName) {
        await sbUpdateItem(tableName, itemId, { qty: newQty });
      }
      setItemsState(prev => {
        const updated = [...prev];
        updated[itemIndex] = { ...updated[itemIndex], qty: newQty };
        return updated;
      });
      
      const defaultDetails = `${change > 0 ? 'Reposición' : 'Gasto'} de material`;
      addMovement(
        change > 0 ? 'Entrada' : 'Salida', 
        item.name, 
        Math.abs(change), 
        userName, 
        customDetails || defaultDetails,
        item.category
      );
      toast.success(`${change > 0 ? 'Entrada' : 'Salida'} registrada: ${item.name}`);
    } catch (err) {
      console.error('Update stock error:', err);
      toast.error(`Error al actualizar stock: ${err.message}`);
    }
  }, [addMovement, getTableName]);

  const loanItem = useCallback((itemId, borrower, userName = 'Jonathan') => {
    const item = itemsRef.current.find(i => i.id === itemId);
    if (!item || (item.qty || 0) <= 0) {
      toast.error("No hay stock disponible para préstamo");
      return;
    }

    const qtyNum = parseInt(item.qty) || 0;
    const prestadosNum = parseInt(item.prestados) || (item.status === 'Prestado' ? 1 : 0);
    
    const remainingQty = Math.max(qtyNum - 1, 0);
    const totalLent = prestadosNum + 1;
    
    const updatedItem = updateLocalStorageItem(itemId, {
      qty: remainingQty,
      prestados: totalLent,
      status: remainingQty <= 0 ? 'Prestado' : 'Disponible',
      borrowedBy: borrower || null,
      lentBy: userName || null,
      loanDate: new Date().toISOString()
    });

    if (updatedItem) {
      setItemsState(prev => prev.map(i => i.id === itemId ? updatedItem : i));
      addMovement('Préstamo', item.name, 1, userName, borrower, item.category);
      toast.success(`Artículo prestado a ${borrower} (Disponibles: ${remainingQty})`);
    }
  }, [addMovement]);

  const bulkLoanItems = useCallback((itemIds, borrower, userName = 'Jonathan') => {
    const availableItems = itemsRef.current.filter(i => itemIds.includes(i.id) && (i.qty || 0) > 0);
    if (availableItems.length === 0) {
      toast.error("Ninguno de los artículos seleccionados tiene stock");
      return;
    }

    const updatedItems = [];
    availableItems.forEach(item => {
      const qtyNum = parseInt(item.qty) || 0;
      const prestadosNum = parseInt(item.prestados) || (item.status === 'Prestado' ? 1 : 0);
      const remainingQty = Math.max(qtyNum - 1, 0);
      const totalLent = prestadosNum + 1;
      
      const updated = updateLocalStorageItem(item.id, {
        qty: remainingQty,
        prestados: totalLent,
        status: remainingQty <= 0 ? 'Prestado' : 'Disponible',
        borrowedBy: borrower || null,
        lentBy: userName || null,
        loanDate: new Date().toISOString()
      });
      if (updated) updatedItems.push(updated);
    });

    setItemsState(prev => {
      const updated = [...prev];
      updatedItems.forEach(item => {
        const idx = updated.findIndex(i => i.id === item.id);
        if (idx !== -1) updated[idx] = item;
      });
      return updated;
    });

    for (const item of availableItems) {
      addMovement('Préstamo', item.name, 1, userName, borrower, item.category);
    }
    toast.success(`${availableItems.length} artículos prestados a ${borrower}`);
  }, [addMovement]);

  const returnItem = useCallback((itemId, userName = 'Jonathan') => {
    const item = itemsRef.current.find(i => i.id === itemId);
    if (!item) return;

    const qtyNum = parseInt(item.qty) || 0;
    const prestadosNum = parseInt(item.prestados) || (item.status === 'Prestado' ? 1 : 0);

    const newQty = qtyNum + 1;
    const newLent = Math.max(prestadosNum - 1, 0);

    const updatedItem = updateLocalStorageItem(itemId, {
      qty: newQty,
      prestados: newLent,
      status: 'Disponible',
      borrowedBy: newLent === 0 ? null : (item.borrowedBy || null),
      lentBy: newLent === 0 ? null : (item.lentBy || null),
      loanDate: newLent === 0 ? null : (item.loanDate || null)
    });

    if (updatedItem) {
      setItemsState(prev => prev.map(i => i.id === itemId ? updatedItem : i));
      addMovement('Devolución', item.name, 1, userName, 'Devuelto a almacén', item.category);
      toast.success(`Herramienta devuelta (En almacén: ${newQty})`);
    }
  }, [addMovement]);

  const reportMaintenance = useCallback((itemId, reason, userName = 'Jonathan') => {
    const item = itemsRef.current.find(i => i.id === itemId);
    if (!item) return;

    const remainingQty = Math.max((item.qty || 0) - 1, 0);

    const updatedItem = updateLocalStorageItem(itemId, {
      qty: remainingQty,
      observaciones: `Falla: ${reason} (Reportó: ${userName})`,
      status: 'Mantenimiento'
    });

    if (updatedItem) {
      setItemsState(prev => prev.map(i => i.id === itemId ? updatedItem : i));
      addMovement('Falla/Manto', item.name, 1, userName, reason, item.category);
      toast.warning(`Reporte registrado: 1x ${item.name} retirado por falla`);
    }
  }, [addMovement]);

  const completeMaintenance = useCallback((itemId, userName = 'Jonathan') => {
    const item = itemsRef.current.find(i => i.id === itemId);
    if (!item) return;

    const newQty = (item.qty || 0) + 1;

    const updatedItem = updateLocalStorageItem(itemId, {
      qty: newQty,
      status: 'Disponible',
      observaciones: `Reparado el ${new Date().toLocaleDateString()} por ${userName}`
    });

    if (updatedItem) {
      setItemsState(prev => prev.map(i => i.id === itemId ? updatedItem : i));
      addMovement('Entrada', item.name, 1, userName, 'Reparado / Fin de mantenimiento', item.category);
      toast.success(`Herramienta reparada: ${item.name} vuelve a estar disponible`);
    }
  }, [addMovement]);

  const auditStock = useCallback((itemId, physicalQty, userName = 'Jonathan', reason = '') => {
    const item = itemsRef.current.find(i => i.id === itemId);
    if (!item) return;

    const diff = physicalQty - (item.qty || 0);
    
    const updatedItem = updateLocalStorageItem(itemId, { qty: physicalQty });
    if (updatedItem) {
      setItemsState(prev => prev.map(i => i.id === itemId ? updatedItem : i));
      
      const finalReason = reason ? `Audit: ${reason}` : `Conteo físico: ${physicalQty} (Ajuste: ${diff > 0 ? '+' : ''}${diff})`;
      addMovement('Auditoría', item.name, Math.abs(diff), userName, finalReason, item.category);
      toast.success("Auditoría registrada exitosamente");
    }
  }, [addMovement]);

  const addItem = useCallback(async (newItem, userName = 'Jonathan') => {
    const tableName = getTableName(newItem.category);
    if (!tableName) {
      toast.error('No se encontró la tabla para esta categoría');
      return;
    }

    try {
      // Remove category and _tableName — they're not DB columns
      const { category: _cat, _tableName, ...dbFields } = newItem;
      const createdItem = await sbInsertItem(tableName, dbFields);

      if (createdItem) {
        setItemsState(prev => [...prev, { ...createdItem, category: newItem.category, _tableName: tableName }]);
        addMovement('Alta', newItem.name || 'Sin nombre', parseInt(newItem.qty) || 0, userName, 'Artículo agregado al inventario', newItem.category || 'General');
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

    try {
      if (tableName) {
        const { category: _cat, _tableName, id, created_at, createdAt, ...dbFields } = updatedFields;
        const updated = await sbUpdateItem(tableName, itemId, dbFields);
        if (updated) {
          setItemsState(prev => prev.map(i => i.id === itemId ? { ...i, ...updated } : i));
        }
      }
      addMovement('Edición', item?.name || updatedFields.name || 'Desconocido', 0, userName, 'Artículo editado', item?.category || updatedFields.category || 'General');
      toast.success("Cambios guardados");
    } catch (err) {
      console.error('Edit item error:', err);
      toast.error(`Error al editar: ${err.message}`);
    }
  }, [addMovement, getTableName]);

  const bulkAddItems = useCallback((itemsArray) => {
    const createdItems = itemsArray.map(item => addLocalStorageItem({
      ...item,
      qty: parseInt(item.qty) || 0,
      threshold: parseInt(item.threshold) || 1,
      status: null,
      timestamp: new Date().toISOString()
    }));
    
    setItemsState(prev => [...prev, ...createdItems]);
    toast.success(`Importación exitosa: ${itemsArray.length} artículos añadidos`);
  }, []);

  const bulkAddPersonnel = useCallback((personnelArray) => {
    const createdPersons = personnelArray.map(person => addLocalStoragePerson({
      ...person,
      createdAt: new Date().toISOString()
    }));
    
    setPersonnelState(prev => [...prev, ...createdPersons]);
    toast.success(`Personal importado: ${personnelArray.length} trabajadores añadidos`);
  }, []);

  const addWorker = useCallback((workerData) => {
    const createdPerson = addLocalStoragePerson({
      ...workerData,
      createdAt: new Date().toISOString()
    });
    
    if (createdPerson) {
      setPersonnelState(prev => [...prev, createdPerson]);
      toast.success(`Trabajador añadido: ${workerData.name}`);
    }
  }, []);

  const deleteWorker = useCallback((workerId) => {
    deleteLocalStoragePerson(workerId);
    setPersonnelState(prev => prev.filter(p => p.id !== workerId));
    toast.info("Trabajador eliminado de la lista");
  }, []);

  const addBrand = useCallback((name) => {
    const existingBrand = getBrands().find(b => b.name === name);
    if (existingBrand) {
      toast.error("Esta marca ya existe");
      return;
    }
    
    const createdBrand = addLocalStorageBrand(name);
    if (createdBrand) {
      setBrandsState(prev => [...prev, createdBrand]);
      toast.success(`Marca añadida: ${name}`);
    }
  }, []);

  const deleteBrand = useCallback((id) => {
    deleteLocalStorageBrand(id);
    setBrandsState(prev => prev.filter(b => b.id !== id));
    toast.info("Marca eliminada");
  }, []);

  const addLocation = useCallback((name, zone = '') => {
    const createdLocation = addLocalStorageLocation(name, zone);
    if (createdLocation) {
      setLocationsState(prev => [...prev, createdLocation]);
      toast.success(`Ubicación añadida: ${name}`);
    }
  }, []);

  const deleteLocation = useCallback((id) => {
    deleteLocalStorageLocation(id);
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

  const deleteItemsByCategory = useCallback((category, userName = 'Jonathan') => {
    try {
      const categoryItems = itemsRef.current.filter(i => i.category === category);
      if (categoryItems.length === 0) {
        toast.info(`No hay artículos en la categoría: ${category}`);
        return;
      }

      toast.loading(`ELIMINANDO ${categoryItems.length} ARTÍCULOS...`, { id: 'category-delete' });
      
      categoryItems.forEach(item => deleteLocalStorageItem(item.id));
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
  }, [addMovement]);

  const clearDatabaseCategories = useCallback((categories, userName = 'Jonathan') => {
    try {
      toast.loading("LIMPIANDO ÁREAS SELECCIONADAS...", { id: 'clear-db' });

      for (const category of categories) {
        const categoryItems = itemsRef.current.filter(i => i.category === category);
        categoryItems.forEach(item => deleteLocalStorageItem(item.id));

        const categoryMovements = movements.filter(m => m.category === category);
        categoryMovements.forEach(m => {
          // In localStorage we don't have a delete function for movements by ID,
          // so we'll need to filter and set
          const updated = movements.filter(mov => mov.id !== m.id);
          setMovementsState(updated);
          setMovements(updated);
        });
      }

      setItemsState(prev => prev.filter(i => !categories.includes(i.category)));
      setGlobalStats(getStats());

      toast.success("Mantenimiento completado exitosamente", { id: 'clear-db' });
      return true;
    } catch (e) {
      console.error("Clear DB error:", e);
      toast.error(`Error en mantenimiento: ${e.message}`, { id: 'clear-db' });
      return false;
    }
  }, [movements, addMovement]);

  const deleteItemsWithInvalidCategories = useCallback((validCategories, userName = 'Jonathan') => {
    try {
      const invalidItems = itemsRef.current.filter(i => !validCategories.includes(i.category));
      if (invalidItems.length === 0) {
        toast.info("No hay artículos con categorías inválidas");
        return false;
      }

      if (!window.confirm(`¿Eliminar ${invalidItems.length} artículos que no pertenecen a las 10 categorías nuevas? Esta acción es irreversible.`)) {
        return false;
      }

      toast.loading(`ELIMINANDO ${invalidItems.length} ARTÍCULOS INVÁLIDOS...`, { id: 'invalid-delete' });

      invalidItems.forEach(item => deleteLocalStorageItem(item.id));
      setItemsState(prev => prev.filter(i => validCategories.includes(i.category)));
      setGlobalStats(getStats());

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
        }

        if (qtyChange !== 0 || Object.keys(extraFields).length > 0) {
          const updatedItem = updateLocalStorageItem(item.id, { 
            qty: (parseInt(item.qty) || 0) + qtyChange,
            ...extraFields
          });
          if (updatedItem) {
            setItemsState(prev => prev.map(i => i.id === item.id ? updatedItem : i));
          }
        }
      }

      const annulFields = {
        annulled: true,
        annulledBy: adminName,
        annulledAt: new Date().toISOString()
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
