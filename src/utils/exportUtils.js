import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export const exportToExcel = async (data, filename, category = "General") => {
  if (!data || data.length === 0) return;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Reporte');

  // 1. Configuración de Título y Metadatos
  const now = new Date();
  
  // 1. Configuración de Título Estilo Banner (Negro y Naranja)
  worksheet.getRow(1).height = 40;
  worksheet.mergeCells('A1:H4'); // Espacio negro superior
  const topBanner = worksheet.getCell('A1');
  topBanner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
  
  // Botón "Volver" simulado o Texto
  const backBtn = worksheet.getCell('A2');
  backBtn.value = ' REPORTE GENERADO ';
  backBtn.font = { name: 'Arial Black', size: 14, color: { argb: 'FFFFFFFF' } };
  backBtn.alignment = { vertical: 'middle', horizontal: 'left' };

  // Banner de Título de Categoría (Naranja)
  worksheet.mergeCells('A5:C7');
  const catBanner = worksheet.getCell('A5');
  catBanner.value = category.toUpperCase();
  catBanner.font = { name: 'Arial Black', size: 24, color: { argb: 'FF000000' } };
  catBanner.alignment = { vertical: 'middle', horizontal: 'center' };
  catBanner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE67E22' } }; // Naranja Intenso
  catBanner.border = {
    top: {style:'medium'}, left: {style:'medium'}, bottom: {style:'medium'}, right: {style:'medium'}
  };

  // 2. Preparar Datos de la Tabla
  const cleanData = data.map(item => {
    const formattedDate = item.loanDate ? (item.loanDate.toDate ? item.loanDate.toDate().toLocaleString() : new Date(item.loanDate.seconds * 1000).toLocaleString()) : 'N/A';
    
    // Categoría específica
    switch (category) {
      case 'Herramientas':
        return {
          "Articulo": item.name || '',
          "Codigo": item.codigo || '-',
          "Marca": item.marca || '-',
          "Estado Fisico": item.estado || 'BUENO',
          "Status": item.status === 'Prestado' ? `Prestado a ${item.borrowedBy}` : 'En Almacen',
          "Ult. Mov.": formattedDate,
        };
      case 'Parques':
      case (category.startsWith('Parques') ? category : null):
        return {
          "Articulo": item.name || '',
          "Seccion": item.subcategory || '-',
          "Marca": item.marca || '-',
          "Stock": item.qty || 0,
          "Minimo": item.threshold || 0,
          "Estado": (item.qty || 0) <= (item.threshold || 0) ? 'CRITICO' : 'OK',
        };
      default:
        return {
          "Nombre": item.name || '',
          "Subcategoria": item.subcategory || '-',
          "Marca": item.marca || '-',
          "Stock": item.qty || 0,
          "Minimo": item.threshold || 0,
          "Estado": (item.qty || 0) <= (item.threshold || 0) ? 'BAJO' : 'OK',
        };
    }
  });

  // 3. Definir Columnas
  const columns = Object.keys(cleanData[0]).map(key => ({
    header: key.toUpperCase(),
    key: key,
    width: key === 'Articulo' || key === 'Nombre' ? 40 : 20
  }));
  worksheet.columns = columns;

  // Posicionar Tabla (Fila 9 para dejar espacio al banner)
  const startRow = 9;
  const tableHeaderRow = worksheet.getRow(startRow);
  tableHeaderRow.values = columns.map(c => c.header);
  tableHeaderRow.height = 25;
  
  tableHeaderRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FF000000' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }; // Blanco para el header interno
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'medium' }, left: { style: 'medium' }, bottom: { style: 'medium' }, right: { style: 'medium' }
    };
  });

  // 4. Agregar Filas con Estilo (Zebra Naranja suave)
  cleanData.forEach((item, index) => {
    const row = worksheet.addRow(item);
    row.height = 22;
    
    // Zebra Stripe Effect (Naranja muy suave)
    if (index % 2 === 0) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E0' } };
    }

    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCC6600' } },
        left: { style: 'thin', color: { argb: 'FFCC6600' } },
        bottom: { style: 'thin', color: { argb: 'FFCC6600' } },
        right: { style: 'thin', color: { argb: 'FFCC6600' } }
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      
      if (cell.value === 'CRITICO' || cell.value === 'BAJO' || cell.value === 'Agotado') {
        cell.font = { color: { argb: 'FFFF0000' }, bold: true };
      }
    });
  });

  // Auto-filtro
  worksheet.autoFilter = {
    from: { row: startRow, column: 1 },
    to: { row: startRow, column: columns.length }
  };

  // 5. Generar y Descargar
  const buffer = await workbook.xlsx.writeBuffer();
  
  // --- ADDING DASHBOARD SHEET ---
  const dashSheet = workbook.addWorksheet('Métricas');
  
  dashSheet.columns = [
    { header: 'Métrica', key: 'm', width: 30 },
    { header: 'Valor', key: 'v', width: 20 }
  ];

  // Estilo Header Métricas
  dashSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  dashSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF005432' } };

  // Datos del Dashboard con Fórmulas
  const totalRows = cleanData.length;
  dashSheet.addRows([
    ['Total de Artículos', totalRows],
    ['Artículos en Crítico', { formula: `COUNTIF(Reporte!F${startRow + 1}:F${startRow + totalRows}, "CRITICO")` }],
    ['Artículos con Stock Bajo', { formula: `COUNTIF(Reporte!F${startRow + 1}:F${startRow + totalRows}, "BAJO")` }],
    ['Artículos en Estado OK', { formula: `COUNTIF(Reporte!F${startRow + 1}:F${startRow + totalRows}, "OK")` }],
    ['% Disponibilidad', { formula: `(COUNTIF(Reporte!F${startRow + 1}:F${startRow + totalRows}, "OK") / ${totalRows})` }]
  ]);

  dashSheet.getCell('B6').numFmt = '0.00%';

  // Estilo de Bordes para Métricas
  dashSheet.eachRow((row) => {
    row.eachCell(cell => {
      cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
    });
  });

  const finalBuffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([finalBuffer]), `${filename}.xlsx`);
};

export const exportFullDatabase = async (items) => {
  const workbook = new ExcelJS.Workbook();
  const categories = [...new Set(items.map(i => i.category))];

  for (const cat of categories) {
    const catItems = items.filter(i => i.category === cat);
    const sheet = workbook.addWorksheet(cat.substring(0, 30));
    
    // Header
    const keys = Object.keys(catItems[0] || {});
    const headerRow = sheet.addRow(keys.map(k => k.toUpperCase()));
    headerRow.font = { bold: true };
    
    catItems.forEach(item => {
      sheet.addRow(keys.map(k => {
        const val = item[k];
        if (val && val.toDate) return val.toDate().toLocaleString();
        return val;
      }));
    });
    
    sheet.columns.forEach(col => { col.width = 25; });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `inventario_completo_${new Date().toLocaleDateString()}.xlsx`);
};

export const exportToCSV = (data, filename) => {
  if (!data || data.length === 0) return;
  const keys = Object.keys(data[0]);
  const csvRows = [keys.join(',')];
  for (const row of data) {
    csvRows.push(keys.map(k => `"${String(row[k] || '').replace(/"/g, '""')}"`).join(','));
  }
  saveAs(new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' }), `${filename}.csv`);
};
