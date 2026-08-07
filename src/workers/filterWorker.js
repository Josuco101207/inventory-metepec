/**
 * Worker para filtrar el inventario.
 */
self.onmessage = (e) => {
  try {
    const { items, searchTerm, categoryTitle, activeSubcategory, selectedBrand, selectedLocation, statusFilter } = e.data;

    if (!items || !Array.isArray(items)) {
      self.postMessage([]);
      return;
    }

    const searchLow = searchTerm ? searchTerm.toLowerCase().trim() : '';

    const filtered = [];
    for (let i = 0, len = items.length; i < len; i++) {
      const item = items[i];
      
      // Filtros por categoría
      if (item.category !== categoryTitle) continue;
      if (activeSubcategory !== 'TODAS') {
        if (activeSubcategory === 'GENERAL') {
          if (item.subcategory || item.subcategoria) continue;
        } else {
          if ((item.subcategory || item.subcategoria) !== activeSubcategory) continue;
        }
      }
      
      if (selectedBrand !== 'Todas' && item.marca !== selectedBrand) continue;
      if (selectedLocation !== 'Todas' && item.location !== selectedLocation) continue;
      if (statusFilter && item.status !== statusFilter) continue;
      
      // Búsqueda textual solo si hay término
      if (searchLow) {
        const match = (
          (item.name && item.name.toLowerCase().includes(searchLow)) || 
          (item.modelo && item.modelo.toLowerCase().includes(searchLow)) || 
          (item.marca && item.marca.toLowerCase().includes(searchLow)) || 
          (item.codigo && item.codigo.toLowerCase().includes(searchLow)) || 
          (item.item_number && String(item.item_number).includes(searchLow)) || 
          (item.serie && item.serie.toLowerCase().includes(searchLow)) ||
          (item.id && item.id.toLowerCase().includes(searchLow))
        );
        if (!match) continue;
      }
      
      filtered.push(item);
    }

    // Ordenar resultados
    const len = filtered.length;
    const keys = new Array(len);
    for (let i = 0; i < len; i++) {
      keys[i] = (filtered[i].name || '').trim().toLowerCase();
    }

    // Crear array de índices y ordenar por clave
    const indices = new Array(len);
    for (let i = 0; i < len; i++) indices[i] = i;
    
    indices.sort((a, b) => {
      if (keys[a] < keys[b]) return -1;
      if (keys[a] > keys[b]) return 1;
      return 0;
    });

    // Construir resultado ordenado (sin campos internos de Worker)
    const result = new Array(len);
    for (let i = 0; i < len; i++) {
      result[i] = filtered[indices[i]];
    }

    self.postMessage(result);
  } catch (error) {
    console.error('FilterWorker error:', error);
    self.postMessage({ error: error.message });
  }
};
