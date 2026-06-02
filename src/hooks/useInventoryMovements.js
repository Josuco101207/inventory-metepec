import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  insertMovement as sbInsertMovement,
  updateMovement as sbUpdateMovement,
} from '../storage/supabaseStorage';
import { addMovement as addLocalStorageMovement, updateMovement as updateLocalStorageMovement } from '../storage/localStorage';

export const useInventoryMovements = ({ itemsRef, setItemsState, sbUpdateItem, getTableName }) => {
  const [movements, setMovementsState] = useState([]);

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

      if (originalValues) {
        movementData.originalValues = originalValues;
        movementData.details = movementData.details ? `${movementData.details} | _originalValues:${JSON.stringify(originalValues)}` : `_originalValues:${JSON.stringify(originalValues)}`;
      }

      const { originalValues: _, ...dbMovementData } = movementData;

      const saved = await sbInsertMovement(dbMovementData);
      const finalMovement = saved || { ...movementData, id: Date.now().toString() + Math.random().toString(36).substr(2, 9) };

      addLocalStorageMovement(movementData);
      setMovementsState(prev => [finalMovement, ...prev]);
    } catch (e) {
      console.error("Error adding movement:", e);
    }
  }, [itemsRef]);

  const annulMovement = useCallback(async (movementId, adminName) => {
    setMovementsState(currentMovements => {
      const mov = currentMovements.find(m => m.id === movementId);
      if (!mov || mov.annulled) return currentMovements;

      const performAnnulment = async () => {
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
              const match = mov.details?.match(/Ajuste:\s*([+-]?\d+)/);
              if (match) {
                qtyChange = -parseInt(match[1]); 
              } else {
                console.warn('[annulMovement] Old audit without diff - cannot reverse stock automatically');
                toast.warning('Auditoría antigua: no se puede revertir el stock automáticamente. Solo se marcará como anulada.');
              }
            } else if (mov.action === 'Edición') {
              let origVals = mov.originalValues;
              if (!origVals && mov.details && mov.details.includes('_originalValues:')) {
                try {
                  const match = mov.details.match(/_originalValues:(.*)/);
                  if (match) origVals = JSON.parse(match[1]);
                } catch(e) { console.error('Failed to parse originalValues from details', e); }
              }
              if (origVals) {
                extraFields = { ...origVals };
              }
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

          const annulFields = { annulled: true };
          const sbUpdated = await sbUpdateMovement(movementId, annulFields);
          updateLocalStorageMovement(movementId, annulFields);

          setMovementsState(prev => prev.map(m => m.id === movementId ? (sbUpdated || { ...mov, ...annulFields }) : m));

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
      };

      performAnnulment();
      return currentMovements; // The actual state update will happen asynchronously via setMovementsState inside performAnnulment
    });
  }, [itemsRef, getTableName, setItemsState, sbUpdateItem, addMovement]);

  return { movements, setMovementsState, addMovement, annulMovement };
};
