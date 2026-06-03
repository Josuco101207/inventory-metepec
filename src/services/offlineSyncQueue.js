import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

const QUEUE_KEY = 'offline_mutations_queue';

export const getOfflineQueue = () => {
  try {
    const data = localStorage.getItem(QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const setOfflineQueue = (queue) => {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

export const addToQueue = (mutation) => {
  const queue = getOfflineQueue();
  queue.push({
    ...mutation,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString()
  });
  setOfflineQueue(queue);
  
  // Opcional: mostrar notificación o registrar un evento local
  console.log(`[OfflineQueue] Operación añadida a la cola (${mutation.type}):`, mutation);
};

export const removeFromQueue = (id) => {
  const queue = getOfflineQueue();
  setOfflineQueue(queue.filter(m => m.id !== id));
};

export const flushQueue = async () => {
  const queue = getOfflineQueue();
  if (queue.length === 0) return;

  console.log(`[OfflineQueue] Sincronizando ${queue.length} operaciones pendientes...`);
  toast.loading(`Sincronizando ${queue.length} operaciones offline...`, { id: 'offline-sync' });

  let successCount = 0;
  let failCount = 0;

  for (const mutation of queue) {
    try {
      if (mutation.type === 'UPDATE_ITEM') {
        const { tableName, itemId, updates } = mutation.payload;
        const { error } = await supabase.from(tableName).update(updates).eq('id', itemId);
        if (error) throw error;
      } else if (mutation.type === 'INSERT_MOVEMENT') {
        const { payload } = mutation;
        const { error } = await supabase.from('movements').insert([payload]);
        if (error) throw error;
      } else if (mutation.type === 'INSERT_ITEM') {
        const { tableName, item } = mutation.payload;
        const { error } = await supabase.from(tableName).insert([item]);
        if (error) throw error;
      }
      
      removeFromQueue(mutation.id);
      successCount++;
    } catch (err) {
      console.error(`[OfflineQueue] Error sincronizando operación ${mutation.id}:`, err);
      failCount++;
      // Si falla por validación de DB (ej. Constraint negativo), podríamos querer removerlo
      // o notificar al usuario. Por ahora, lo mantenemos en la cola si es un error de red, 
      // pero si es un 400/500 por regla de negocio, deberíamos descartarlo.
      if (err.code && err.code !== 'TypeError') {
         removeFromQueue(mutation.id);
         toast.error(`La operación offline de ${mutation.payload.itemId || 'registro'} falló en el servidor: ${err.message}`);
      }
    }
  }

  if (successCount > 0) {
    toast.success(`Se sincronizaron ${successCount} operaciones exitosamente.`, { id: 'offline-sync' });
  } else if (failCount > 0) {
    toast.error(`Falló la sincronización de ${failCount} operaciones.`, { id: 'offline-sync' });
  } else {
    toast.dismiss('offline-sync');
  }
};
