/**
 * Servicio de Notificaciones por Email
 * Proporciona funciones para enviar emails relacionados con el sistema de aprobaciones
 */

import { supabase } from '../lib/supabase';



// ─── PLANTILLAS DE EMAIL ───

const EMAIL_TEMPLATES = {
  approval_request: {
    subject: 'Nueva solicitud de aprobación de salida',
    html: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Solicitud de Aprobación</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin: 10px 5px; }
          .button-approve { background: #10b981; }
          .button-reject { background: #ef4444; }
          .info-box { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #667eea; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 24px;">🔔 Nueva Solicitud de Aprobación</h1>
          </div>
          <div class="content">
            <p>Hola <strong>${data.supervisorName}</strong>,</p>
            <p>Tienes una nueva solicitud de aprobación para una salida de inventario:</p>
            
            <div class="info-box">
              <p><strong>Solicitante:</strong> ${data.requesterName}</p>
              <p><strong>Email:</strong> ${data.requesterEmail}</p>
              <p><strong>Motivo:</strong> ${data.reason}</p>
              <p><strong>Fecha:</strong> ${new Date(data.requestedAt).toLocaleString('es-MX')}</p>
              <p><strong>Expira:</strong> ${new Date(data.timeoutAt).toLocaleString('es-MX')}</p>
            </div>

            <p>Por favor, revisa y toma una acción:</p>
            <div style="text-align: center;">
              <a href="${data.approveUrl}" class="button button-approve">✅ Aprobar</a>
              <a href="${data.rejectUrl}" class="button button-reject">❌ Rechazar</a>
            </div>

            <p style="font-size: 12px; color: #666; margin-top: 20px;">
              Si los botones no funcionan, copia y pega los siguientes enlaces en tu navegador:<br>
              Aprobar: ${data.approveUrl}<br>
              Rechazar: ${data.rejectUrl}
            </p>
          </div>
          <div class="footer">
            <p>Sistema de Inventario Dicrejart - Enviado automáticamente</p>
          </div>
        </div>
      </body>
      </html>
    `
  },

  approval_approved: {
    subject: '✅ Solicitud de aprobación aprobada',
    html: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Solicitud Aprobada</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .info-box { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #10b981; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 24px;">✅ Solicitud Aprobada</h1>
          </div>
          <div class="content">
            <p>¡Buenas noticias <strong>${data.requesterName}</strong>!</p>
            <p>Tu solicitud de aprobación ha sido <strong>aprobada</strong> por <strong>${data.supervisorName}</strong>.</p>
            
            <div class="info-box">
              <p><strong>Aprobado por:</strong> ${data.supervisorName}</p>
              <p><strong>Fecha de aprobación:</strong> ${new Date(data.approvedAt).toLocaleString('es-MX')}</p>
              <p><strong>Notas:</strong> ${data.notes || 'Sin notas adicionales'}</p>
            </div>

            <p>Ya puedes completar la salida de inventario solicitada.</p>
          </div>
          <div class="footer">
            <p>Sistema de Inventario Dicrejart - Enviado automáticamente</p>
          </div>
        </div>
      </body>
      </html>
    `
  },

  approval_rejected: {
    subject: '❌ Solicitud de aprobación rechazada',
    html: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Solicitud Rechazada</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .info-box { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #ef4444; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 24px;">❌ Solicitud Rechazada</h1>
          </div>
          <div class="content">
            <p>Hola <strong>${data.requesterName}</strong>,</p>
            <p>Tu solicitud de aprobación ha sido <strong>rechazada</strong> por <strong>${data.supervisorName}</strong>.</p>
            
            <div class="info-box">
              <p><strong>Rechazado por:</strong> ${data.supervisorName}</p>
              <p><strong>Fecha de rechazo:</strong> ${new Date(data.rejectedAt).toLocaleString('es-MX')}</p>
              <p><strong>Motivo:</strong> ${data.rejectionReason}</p>
            </div>

            <p>Si necesitas realizar esta salida, por favor crea una nueva solicitud o contacta al supervisor para más detalles.</p>
          </div>
          <div class="footer">
            <p>Sistema de Inventario Dicrejart - Enviado automáticamente</p>
          </div>
        </div>
      </body>
      </html>
    `
  },

  approval_expired: {
    subject: '⏰ Solicitud de aprobación expirada',
    html: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Solicitud Expirada</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .info-box { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #f59e0b; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 24px;">⏰ Solicitud Expirada</h1>
          </div>
          <div class="content">
            <p>Hola <strong>${data.requesterName}</strong>,</p>
            <p>Tu solicitud de aprobación ha <strong>expirado</strong> sin recibir respuesta.</p>
            
            <div class="info-box">
              <p><strong>Solicitado a:</strong> ${data.supervisorName}</p>
              <p><strong>Fecha de solicitud:</strong> ${new Date(data.requestedAt).toLocaleString('es-MX')}</p>
              <p><strong>Expiró:</strong> ${new Date(data.timeoutAt).toLocaleString('es-MX')}</p>
            </div>

            <p>Si aún necesitas realizar esta salida, por favor crea una nueva solicitud.</p>
          </div>
          <div class="footer">
            <p>Sistema de Inventario Dicrejart - Enviado automáticamente</p>
          </div>
        </div>
      </body>
      </html>
    `
  }
};

// ─── FUNCIÓN PARA GENERAR URLs DE APROBACIÓN ───

const generateApprovalUrls = (requestId, token) => {
  // En móvil (Capacitor), window.location.origin es http://localhost, así que debemos usar la variable de entorno
  const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;
  const tokenParam = token ? `?token=${token}` : '';
  return {
    approveUrl: `${baseUrl}/approve/${requestId}${tokenParam}`,
    rejectUrl: `${baseUrl}/reject/${requestId}${tokenParam}`
  };
};

// ─── FUNCIÓN PARA ENVIAR EMAIL (VIA EDGE FUNCTION) ───

export const sendEmail = async (to, template, data) => {
  try {
    const templateFn = EMAIL_TEMPLATES[template];
    if (!templateFn) {
      throw new Error(`Plantilla de email no encontrada: ${template}`);
    }

    const htmlContent = templateFn.html(data);
    
    // Llamar a Edge Function para enviar email
    const { data: response, error } = await supabase.functions.invoke('send-email', {
      body: {
        to,
        subject: templateFn.subject,
        html: htmlContent
      }
    });

    if (error) throw error;
    
    return { success: true, data: response };
  } catch (error) {
    console.error('[EmailService] Error sending email:', error);
    return { success: false, error: error.message };
  }
};

// ─── FUNCIONES ESPECÍFICAS PARA APROBACIONES ───

export const sendApprovalRequestEmail = async (supervisorEmail, supervisorName, requestData) => {
  const urls = generateApprovalUrls(requestData.id, requestData.security_token);
  
  return await sendEmail(supervisorEmail, 'approval_request', {
    supervisorName,
    requesterName: requestData.requesterName,
    requesterEmail: requestData.requesterEmail,
    reason: requestData.reason,
    requestedAt: requestData.requestedAt,
    timeoutAt: requestData.timeoutAt,
    approveUrl: urls.approveUrl,
    rejectUrl: urls.rejectUrl
  });
};

export const sendApprovalApprovedEmail = async (requesterEmail, requesterName, approvalData) => {
  return await sendEmail(requesterEmail, 'approval_approved', {
    requesterName,
    supervisorName: approvalData.supervisorName,
    approvedAt: approvalData.approvedAt,
    notes: approvalData.notes
  });
};

export const sendApprovalRejectedEmail = async (requesterEmail, requesterName, rejectionData) => {
  return await sendEmail(requesterEmail, 'approval_rejected', {
    requesterName,
    supervisorName: rejectionData.supervisorName,
    rejectedAt: rejectionData.rejectedAt,
    rejectionReason: rejectionData.rejectionReason
  });
};

export const sendApprovalExpiredEmail = async (requesterEmail, requesterName, expiryData) => {
  return await sendEmail(requesterEmail, 'approval_expired', {
    requesterName,
    supervisorName: expiryData.supervisorName,
    requestedAt: expiryData.requestedAt,
    timeoutAt: expiryData.timeoutAt
  });
};

// ─── FUNCIÓN SIMULADA PARA DESARROLLO (FALLBACK) ───

export const simulateEmailSend = async (to, subject, content) => {
  console.log('[EmailService - SIMULATION] Email would be sent:', {
    to,
    subject,
    timestamp: new Date().toISOString()
  });
  console.log('[EmailService - SIMULATION] Content preview:', content.substring(0, 200) + '...');
  
  return { 
    success: true, 
    simulated: true, 
    message: 'Email simulado (ver consola para detalles)' 
  };
};

export default {
  sendEmail,
  sendApprovalRequestEmail,
  sendApprovalApprovedEmail,
  sendApprovalRejectedEmail,
  sendApprovalExpiredEmail,
  simulateEmailSend,
  EMAIL_TEMPLATES
};