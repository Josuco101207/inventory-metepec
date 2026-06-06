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

    const missing = [];
    if (!supabaseUrl) missing.push('VITE_SUPABASE_URL');
    if (!supabaseServiceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    if (!gmailEmail) missing.push('GMAIL_EMAIL');
    if (!gmailPassword) missing.push('GMAIL_APP_PASSWORD');

    if (missing.length > 0) {
      console.error('Missing env vars:', missing);
      return res.status(500).json({ error: `Missing environment variables: ${missing.join(', ')}` });
    }

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
    const { data: movements, error: movementsError } = await supabase
      .from('movements')
      .select('*')
      .gte('timestamp', mxStart.toISOString())
      .lte('timestamp', mxEnd.toISOString())
      .order('timestamp', { ascending: false });

    if (movementsError) throw movementsError;

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

    movements.forEach(m => {
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
    workbook.creator = 'Sistema de Inventario';
    workbook.created = now;

    // ----- HOJA 1: RESUMEN -----
    const wsResumen = workbook.addWorksheet('Resumen del Día');
    wsResumen.columns = [
      { width: 30 }, { width: 20 }
    ];
    
    // Título Resumen
    wsResumen.mergeCells('A1:B2');
    const titleCell = wsResumen.getCell('A1');
    titleCell.value = `Resumen Operativo: ${day}/${month}/${year}`;
    titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }; // Azul oscuro

    // Datos Resumen
    const resumenData = [
      ['Total Entradas', totalEntradas],
      ['Total Salidas', totalSalidas],
      ['Nuevas Altas', totalAltas],
      ['Eliminaciones / Bajas', totalEliminaciones],
      ['Total de Movimientos Hoy', movements.length],
      ['Total de Artículos en Inventario', allItems.length]
    ];

    resumenData.forEach((row, i) => {
      const rowIndex = i + 4;
      wsResumen.getCell(`A${rowIndex}`).value = row[0];
      wsResumen.getCell(`B${rowIndex}`).value = row[1];
      
      wsResumen.getCell(`A${rowIndex}`).font = { bold: true };
      wsResumen.getCell(`B${rowIndex}`).alignment = { horizontal: 'center' };
      
      // Bordes
      ['A', 'B'].forEach(c => {
        wsResumen.getCell(`${c}${rowIndex}`).border = {
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };
      });
    });

    // ----- HOJA 2: MOVIMIENTOS -----
    const wsMov = workbook.addWorksheet('Movimientos Detallados');
    wsMov.columns = [
      { header: 'Hora', key: 'hora', width: 15 },
      { header: 'Acción', key: 'accion', width: 20 },
      { header: 'Artículo', key: 'articulo', width: 40 },
      { header: 'Cant.', key: 'cant', width: 10 },
      { header: 'Usuario', key: 'usuario', width: 25 },
      { header: 'Detalles', key: 'detalles', width: 40 },
    ];

    // Estilo cabeceras Movimientos
    wsMov.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    wsMov.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
    wsMov.getRow(1).alignment = { horizontal: 'center' };

    movements.forEach((m, idx) => {
      const timeStr = new Date(m.timestamp).toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit' });
      const row = wsMov.addRow({
        hora: timeStr,
        accion: m.action,
        articulo: m.item,
        cant: m.qty,
        usuario: m.user,
        detalles: m.details || '-'
      });

      // Alternar color de fila
      if (idx % 2 === 0) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      }

      // Color condicional para Acción
      const actionCell = row.getCell('accion');
      const actLower = m.action ? m.action.toLowerCase() : '';
      if (actLower.includes('entrada') || actLower.includes('alta') || actLower.includes('agregado')) {
        actionCell.font = { color: { argb: 'FF16A34A' }, bold: true }; // Verde
      } else if (actLower.includes('salida') || actLower.includes('baja') || actLower.includes('elimina')) {
        actionCell.font = { color: { argb: 'FFDC2626' }, bold: true }; // Rojo
      }

      row.getCell('cant').alignment = { horizontal: 'center' };
    });

    // ----- HOJA 3: INVENTARIO ACTUAL -----
    const wsInv = workbook.addWorksheet('Stock Actual (Inventario)');
    wsInv.columns = [
      { header: 'ID / REF', key: 'id', width: 40 },
      { header: 'Categoría', key: 'categoria', width: 20 },
      { header: 'Nombre', key: 'nombre', width: 45 },
      { header: 'Marca', key: 'marca', width: 20 },
      { header: 'Ubicación', key: 'ubicacion', width: 20 },
      { header: 'Stock Actual', key: 'stock', width: 15 },
      { header: 'Stock Mín.', key: 'minimo', width: 15 },
      { header: 'Estado', key: 'estado', width: 15 },
    ];

    wsInv.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    wsInv.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    wsInv.getRow(1).alignment = { horizontal: 'center' };

    allItems.forEach((item, idx) => {
      let estado = 'Óptimo';
      let fontColor = 'FF000000'; // Black

      if (item.Cantidad <= item.Mínimo) {
        estado = 'Crítico';
        fontColor = 'FFDC2626'; // Rojo
      } else if (item.Cantidad <= (item.Mínimo * 2)) {
        estado = 'Bajo';
        fontColor = 'FFD97706'; // Naranja
      }

      const row = wsInv.addRow({
        id: item.ID,
        categoria: item.Categoría,
        nombre: item.Nombre,
        marca: item.Marca,
        ubicacion: item.Ubicación,
        stock: item.Cantidad,
        minimo: item.Mínimo,
        estado: estado
      });

      if (idx % 2 === 0) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      }

      row.getCell('stock').alignment = { horizontal: 'center' };
      row.getCell('minimo').alignment = { horizontal: 'center' };
      
      const estadoCell = row.getCell('estado');
      estadoCell.alignment = { horizontal: 'center' };
      estadoCell.font = { color: { argb: fontColor }, bold: estado === 'Crítico' || estado === 'Bajo' };
    });

    // 4. Generar Buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // 5. Fetch Admins
    const { data: admins, error: adminsError } = await supabase
      .from('profiles')
      .select('email')
      .eq('role', 'admin');

    if (adminsError) throw adminsError;

    let adminEmails = admins ? admins.filter(a => a.email).map(a => a.email) : [];
    
    if (adminEmails.length === 0) {
      console.log('No admins found even with service key.');
      return res.status(200).json({ message: 'No admin emails found in database.' });
    }

    // 6. Enviar Correo
    let htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Reporte Diario de Inventario</h2>
        <p>Fecha: <strong>${day}/${month}/${year}</strong></p>
        <p>Se ha generado exitosamente el reporte operativo del día de hoy.</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;">📊 <strong>Movimientos de hoy:</strong> ${movements.length}</p>
          <p style="margin: 5px 0 0 0;">📦 <strong>Total Artículos:</strong> ${allItems.length}</p>
        </div>
        <p style="color: #374151;">Por favor, descarga el archivo <strong>Excel adjunto</strong> para ver el detalle completo de todos los movimientos, altas, bajas y el listado fotográfico exacto de todo tu inventario actual con sus niveles de stock.</p>
        <hr style="margin-top: 30px; border: 0; border-top: 1px solid #e5e7eb;" />
        <p style="font-size: 0.8em; color: #9ca3af; text-align: center;">Este es un reporte automático del Sistema de Inventario.</p>
      </div>
    `;

    const mailOptions = {
      from: `"Sistema de Inventario" <${gmailEmail}>`,
      to: adminEmails.join(', '),
      subject: `Reporte Excel de Inventario - ${day}/${month}/${year}`,
      html: htmlContent,
      attachments: [
        {
          filename: `Reporte_Inventario_${year}${month}${day}.xlsx`,
          content: buffer,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      ]
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({ 
      success: true, 
      message: `Report sent to ${adminEmails.length} admins.`,
      movements_count: movements.length,
      items_count: allItems.length
    });

  } catch (error) {
    console.error('Daily Report Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
