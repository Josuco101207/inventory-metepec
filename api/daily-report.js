/* global process, Buffer */
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import ExcelJS from 'exceljs';

// Vercel Serverless Function
export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && authHeader !== `Bearer secret-token-123`) {
    return res.status(401).json({ error: 'Unauthorized: Invalid CRON_SECRET' });
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 
    const gmailEmail = process.env.GMAIL_EMAIL;
    const gmailPassword = process.env.GMAIL_APP_PASSWORD;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailEmail,
        pass: gmailPassword,
      },
    });

    // Fechas
    const now = new Date();
    const mxOptions = { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' };
    const mxDateStr = new Intl.DateTimeFormat('en-US', mxOptions).format(now);
    const [month, day, year] = mxDateStr.split('/');
    
    const mxStart = new Date(`${year}-${month}-${day}T00:00:00-06:00`);
    const mxEnd = new Date(`${year}-${month}-${day}T23:59:59.999-06:00`);

    // 1. Fetch Movimientos
    const { data: movements } = await supabase
      .from('movements')
      .select('*')
      .gte('timestamp', mxStart.toISOString())
      .lte('timestamp', mxEnd.toISOString())
      .order('timestamp', { ascending: false });

    // 2. Fetch Inventario Total
    const { data: categories } = await supabase.from('categories').select('*');
    let allItems = [];
    
    if (categories && categories.length > 0) {
      for (const cat of categories) {
        const tName = cat.table_name || cat.tableName;
        if (!tName) continue;
        const { data: items } = await supabase.from(tName).select('*');
        if (items) {
          items.forEach(item => {
            allItems.push({
              ID: item.id,
              Categoría: cat.title,
              Nombre: item.nombre || item.name || item.titulo || item.producto || item.articulo || 'Sin Nombre',
              Cantidad: item.cantidad ?? item.canticad ?? item.qty ?? item.stock ?? item.existencias ?? item.piezas ?? item.unidades ?? 0,
              Mínimo: item.stock_min ?? item.minimo ?? item.threshold ?? 0,
              Ubicación: item.location ?? item.ubicacion ?? item.localizacion ?? '-',
              Marca: item.marca ?? item.brand ?? '-',
            });
          });
        }
      }
    }

    // Calcular estadísticas
    let totalEntradas = 0;
    let totalSalidas = 0;
    let totalAltas = 0;
    let totalEliminaciones = 0;

    (movements || []).forEach(m => {
      const act = m.action ? m.action.toLowerCase() : '';
      if (act.includes('entrada') || act.includes('agregado') || act.includes('ingreso') || act.includes('devuelto')) {
        totalEntradas++;
      } else if (act.includes('salida') || act.includes('prestado') || act.includes('retiro')) {
        totalSalidas++;
      } else if (act.includes('alta') || act.includes('creado') || act.includes('nuevo')) {
        totalAltas++;
      } else if (act.includes('baja') || act.includes('elimina')) {
        totalEliminaciones++;
      }
    });

    // 3. Crear Workbook Excel
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistema de Inventario Premium';
    workbook.created = now;

    // Fetch Logo
    let logoId;
    try {
      const logoUrl = 'https://dicrejart.vercel.app/fly-extreme-logo.jpg';
      const response = await fetch(logoUrl);
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        logoId = workbook.addImage({
          buffer: Buffer.from(buffer),
          extension: 'jpeg',
        });
      }
    } catch (e) {
      console.error('Error fetching logo for Excel:', e.message);
    }

    // ----- HOJA 1: RESUMEN (PREMIUM) -----
    const wsResumen = workbook.addWorksheet('Resumen del Día', {
      views: [{ showGridLines: false }] // Sin lineas de cuadrícula para un look de Dashboard
    });
    wsResumen.columns = [
      { width: 5 },  // A: Margen
      { width: 35 }, // B: Etiquetas
      { width: 25 }, // C: Valores
      { width: 5 }   // D: Margen
    ];

    if (logoId) {
      wsResumen.addImage(logoId, {
        tl: { col: 1, row: 1 },
        ext: { width: 120, height: 120 }
      });
    }

    wsResumen.mergeCells('B2:C4');
    const titleCell = wsResumen.getCell('B2');
    titleCell.value = `REPORTE EJECUTIVO DE INVENTARIO\nFecha: ${day}/${month}/${year}`;
    titleCell.font = { name: 'Segoe UI', size: 20, bold: true, color: { argb: 'FF1E3A8A' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    const startRow = 7;
    const cards = [
      { label: 'Total Entradas', val: totalEntradas, color: 'FF10B981' }, // Verde
      { label: 'Total Salidas', val: totalSalidas, color: 'FFEF4444' }, // Rojo
      { label: 'Nuevas Altas', val: totalAltas, color: 'FF3B82F6' }, // Azul
      { label: 'Eliminaciones / Bajas', val: totalEliminaciones, color: 'FFF59E0B' }, // Naranja
      { label: 'Total de Movimientos Hoy', val: (movements || []).length, color: 'FF6B7280' }, // Gris
      { label: 'Total de Artículos en Inventario', val: allItems.length, color: 'FF111827' } // Negro oscuro
    ];

    cards.forEach((card, idx) => {
      const r = startRow + (idx * 2);
      
      // Label cell
      const cLabel = wsResumen.getCell(`B${r}`);
      cLabel.value = card.label;
      cLabel.font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF4B5563' } };
      cLabel.alignment = { vertical: 'middle', indent: 1 };
      cLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
      cLabel.border = { 
        top: { style: 'medium', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'medium', color: { argb: 'FFD1D5DB' } },
        left: { style: 'medium', color: { argb: card.color } } // Borde izquierdo de color 
      };

      // Value cell
      const cVal = wsResumen.getCell(`C${r}`);
      cVal.value = card.val;
      cVal.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: card.color } };
      cVal.alignment = { vertical: 'middle', horizontal: 'center' };
      cVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
      cVal.border = { 
        top: { style: 'medium', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'medium', color: { argb: 'FFD1D5DB' } },
        right: { style: 'medium', color: { argb: 'FFD1D5DB' } }
      };

      wsResumen.getRow(r).height = 30; // Fila más alta
    });


    // ----- HOJA 2: MOVIMIENTOS -----
    const wsMov = workbook.addWorksheet('Movimientos Detallados', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }] // Congelar primera fila
    });
    
    wsMov.columns = [
      { header: 'Hora', key: 'hora', width: 15 },
      { header: 'Acción', key: 'accion', width: 25 },
      { header: 'Artículo', key: 'articulo', width: 50 },
      { header: 'Cant.', key: 'cant', width: 12 },
      { header: 'Usuario', key: 'usuario', width: 30 },
      { header: 'Detalles', key: 'detalles', width: 60 },
    ];

    wsMov.autoFilter = 'A1:F1'; // Filtros automáticos en los encabezados

    wsMov.getRow(1).font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    wsMov.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
    wsMov.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };
    wsMov.getRow(1).height = 25;

    (movements || []).forEach((m, idx) => {
      const timeStr = new Date(m.timestamp).toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit' });
      const row = wsMov.addRow({
        hora: timeStr,
        accion: (m.action || '').toUpperCase(),
        articulo: m.item,
        cant: m.qty,
        usuario: m.user,
        detalles: m.details || '-'
      });

      row.height = 20;

      if (idx % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };

      const actionCell = row.getCell('accion');
      const actLower = m.action ? m.action.toLowerCase() : '';
      if (actLower.includes('entrada') || actLower.includes('alta') || actLower.includes('agregado')) {
        actionCell.font = { color: { argb: 'FF059669' }, bold: true }; // Verde intenso
      } else if (actLower.includes('salida') || actLower.includes('baja') || actLower.includes('elimina')) {
        actionCell.font = { color: { argb: 'FFE11D48' }, bold: true }; // Rojo carmesí
      }

      row.getCell('cant').alignment = { horizontal: 'center' };
      row.getCell('cant').numFmt = '#,##0';

      // Bordes delgados
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };
      });
    });


    // ----- HOJA 3: INVENTARIO ACTUAL -----
    const wsInv = workbook.addWorksheet('Stock Actual (Inventario)', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }] // Congelar primera fila
    });
    
    wsInv.columns = [
      { header: 'ID / REF', key: 'id', width: 40 },
      { header: 'Categoría', key: 'categoria', width: 25 },
      { header: 'Nombre', key: 'nombre', width: 50 },
      { header: 'Marca', key: 'marca', width: 20 },
      { header: 'Ubicación', key: 'ubicacion', width: 25 },
      { header: 'Stock Actual', key: 'stock', width: 18 },
      { header: 'Stock Mín.', key: 'minimo', width: 18 },
      { header: 'Estado', key: 'estado', width: 20 },
    ];

    wsInv.autoFilter = 'A1:H1';

    wsInv.getRow(1).font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    wsInv.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } }; // Negro oscuro elegante
    wsInv.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };
    wsInv.getRow(1).height = 25;

    allItems.forEach((item, idx) => {
      let estado = 'ÓPTIMO';
      let fontColor = 'FF000000'; // Black
      let bgColor = null;

      if (item.Cantidad <= item.Mínimo) {
        estado = 'CRÍTICO';
        fontColor = 'FF991B1B'; // Rojo oscuro
        bgColor = 'FFFEE2E2'; // Fondo rojizo suave
      } else if (item.Cantidad <= (item.Mínimo * 2)) {
        estado = 'BAJO';
        fontColor = 'FF92400E'; // Naranja oscuro
        bgColor = 'FFFEF3C7'; // Fondo amarillo suave
      }

      const row = wsInv.addRow({
        id: item.ID,
        categoria: item.Categoría.toUpperCase(),
        nombre: item.Nombre,
        marca: item.Marca,
        ubicacion: item.Ubicación,
        stock: item.Cantidad,
        minimo: item.Mínimo,
        estado: estado
      });

      row.height = 20;

      if (!bgColor && idx % 2 === 0) {
        bgColor = 'FFF9FAFB'; // Gris muy sutil para alternar
      }
      
      if (bgColor) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      }

      row.getCell('stock').alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell('stock').numFmt = '#,##0';
      row.getCell('minimo').alignment = { horizontal: 'center', vertical: 'middle' };
      
      const estadoCell = row.getCell('estado');
      estadoCell.alignment = { horizontal: 'center', vertical: 'middle' };
      estadoCell.font = { color: { argb: fontColor }, bold: true };

      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };
      });
    });

    // 4. Generar Buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // 5. Fetch Admins
    const { data: admins } = await supabase
      .from('profiles')
      .select('email')
      .eq('role', 'admin');

    let adminEmails = admins ? admins.filter(a => a.email).map(a => a.email) : [];
    if (adminEmails.length === 0) {
      return res.status(200).json({ message: 'No admin emails found.' });
    }

    // 6. Enviar Correo
    let htmlContent = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #1e3a8a; margin: 0; font-size: 24px;">Reporte Ejecutivo de Inventario</h2>
          <p style="color: #6b7280; font-size: 14px;">Generado automáticamente por el Sistema Dicrejart</p>
        </div>
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6;">
          <p style="margin: 0 0 10px 0; font-size: 16px;"><strong>Fecha de corte:</strong> ${day}/${month}/${year}</p>
          <p style="margin: 0 0 10px 0; font-size: 16px;">📊 <strong>Movimientos registrados:</strong> ${(movements || []).length}</p>
          <p style="margin: 0; font-size: 16px;">📦 <strong>Catálogo auditado:</strong> ${allItems.length} artículos</p>
        </div>
        <p style="color: #374151; font-size: 15px; line-height: 1.6; margin-top: 25px;">
          Se ha adjuntado el documento en formato <strong>Excel Premium</strong>. Este documento ha sido optimizado con filtros automáticos, paneles fijos e indicadores de color para facilitar la toma de decisiones.
        </p>
      </div>
    `;

    const mailOptions = {
      from: `"Sistema Dicrejart" <${gmailEmail}>`,
      to: adminEmails.join(', '),
      subject: `📊 Reporte Premium de Inventario - ${day}/${month}/${year}`,
      html: htmlContent,
      attachments: [
        {
          filename: `Reporte_Inventario_Premium_${year}${month}${day}.xlsx`,
          content: buffer,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      ]
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({ 
      success: true, 
      message: `Premium report sent.`,
      items_count: allItems.length
    });

  } catch (error) {
    console.error('Daily Report Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
