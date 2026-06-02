import * as XLSX from 'xlsx';

/**
 * Mapeo de encabezados de Excel a campos de la base de datos Firestore.
 * Soporta variaciones con y sin dos puntos, mayúsculas/minúsculas.
 */
const HEADER_MAP = {
  // Generales
  'Nombre': 'name',
  'Herramienta': 'name',
  'Artículo': 'name',
  'Stock Actual': 'qty',
  'Existencia': 'qty',
  'Stock Mínimo': 'threshold',
  'Umbral': 'threshold',
  'Costo Unitario': 'costo_unitario',
  'Costo': 'costo_unitario',
  'Categoría': 'category',
  'Categoria': 'category',

  // Especiales de Herramientas (Basado en captura del usuario)
  'Codigo:': 'codigo',
  'Código:': 'codigo',
  'Codigo': 'codigo',
  'Código': 'codigo',
  'Modelo:': 'modelo',
  'Modelo': 'modelo',
  'Serie:': 'serie',
  'Serie': 'serie',
  'Marca': 'marca',
  'Marca:': 'marca',
  'Medida STD': 'medida_std',
  'Medida Milimetrico': 'medida_mm',
  'Medida MM': 'medida_mm',
  'Estado': 'estado',
  'Estado Físico': 'estado',
  'OBSERVACIONES': 'observaciones',
  'Observaciones': 'observaciones',
  
  // Nuevos campos detallados
  'Item Number': 'item_number',
  'Item': 'item_number',
  'Grupo': 'grupo',
  'Número de OC': 'oc_number',
  'OC': 'oc_number',
  'Última reparación': 'ultima_reparacion',
  'Ultima reparación': 'ultima_reparacion',
  'Costo de reparación': 'costo_reparacion',
  'Recuento de reparaciones': 'recuento_reparaciones',
  'Garantía': 'garantia',
  'Garantia': 'garantia',
  'Fecha de compra': 'fecha_compra',
  'Fin del periodo sin costo': 'fin_periodo_sin_costo',
  'Número de equipo': 'numero_equipo',
  'No. Equipo': 'numero_equipo',
  'Equipo': 'numero_equipo',
  'Generación': 'generacion',
  'Generacion': 'generacion',

  // Otros
  'Voltaje': 'voltaje',
  'Peso': 'peso',
  'Color': 'color',

  // Parques
  'PAQUETE': 'paquete',
  'Paquete': 'paquete',
  'No.': 'modelo', // Fallback para Bolas de Boliche
  'No': 'modelo',
  'PRESENTACION': 'presentacion',
  'Presentacion': 'presentacion',
  'Presentación': 'presentacion',
  'PIEZAS': 'qty',
  'Piezas': 'qty',
  'CANTIDAD': 'qty',
  'Cantidad': 'qty'
};

/**
 * Crea una "firma" única simplificada para detectar duplicados con errores tipográficos suaves.
 * Ejemplo: "Trupper" y "Truper" -> "truper"
 */
const getFuzzySignature = (str) => {
  if (!str) return '';
  return str.toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '') // Quitar todo lo que no sea letra o número
    .replace(/(.)\1+/g, '$1'); // Colapsar letras repetidas (pp -> p, ss -> s, etc)
};

/**
 * Procesa un archivo Excel y devuelve un array de objetos agrupados e inteligentes.
 */
export const processInventoryExcel = (file, currentCategory) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (jsonData.length === 0) {
          reject("El archivo Excel está vacío.");
          return;
        }

        // Mapa para agrupar (Key: Signature de Nombre + Signature de Modelo)
        const groupedItems = new Map();

        jsonData.forEach(row => {
          const rawItem = { category: currentCategory };
          
          Object.keys(row).forEach(excelHeader => {
            const cleanHeader = excelHeader.trim();
            const dbField = HEADER_MAP[cleanHeader];
            if (dbField) {
              rawItem[dbField] = row[excelHeader];
            }
          });

          if (!rawItem.name) return; // Saltar filas sin nombre

          // Crear firma para detectar duplicados/errores
          const nameSig = getFuzzySignature(rawItem.name);
          const modelSig = getFuzzySignature(rawItem.modelo || '');
          const signature = `${nameSig}_${modelSig}`;

          if (groupedItems.has(signature)) {
            // Ya existe: Sumamos cantidad
            const existing = groupedItems.get(signature);
            const addQty = parseInt(rawItem.qty) || 1; // Si no hay cantidad en Excel, asumimos que cada fila es 1 unidad
            existing.qty += addQty;
          } else {
            // Nuevo: Lo inicializamos
            rawItem.qty = parseInt(rawItem.qty) || 1;
            rawItem.threshold = parseInt(rawItem.threshold) || 1;
            rawItem.costo_unitario = parseFloat(rawItem.costo_unitario) || 0;
            
            groupedItems.set(signature, rawItem);
          }
        });

        // Convertir el Mapa de vuelta a un array limpio
        resolve(Array.from(groupedItems.values()));
      } catch (error) {
        reject("Error al procesar el archivo Excel: " + error.message);
      }
    };

    reader.onerror = (error) => reject("Error de lectura: " + error);
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Procesa un archivo Excel de Personal y devuelve un array de objetos listos para Firebase.
 */
