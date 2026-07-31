import { useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { sendCriticalStockAlert } from '../utils/emailService';
import { addToQueue } from '../services/offlineSyncQueue';
import {
  insertItem as sbInsertItem,
  updateItem as sbUpdateItem,
  deleteItem as sbDeleteItem,
} from '../storage/supabaseStorage';

export const useInventoryItems = ({ 
  itemsRef, 
  setItemsMap, 
  addMovement, 
  getTableName, 
  getValidColumns, 
  getFieldMappings,
  mapToDbFields 
}) => {
  const updateStock = useCallback(async (itemId, change, userName = 'Sistema', customDetails = '') => {
    const currentItemsMap = itemsRef.current;
    const item = currentItemsMap[itemId];
    if (!item) return;

    if ((item.qty || 0) + change < 0) {
      toast.error("Error: Stock insuficiente", {
        description: `Solo quedan ${item.qty} unidades de ${item.name}.`
      });
      return;
    }

    const newQty = (item.qty || 0) + change;
    const tableName = item._tableName || getTableName(item.category);
    const validColumns = getValidColumns(item.category);
    const fieldMappings = getFieldMappings(item.category);
    
    try {
      if (tableName) {
        const updates = mapToDbFields({ qty: newQty }, validColumns, fieldMappings);
        try {
          await sbUpdateItem(tableName, itemId, updates);
        } catch (err) {
          if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
            addToQueue({ type: 'UPDATE_ITEM', payload: { tableName, itemId, updates } });
            toast.warning('Sin conexión. Movimiento guardado para sincronizar después.');
          } else {
            throw err;
          }
        }
      }
      const urlMatch = customDetails?.match(/(?:factura_url:|factura:\s*)(https?:\/\/\S+)/i);
      const facturaUrl = urlMatch ? urlMatch[1] : null;
      setItemsMap(prev => {
        const currentItem = prev[itemId] || item;
        
        const newInvoices = currentItem.invoices ? [...currentItem.invoices] : [];
        if (facturaUrl && !newInvoices.some(inv => inv.url === facturaUrl)) {
          const isEntrada = change > 0;
          const typeLabel = isEntrada ? 'Compra' : 'Salida';
          const dateStr = new Date().toLocaleDateString('es-MX');
          
          newInvoices.push({
            url: facturaUrl,
            type: isEntrada ? 'Entrada' : 'Salida',
            label: `Factura de ${typeLabel} (${dateStr} - Nueva)`,
            timestamp: new Date().toISOString(),
            user: userName
          });
        }

        return {
          ...prev,
          [itemId]: {
            ...currentItem,
            qty: newQty,
            invoices: newInvoices,
            ...(!currentItem.factura_url && facturaUrl ? { factura_url: facturaUrl } : {}),
          }
        };
      });
      
      const defaultDetails = `${change > 0 ? 'Reposición' : 'Gasto'} de material`;
      let finalDetails = customDetails || defaultDetails;
      if (finalDetails && !finalDetails.includes('item_id:') && itemId) {
        finalDetails = `${finalDetails} | item_id:${itemId}`;
      }
      const newMovement = await addMovement(
        change > 0 ? 'Entrada' : 'Salida', 
        item.name, 
        Math.abs(change), 
        userName, 
        finalDetails,
        item.category
      );

      // Si existe un approval_id en los detalles, enlazamos el movimiento con la solicitud de aprobación
      const approvalMatch = finalDetails?.match(/approval_id:([0-9a-fA-F-]+)/);
      if (approvalMatch && newMovement?.id) {
        const approvalId = approvalMatch[1];
        try {
          await supabase.from('approval_requests')
            .update({ movement_id: newMovement.id })
            .eq('id', approvalId);
        } catch (err) {
          console.error('[updateStock] Error linking approval to movement:', err);
        }
      }

      const threshold = item.threshold || 0;
      if (newQty <= threshold && (item.qty || 0) > threshold) {
        sendCriticalStockAlert(item.name, newQty, threshold);
      }

      toast.success(`${change > 0 ? 'Entrada' : 'Salida'} registrada: ${item.name}`);
    } catch (err) {
      console.error('[updateStock] ERROR:', err);
      toast.error(`Error: ${err.message}`, { duration: 6000 });
    }
  }, [addMovement, getTableName, getValidColumns, getFieldMappings, mapToDbFields, itemsRef, setItemsMap]);

  const loanItem = useCallback(async (itemId, borrower, userName = 'Sistema') => {
    const item = itemsRef.current[itemId];
    if (!item || (item.qty || 0) <= 0) {
      toast.error("No hay stock disponible para préstamo");
      return;
    }

    const tableName = item._tableName || getTableName(item.category);
    const qtyNum = parseInt(item.qty) || 0;
    const prestadosNum = parseInt(item.prestados) || (item.status === 'Prestado' ? 1 : 0);
    const remainingQty = Math.max(qtyNum - 1, 0);
    const totalLent = prestadosNum + 1;
    
    // Concatenate borrower history instead of overwriting
    const newBorrowedBy = item.borrowedBy ? `${item.borrowedBy}, ${borrower || ''}` : (borrower || null);
    const newLentBy = item.lentBy ? `${item.lentBy}, ${userName || ''}` : (userName || null);

    const updates = {
      qty: remainingQty,
      prestados: totalLent,
      status: remainingQty <= 0 ? 'Prestado' : 'Disponible',
      borrowedBy: newBorrowedBy,
      lentBy: newLentBy,
      loanDate: new Date().toISOString()
    };

    try {
      if (tableName) await sbUpdateItem(tableName, itemId, updates);
      setItemsMap(prev => ({
        ...prev,
        [itemId]: { ...(prev[itemId] || item), ...updates }
      }));
      await addMovement('Préstamo', item.name, 1, userName, borrower, item.category);
      toast.success(`Artículo prestado a ${borrower} (Disponibles: ${remainingQty})`);
    } catch (err) {
      toast.error(`Error al registrar préstamo: ${err.message}`);
    }
  }, [addMovement, getTableName, itemsRef, setItemsMap]);

  const bulkLoanItems = useCallback(async (itemIds, borrower, userName = 'Sistema') => {
    const availableItems = itemIds.map(id => itemsRef.current[id]).filter(i => i && (i.qty || 0) > 0);
    if (availableItems.length === 0) {
      toast.error("Ninguno de los artículos seleccionados tiene stock");
      return;
    }

    try {
      const updatesList = availableItems.map(item => {
        const remainingQty = Math.max((parseInt(item.qty) || 0) - 1, 0);
        const totalLent = (parseInt(item.prestados) || 0) + 1;
        
        const newBorrowedBy = item.borrowedBy ? `${item.borrowedBy}, ${borrower || ''}` : (borrower || null);
        const newLentBy = item.lentBy ? `${item.lentBy}, ${userName || ''}` : (userName || null);

        return {
          item,
          updates: {
            qty: remainingQty,
            prestados: totalLent,
            status: remainingQty <= 0 ? 'Prestado' : 'Disponible',
            borrowedBy: newBorrowedBy,
            lentBy: newLentBy,
            loanDate: new Date().toISOString()
          }
        };
      });

      const results = await Promise.allSettled(updatesList.map(({ item, updates }) => {
        const tableName = item._tableName || getTableName(item.category);
        return tableName ? sbUpdateItem(tableName, item.id, updates) : Promise.resolve();
      }));

      const successfulUpdates = updatesList.filter((_, index) => results[index].status === 'fulfilled');

      if (successfulUpdates.length === 0) {
        throw new Error("No se pudo registrar ningún préstamo en la base de datos.");
      }

      setItemsMap(prev => {
        const nextMap = { ...prev };
        successfulUpdates.forEach(({ item: uItem, updates: uUpdates }) => {
          nextMap[uItem.id] = { ...(nextMap[uItem.id] || uItem), ...uUpdates };
        });
        return nextMap;
      });

      for (const { item } of successfulUpdates) {
        await addMovement('Préstamo', item.name, 1, userName, borrower, item.category);
      }
      
      if (successfulUpdates.length < updatesList.length) {
        toast.warning(`Se prestaron solo ${successfulUpdates.length} de ${updatesList.length} artículos por errores de red.`);
      } else {
        toast.success(`${successfulUpdates.length} artículos prestados a ${borrower}`);
      }
    } catch (err) {
      toast.error(`Error en préstamo masivo: ${err.message}`);
    }
  }, [addMovement, getTableName, itemsRef, setItemsMap]);

  const returnItem = useCallback(async (itemId, userName = 'Sistema') => {
    const item = itemsRef.current[itemId];
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
      setItemsMap(prev => ({
        ...prev,
        [itemId]: { ...(prev[itemId] || item), ...updates }
      }));
      await addMovement('Devolución', item.name, 1, userName, 'Devuelto a almacén', item.category);
      toast.success(`Herramienta devuelta (En almacén: ${newQty})`);
    } catch (err) {
      toast.error(`Error al registrar devolución: ${err.message}`);
    }
  }, [addMovement, getTableName, itemsRef, setItemsMap]);

  const reportMaintenance = useCallback(async (itemId, reason, userName = 'Sistema') => {
    const item = itemsRef.current[itemId];
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
      setItemsMap(prev => ({
        ...prev,
        [itemId]: { ...(prev[itemId] || item), ...updates }
      }));
      await addMovement('Falla/Manto', item.name, 1, userName, reason, item.category);
      toast.warning(`Reporte registrado: 1x ${item.name} retirado por falla`);
    } catch (err) {
      toast.error(`Error al reportar falla: ${err.message}`);
    }
  }, [addMovement, getTableName, itemsRef, setItemsMap]);

  const completeMaintenance = useCallback(async (itemId, userName = 'Sistema') => {
    const item = itemsRef.current[itemId];
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
      setItemsMap(prev => ({
        ...prev,
        [itemId]: { ...(prev[itemId] || item), ...updates }
      }));
      await addMovement('Entrada', item.name, 1, userName, 'Reparado / Fin de mantenimiento', item.category);
      toast.success(`Herramienta reparada: ${item.name} vuelve a estar disponible`);
    } catch (err) {
      toast.error(`Error al completar mantenimiento: ${err.message}`);
    }
  }, [addMovement, getTableName, itemsRef, setItemsMap]);

  const auditStock = useCallback(async (itemId, physicalQty, userName = 'Sistema', reason = '') => {
    const item = itemsRef.current[itemId];
    if (!item) return;

    const tableName = item._tableName || getTableName(item.category);
    const diff = physicalQty - (item.qty || 0);
    const validColumns = getValidColumns(item.category);
    const fieldMappings = getFieldMappings(item.category);

    try {
      if (tableName) {
        const updates = mapToDbFields({ qty: physicalQty }, validColumns, fieldMappings);
        await sbUpdateItem(tableName, itemId, updates);
      }
      setItemsMap(prev => ({
        ...prev,
        [itemId]: { ...(prev[itemId] || item), qty: physicalQty }
      }));
      const finalReason = reason ? `Audit: ${reason} (Ajuste: ${diff > 0 ? '+' : ''}${diff})` : `Conteo físico: ${physicalQty} (Ajuste: ${diff > 0 ? '+' : ''}${diff})`;
      await addMovement('Auditoría', item.name, Math.abs(diff), userName, finalReason, item.category);

      const threshold = item.threshold || 0;
      if (physicalQty <= threshold && (item.qty || 0) > threshold) {
        sendCriticalStockAlert(item.name, physicalQty, threshold);
      }

      toast.success("Auditoría registrada exitosamente");
    } catch (err) {
      toast.error(`Error en auditoría: ${err.message}`);
    }
  }, [addMovement, getTableName, getValidColumns, getFieldMappings, mapToDbFields, itemsRef, setItemsMap]);

  const addItem = useCallback(async (newItem, userName = 'Sistema', facturaUrl = null) => {
    const tableName = getTableName(newItem.category);
    if (!tableName) {
      toast.error('No se encontró la tabla para esta categoría');
      return;
    }
    const validColumns = getValidColumns(newItem.category);
    const fieldMappings = getFieldMappings(newItem.category);

    try {
      const { category: _cat, _tableName, ...rawFields } = newItem;
      const dbFields = mapToDbFields(rawFields, validColumns, fieldMappings);
      
      const createdItem = await sbInsertItem(tableName, dbFields);

      if (createdItem) {
        const details = [
          'Artículo agregado al inventario',
          createdItem.id ? `item_id:${createdItem.id}` : null,
          facturaUrl ? `factura_url:${facturaUrl}` : null,
        ].filter(Boolean).join(' | ');
        const initialInvoices = [];
        if (facturaUrl) {
          initialInvoices.push({
            url: facturaUrl,
            type: 'Alta',
            label: 'Factura de Compra (Original)',
            timestamp: new Date().toISOString()
          });
        }
        
        setItemsMap(prev => ({
          ...prev,
          [createdItem.id]: {
            ...createdItem, 
            category: newItem.category, 
            _tableName: tableName, 
            factura_url: facturaUrl || undefined,
            invoices: initialInvoices
          }
        }));
        await addMovement('Alta', newItem.name || 'Sin nombre', parseInt(newItem.qty) || 0, userName, details, newItem.category || 'General');
        toast.success(`Artículo creado: ${newItem.name || 'Sin nombre'}`);
      }
    } catch (err) {
      console.error('Add item error:', err);
      toast.error(`Error al crear: ${err.message}`);
    }
  }, [addMovement, getTableName, getValidColumns, getFieldMappings, mapToDbFields, setItemsMap]);

  const deleteItem = useCallback(async (itemId, userName = 'Sistema') => {
    const item = itemsRef.current[itemId];
    const tableName = item?._tableName || getTableName(item?.category);

    try {
      if (tableName) {
        await sbDeleteItem(tableName, itemId);
      }
      setItemsMap(prev => {
        const nextMap = { ...prev };
        delete nextMap[itemId];
        return nextMap;
      });
      await addMovement('Eliminación', item?.name || 'Desconocido', 0, userName, 'Artículo eliminado del inventario', item?.category || 'General');
      toast.info(`Artículo eliminado: ${item?.name}`);
    } catch (err) {
      console.error('Delete item error:', err);
      toast.error(`Error al eliminar: ${err.message}`);
    }
  }, [addMovement, getTableName, itemsRef, setItemsMap]);

  const editItem = useCallback(async (itemId, updatedFields, userName = 'Sistema') => {
    const item = itemsRef.current[itemId];
    const tableName = item?._tableName || getTableName(item?.category);
    const validColumns = getValidColumns(item?.category);
    const fieldMappings = getFieldMappings(item?.category);

    try {
      if (tableName) {
        const { category: _cat, _tableName, id: _id, created_at: _created_at, createdAt: _createdAt, ...rawFields } = updatedFields;
        const dbFields = mapToDbFields(rawFields, validColumns, fieldMappings);

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
          const normalized = { ...updated };
          if (normalized.nombre !== undefined) normalized.name = normalized.nombre;
          if (normalized.cantidad !== undefined) normalized.qty = normalized.cantidad;
          if (normalized.detalles !== undefined) normalized.observaciones = normalized.detalles;
          if (normalized.stock_min !== undefined) normalized.threshold = normalized.stock_min;
          if (normalized.minimo !== undefined) normalized.threshold = normalized.minimo;
          
          setItemsMap(prev => ({
            ...prev,
            [itemId]: { ...(prev[itemId] || item), ...normalized }
          }));
        }
        
        const details = changes.length > 0 
          ? `Cambios: ${changes.join(', ')}`
          : 'Artículo editado (sin cambios detectados)';
        
        await addMovement('Edición', item?.name || updatedFields.name || 'Desconocido', 0, userName, details, item?.category || updatedFields.category || 'General', originalValues);
        toast.success("Cambios guardados");
      }
    } catch (err) {
      console.error('Edit item error:', err);
      toast.error(`Error al editar: ${err.message}`);
    }
  }, [addMovement, getTableName, getValidColumns, getFieldMappings, mapToDbFields, itemsRef, setItemsMap]);

  const bulkAddItems = useCallback(async (itemsArray) => {
    try {
      toast.loading(`Importando ${itemsArray.length} artículos...`, { id: 'bulk-add' });
      const results = await Promise.allSettled(
        itemsArray.map(async (item) => {
          const tableName = getTableName(item.category);
          if (!tableName) throw new Error("Table not found");
          const validColumns = getValidColumns(item.category);
          const fieldMappings = getFieldMappings(item.category);
          
          const { category: _cat, _tableName, id: _id, createdAt: _createdAt, created_at: _created_at, ...rawFields } = item;
          const initialItem = {
            ...rawFields,
            qty: parseInt(item.qty) || 0,
            threshold: parseInt(item.threshold) || 1,
            status: null,
          };

          const dbItem = mapToDbFields(initialItem, validColumns, fieldMappings);

          const created = await sbInsertItem(tableName, dbItem);
          if (created) return { ...created, category: item.category, _tableName: tableName };
          throw new Error("Insert returned null");
        })
      );
      
      const validItems = results
        .filter(r => r.status === 'fulfilled' && r.value)
        .map(r => r.value);
        
      setItemsMap(prev => {
        const nextMap = { ...prev };
        validItems.forEach(item => {
          nextMap[item.id] = item;
        });
        return nextMap;
      });
      
      if (validItems.length < itemsArray.length) {
        toast.warning(`Importación parcial: se añadieron ${validItems.length} de ${itemsArray.length} artículos.`, { id: 'bulk-add' });
      } else {
        toast.success(`Importación exitosa: ${validItems.length} artículos añadidos`, { id: 'bulk-add' });
      }
    } catch (err) {
      console.error('bulkAddItems error:', err);
      toast.error(`Error en importación: ${err.message}`, { id: 'bulk-add' });
    }
  }, [getTableName, getValidColumns, getFieldMappings, mapToDbFields, setItemsMap]);

  const deleteItemsByCategory = useCallback(async (category, userName = 'Sistema') => {
    try {
      const categoryItems = Object.values(itemsRef.current).filter(i => i.category === category);
      if (categoryItems.length === 0) {
        toast.info(`No hay artículos en la categoría: ${category}`);
        return;
      }

      toast.loading(`ELIMINANDO ${categoryItems.length} ARTÍCULOS...`, { id: 'category-delete' });

      const results = await Promise.allSettled(categoryItems.map(item => {
        const tableName = item._tableName || getTableName(item.category);
        return tableName ? sbDeleteItem(tableName, item.id) : Promise.resolve();
      }));

      const successfulItems = categoryItems.filter((_, i) => results[i].status === 'fulfilled');
      const successfulIds = new Set(successfulItems.map(i => i.id));
      setItemsMap(prev => {
        const nextMap = { ...prev };
        successfulIds.forEach(id => delete nextMap[id]);
        return nextMap;
      });
      
      await addMovement(
        'Eliminación Masiva', `Todo ${category}`, successfulItems.length,
        userName, `Se eliminaron ${successfulItems.length} elementos del apartado ${category}`, category
      );
      
      if (successfulItems.length < categoryItems.length) {
        toast.warning(`Se eliminaron solo ${successfulItems.length} de ${categoryItems.length} artículos.`, { id: 'category-delete' });
      } else {
        toast.success(`Se eliminaron ${categoryItems.length} artículos de ${category}`, { id: 'category-delete' });
      }
      return true;
    } catch (e) {
      console.error("Delete category error:", e);
      toast.error(`Error al eliminar categoría: ${e.message}`, { id: 'category-delete' });
      return false;
    }
  }, [addMovement, getTableName, itemsRef, setItemsMap]);

  const clearDatabaseCategories = useCallback(async (categoriesToClear, setMovementsState) => {
    try {
      toast.loading("LIMPIANDO ÁREAS SELECCIONADAS...", { id: 'clear-db' });

      const itemsToDelete = Object.values(itemsRef.current).filter(i => categoriesToClear.includes(i.category));
      const results = await Promise.allSettled(itemsToDelete.map(item => {
        const tableName = item._tableName || getTableName(item.category);
        return tableName ? sbDeleteItem(tableName, item.id) : Promise.resolve();
      }));

      const successfulItems = itemsToDelete.filter((_, i) => results[i].status === 'fulfilled');
      const successfulIds = new Set(successfulItems.map(i => i.id));
      const categoriesToClearSet = new Set(categoriesToClear);

      setItemsMap(prev => {
        const nextMap = { ...prev };
        successfulIds.forEach(id => delete nextMap[id]);
        return nextMap;
      });
      setMovementsState(prev => prev.filter(m => !categoriesToClearSet.has(m.category)));

      toast.success(`Mantenimiento completado: ${successfulItems.length} eliminados.`, { id: 'clear-db' });
      return true;
    } catch (e) {
      console.error("Clear DB error:", e);
      toast.error(`Error en mantenimiento: ${e.message}`, { id: 'clear-db' });
      return false;
    }
  }, [getTableName, itemsRef, setItemsMap]);

  const deleteItemsWithInvalidCategories = useCallback(async (validCategories, userName = 'Sistema') => {
    try {
      const validCategoriesSet = new Set(validCategories);
      const invalidItems = Object.values(itemsRef.current).filter(i => !validCategoriesSet.has(i.category));
      if (invalidItems.length === 0) {
        toast.info("No hay artículos con categorías inválidas");
        return false;
      }

      if (!window.confirm(`¿Eliminar ${invalidItems.length} artículos que no pertenecen a las categorías válidas? Esta acción es irreversible.`)) {
        return false;
      }

      toast.loading(`ELIMINANDO ${invalidItems.length} ARTÍCULOS INVÁLIDOS...`, { id: 'invalid-delete' });

      const results = await Promise.allSettled(invalidItems.map(item => {
        const tableName = item._tableName || getTableName(item.category);
        return tableName ? sbDeleteItem(tableName, item.id) : Promise.resolve();
      }));

      const successfulItems = invalidItems.filter((_, i) => results[i].status === 'fulfilled');
      const successfulIds = new Set(successfulItems.map(i => i.id));
      setItemsMap(prev => {
        const nextMap = { ...prev };
        successfulIds.forEach(id => delete nextMap[id]);
        return nextMap;
      });

      await addMovement(
        'Eliminación Masiva', 'Categorías Inválidas', successfulItems.length,
        userName, `Se eliminaron ${successfulItems.length} artículos con categorías antiguas/inválidas`, 'General'
      );

      toast.success(`Se eliminaron ${successfulItems.length} artículos con categorías inválidas`, { id: 'invalid-delete' });
      return true;
    } catch (e) {
      console.error("Delete invalid categories error:", e);
      toast.error(`Error al eliminar categorías inválidas: ${e.message}`, { id: 'invalid-delete' });
      return false;
    }
  }, [addMovement, getTableName, itemsRef, setItemsMap]);

  return {
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
  };
};
