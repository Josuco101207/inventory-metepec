/**
 * Utilidades puras para procesamiento de ítems y movimientos.
 */

// ─── Smart map generic fields to table-specific valid columns ───
export const mapToDbFields = (rawFields, validColumns, fieldMappings = {}) => {
  const dbFields = {};
  if (!validColumns || !Array.isArray(validColumns)) {
    Object.assign(dbFields, rawFields);
    return dbFields;
  }

  const safeColumns = validColumns.filter(c => typeof c === 'string');

  for (const key of Object.keys(rawFields)) {
    const mappedCol = fieldMappings[key];
    // Prioritize explicit mappings
    if (mappedCol && mappedCol !== key) {
      dbFields[mappedCol] = rawFields[key];
    } else if (safeColumns.length === 0 || safeColumns.includes(key)) {
      dbFields[key] = rawFields[key];
    }
  }
  return dbFields;
};

// ─── Enriquecer items con factura_url extraída de los movements ───
// Optimizado: Complejidad O(N + M) utilizando Hash Maps
export const enrichItemsWithFacturaUrl = (allItems, movements) => {
  // 1. O(M): Construir Hash Map de movimientos ligados a items
  const movementsByItemKey = new Map();

  for (const m of movements) {
    if (!m.details) continue;

    const idMatch = m.details.match(/item_id:([\w-]+)/);
    const keys = [];
    if (idMatch) keys.push(`id:${idMatch[1]}`);
    if (m.item) keys.push(`name:${m.item.toLowerCase().trim()}`);

    for (const k of keys) {
      if (!movementsByItemKey.has(k)) {
        movementsByItemKey.set(k, []);
      }
      movementsByItemKey.get(k).push(m);
    }
  }

  // 2. O(N): Enriquecer cada ítem en tiempo constante desde el Hash Map
  for (const item of allItems) {
    const itemInvoices = [];
    const invoiceUrls = new Set(); // Para prevenir duplicados rápidamente O(1)

    // Factura de compra original de la tabla del item (si tiene)
    if (item.factura_url) {
      itemInvoices.push({
        url: item.factura_url,
        type: 'Compra',
        label: 'Factura de Compra (Original)',
        timestamp: item.created_at || item.createdAt || null
      });
      invoiceUrls.add(item.factura_url);
    }

    const idKey = `id:${item.id}`;
    const nameKey = item.name ? `name:${item.name.toLowerCase().trim()}` : null;
    
    // Extraer y combinar movimientos de los Hash Maps
    const relatedMovements = [];
    if (movementsByItemKey.has(idKey)) {
      relatedMovements.push(...movementsByItemKey.get(idKey));
    }
    if (nameKey && movementsByItemKey.has(nameKey)) {
      relatedMovements.push(...movementsByItemKey.get(nameKey));
    }

    // Deduplicar movimientos por ID
    const uniqueMovements = [];
    const seenMovIds = new Set();
    for (const m of relatedMovements) {
      if (!seenMovIds.has(m.id)) {
        seenMovIds.add(m.id);
        uniqueMovements.push(m);
      }
    }
    
    // Ordenar del más reciente al más antiguo
    uniqueMovements.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Extraer facturas de los movimientos únicos
    for (const m of uniqueMovements) {
      if (m.details && (m.details.includes('factura_url:') || m.details.toLowerCase().includes('factura:'))) {
        const urlMatch = m.details.match(/(?:factura_url:|factura:\s*)(https?:\/\/\S+)/i);
        if (!urlMatch) continue;
        const url = urlMatch[1];

        if (!invoiceUrls.has(url)) {
          invoiceUrls.add(url);
          const isEntrada = m.action === 'Entrada' || m.action === 'Alta' || m.action === 'Devolución';
          const typeLabel = isEntrada ? 'Compra' : 'Salida';
          const folioMatch = m.details.match(/(?:Factura|Folio|id):\s*([\w-]+)/i);
          const folioStr = folioMatch ? ` - Folio: ${folioMatch[1]}` : '';
          const dateStr = new Date(m.timestamp).toLocaleDateString('es-MX');

          itemInvoices.push({
            url,
            type: m.action,
            label: `Factura de ${typeLabel} (${dateStr}${folioStr})`,
            timestamp: m.timestamp,
            user: m.user
          });
        }
      }
    }

    item.invoices = itemInvoices;

    // Respaldo en memoria: si no tiene factura_url, usar la primera de compra o cualquiera disponible
    if (!item.factura_url && itemInvoices.length > 0) {
      const purchaseInv = itemInvoices.find(inv => inv.type === 'Compra' || inv.type === 'Entrada' || inv.type === 'Alta');
      item.factura_url = purchaseInv ? purchaseInv.url : itemInvoices[0].url;
    }
  }

  return allItems;
};