export const processPersonnelExcel = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (jsonData.length === 0) {
          reject("El archivo Excel está vacío.");
          return;
        }

        const validPersonnel = [];
        const seenNames = new Set();

        const nameHeads = ['nombre', 'nombre completo', 'trabajador', 'empleado'];
        const idHeads = ['nómina', 'nomina', 'id', 'clave', 'no. trabajador', 'no. empleado'];

        jsonData.forEach(row => {
          let name = '';
          let employeeId = '';

          // Buscar columnas que coincidan usando minúsculas
          Object.keys(row).forEach(header => {
            const hLow = header.trim().toLowerCase();
            if (nameHeads.includes(hLow)) name = row[header];
            if (idHeads.includes(hLow)) employeeId = row[header];
          });

          // Fallback si no hay heads obvios: asume que la col 1 es nombre y la 2 es id si existe
          if (!name) {
             const keys = Object.keys(row);
             if (keys.length > 0) name = row[keys[0]];
             if (keys.length > 1 && !employeeId) employeeId = row[keys[1]];
          }

          if (name) {
            const cleanName = String(name).trim();
            // Evitar duplicados exactos
            if (!seenNames.has(cleanName)) {
              seenNames.add(cleanName);
              validPersonnel.push({
                name: cleanName,
                employeeId: String(employeeId).trim()
              });
            }
          }
        });

        resolve(validPersonnel);
      } catch (error) {
        reject("Error al procesar Excel de Personal: " + error.message);
      }
    };

    reader.onerror = (error) => reject("Error de lectura: " + error);
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Procesa un archivo Excel de Parques con MÚLTIPLES HOJAS.
 * Cada hoja se trata como una subcategoría (DULCES, LOCKERS, ELECTRONICOS, etc.)
 * Columnas esperadas: B=Nombre, C=PAQUETE, D=PRESENTACION, E=PIEZAS
 * Retorna un objeto { items: [...], summary: [...] }
 */
export const processParquesExcel = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        const allItems = [];
        const sheetSummary = [];

        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '', header: 1 });

          if (jsonData.length < 4) {
            sheetSummary.push({ sheet: sheetName, count: 0, skipped: true });
            return;
          }

          // Detectar headers dinámicamente
          let headerRowIndex = -1;
          let colMap = { name: 0, paquete: -1, presentacion: -1, piezas: -1 };

          // Palabras clave para buscar el encabezado
          const parkKeywords = ['PAQUETE', 'PRESENTACION', 'PIEZAS', 'CANTIDAD', 'NO.'];

          for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
            const row = jsonData[i];
            if (!row) continue;

            const foundHeaders = row.filter(cell =>
              cell && parkKeywords.includes(String(cell).trim().toUpperCase())
            );

            if (foundHeaders.length >= 1) {
              headerRowIndex = i;
              row.forEach((cell, colIdx) => {
                if (!cell) return;
                const cellStr = String(cell).trim().toUpperCase();
                if (cellStr === 'PAQUETE' || cellStr === 'NO.') colMap.paquete = colIdx;
                if (cellStr === 'PRESENTACION' || cellStr === 'PRESENTACIÓN') colMap.presentacion = colIdx;
                if (cellStr === 'PIEZAS' || cellStr === 'CANTIDAD') colMap.piezas = colIdx;
              });
              break;
            }
          }

          // Si no se encontró fila de encabezado, o la fila detectada es muy abajo, 
          // usamos un fallback inteligente (Asumimos que empieza después del título)
          if (headerRowIndex === -1) {
             headerRowIndex = 1; // Fila 2 usualmente
          }

          let sheetItemCount = 0;

          for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row) continue;

            const name = row[colMap.name];
            
            // Saltar si el nombre está vacío, es el título repetido o es un "Total"
            if (!name || String(name).trim() === '' || 
                String(name).trim().toUpperCase() === sheetName.toUpperCase() ||
                String(name).trim().toLowerCase() === 'total' ||
                String(name).trim().toLowerCase() === 'descripción') continue;

            const paqueteValue = colMap.paquete !== -1 ? parseInt(row[colMap.paquete]) : 0;
            const presentacionValue = colMap.presentacion !== -1 ? parseInt(row[colMap.presentacion]) : 0;
            const piezasValue = colMap.piezas !== -1 ? parseInt(row[colMap.piezas]) : 0;

            // Determinar unidad y cantidad base
            let finalQty = 0;
            let finalPPU = 1;
            let finalUnit = 'Piezas';

            if (paqueteValue > 0) {
              finalQty = paqueteValue;
              finalPPU = presentacionValue || 1;
              finalUnit = 'Paquetes';
            } else {
              finalQty = piezasValue || 0;
              finalPPU = 1;
              finalUnit = 'Piezas';
            }

            allItems.push({
              name: String(name).trim(),
              category: 'Parques',
              subcategory: sheetName.trim(),
              paquete: paqueteValue || 0,
              presentacion: presentacionValue || 0,
              qty: finalQty,
              unit: finalUnit,
              pieces_per_unit: finalPPU,
              threshold: 1,
              costo_unitario: 0
            });
            sheetItemCount++;
          }

          sheetSummary.push({ sheet: sheetName, count: sheetItemCount, skipped: false });
        });

        if (allItems.length === 0) {
          reject("No se encontraron artículos válidos en ninguna hoja del archivo.");
          return;
        }

        resolve({ items: allItems, summary: sheetSummary });
      } catch (error) {
        reject("Error al procesar el archivo Excel de Parques: " + error.message);
      }
    };

    reader.onerror = (error) => reject("Error de lectura: " + error);
    reader.readAsArrayBuffer(file);
  });
};
