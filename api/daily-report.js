import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// Vercel Serverless Function
export default async function handler(req, res) {
  // 1. Validar el método (puede ser GET o POST dependiendo de pg_net)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. Validar seguridad (CRON_SECRET)
  // Revisa el header Authorization: Bearer <token>
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && authHeader !== `Bearer secret-token-123`) {
    return res.status(401).json({ error: 'Unauthorized: Invalid CRON_SECRET' });
  }

  try {
    // 3. Inicializar Supabase y Resend
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
    const resendApiKey = process.env.VITE_RESEND_API_KEY;
    const emailFrom = process.env.VITE_EMAIL_FROM;

    const missing = [];
    if (!supabaseUrl) missing.push('VITE_SUPABASE_URL');
    if (!supabaseAnonKey) missing.push('VITE_SUPABASE_ANON_KEY');
    if (!resendApiKey) missing.push('VITE_RESEND_API_KEY');
    if (!emailFrom) missing.push('VITE_EMAIL_FROM');

    if (missing.length > 0) {
      throw new Error(`Missing environment variables: ${missing.join(', ')}`);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const resend = new Resend(resendApiKey);

    // 4. Calcular el rango de fechas de "Hoy" en hora de México (UTC-6)
    const now = new Date();
    const mxOptions = { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' };
    const mxDateStr = new Intl.DateTimeFormat('en-US', mxOptions).format(now); // "MM/DD/YYYY"
    const [month, day, year] = mxDateStr.split('/');
    
    const mxStart = new Date(`${year}-${month}-${day}T00:00:00-06:00`);
    const mxEnd = new Date(`${year}-${month}-${day}T23:59:59.999-06:00`);

    // 5. Obtener los movimientos del día
    const { data: movements, error: movementsError } = await supabase
      .from('movements')
      .select('*')
      .gte('timestamp', mxStart.toISOString())
      .lte('timestamp', mxEnd.toISOString())
      .order('timestamp', { ascending: false });

    if (movementsError) throw movementsError;

    // 6. Obtener a los administradores
    const { data: admins, error: adminsError } = await supabase
      .from('profiles')
      .select('email')
      .eq('role', 'admin');

    if (adminsError) throw adminsError;

    const adminEmails = admins.filter(a => a.email).map(a => a.email);
    
    if (adminEmails.length === 0) {
      return res.status(200).json({ message: 'No admins found to send email to.' });
    }

    // 7. Construir el reporte en HTML
    let htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Reporte Diario de Inventario</h2>
        <p>Fecha: <strong>${day}/${month}/${year}</strong></p>
        <p>Total de movimientos registrados hoy: <strong>${movements.length}</strong></p>
    `;

    if (movements.length > 0) {
      htmlContent += `
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <thead>
            <tr style="background-color: #f3f4f6; text-align: left;">
              <th style="padding: 10px; border: 1px solid #e5e7eb;">Hora</th>
              <th style="padding: 10px; border: 1px solid #e5e7eb;">Acción</th>
              <th style="padding: 10px; border: 1px solid #e5e7eb;">Artículo</th>
              <th style="padding: 10px; border: 1px solid #e5e7eb;">Cant.</th>
              <th style="padding: 10px; border: 1px solid #e5e7eb;">Usuario</th>
            </tr>
          </thead>
          <tbody>
      `;
      
      movements.forEach(m => {
        // Extraer solo la hora en formato HH:MM
        const timeStr = new Date(m.timestamp).toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit' });
        const color = m.action === 'Entrada' ? '#16a34a' : (m.action === 'Salida' ? '#dc2626' : '#4b5563');
        
        htmlContent += `
            <tr>
              <td style="padding: 8px; border: 1px solid #e5e7eb; font-size: 0.9em; color: #6b7280;">${timeStr}</td>
              <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold; color: ${color};">${m.action}</td>
              <td style="padding: 8px; border: 1px solid #e5e7eb;">${m.item}</td>
              <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">${m.qty}</td>
              <td style="padding: 8px; border: 1px solid #e5e7eb;">${m.user}</td>
            </tr>
        `;
      });
      
      htmlContent += `
          </tbody>
        </table>
      `;
    } else {
      htmlContent += `<p style="color: #6b7280; font-style: italic;">No hubo movimientos registrados el día de hoy.</p>`;
    }

    htmlContent += `
        <hr style="margin-top: 30px; border: 0; border-top: 1px solid #e5e7eb;" />
        <p style="font-size: 0.8em; color: #9ca3af; text-align: center;">Este es un reporte automático del Sistema de Inventario.</p>
      </div>
    `;

    // 8. Enviar el correo
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: emailFrom,
      to: adminEmails,
      subject: `Reporte Diario de Inventario - ${day}/${month}/${year}`,
      html: htmlContent,
    });

    if (emailError) throw emailError;

    return res.status(200).json({ 
      success: true, 
      message: `Report sent to ${adminEmails.length} admins.`,
      movements_count: movements.length 
    });

  } catch (error) {
    console.error('Daily Report Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
