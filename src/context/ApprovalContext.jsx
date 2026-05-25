import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

const ApprovalContext = createContext(null);

export const useApproval = () => {
  const ctx = useContext(ApprovalContext);
  if (!ctx) throw new Error('useApproval must be used within ApprovalProvider');
  return ctx;
};

export const APPROVAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  COMPLETED: 'completed'
};

// ─── FUNCIÓN PARA ENVIAR EMAIL DE APROBACIÓN ───
const sendApprovalEmail = async (supervisorEmail, supervisorName, requester, request, motivo) => {
  const resendApiKey = import.meta.env.VITE_RESEND_API_KEY;
  const emailFrom = import.meta.env.VITE_EMAIL_FROM || 'noreply@dicrejart.com';
  const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;

  if (!resendApiKey) {
    console.warn('[Approval] No RESEND_API_KEY configured, skipping email');
    return;
  }

  const approveUrl = `${appUrl}/approve/${request.id}`;
  const rejectUrl = `${appUrl}/reject/${request.id}`;

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Solicitud de Aprobación</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; margin: 10px 5px; font-weight: bold; }
        .button-reject { background: #ef4444; }
        .info-box { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #667eea; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 style="margin: 0; font-size: 24px;">🔔 Nueva Solicitud de Aprobación</h1>
      </div>
      <div class="content">
        <p>Hola <strong>${supervisorName}</strong>,</p>
        <p>Tienes una nueva solicitud de aprobación para una salida de inventario:</p>
        
        <div class="info-box">
          <p><strong>Solicitante:</strong> ${requester.user_metadata?.name || requester.email}</p>
          <p><strong>Email:</strong> ${requester.email}</p>
          <p><strong>Motivo:</strong> ${motivo || 'Salida de inventario'}</p>
          <p><strong>Fecha:</strong> ${new Date(request.requested_at).toLocaleString('es-MX')}</p>
          <p><strong>Expira:</strong> ${new Date(request.timeout_at).toLocaleString('es-MX')}</p>
        </div>

        <p>Por favor, revisa y toma una acción:</p>
        <div style="text-align: center;">
          <a href="${approveUrl}" class="button">✅ Aprobar</a>
          <a href="${rejectUrl}" class="button button-reject">❌ Rechazar</a>
        </div>

        <p style="font-size: 12px; color: #666; margin-top: 20px;">
          Si los botones no funcionan, copia y pega estos enlaces:<br>
          Aprobar: ${approveUrl}<br>
          Rechazar: ${rejectUrl}
        </p>
      </div>
    </body>
    </html>
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: emailFrom,
        to: supervisorEmail,
        subject: 'Nueva solicitud de aprobación de salida',
        html: emailHtml,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error enviando email');
    }

    const data = await response.json();
    console.log('[Approval] Email sent successfully:', data);
    return data;
  } catch (error) {
    console.error('[Approval] Error sending email:', error);
    throw error;
  }
};

export const ApprovalProvider = ({ children }) => {
  const [requests, setRequests] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pollingActive, setPollingActive] = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState(null);

  // ─── Cargar supervisores disponibles ───
  const fetchSupervisors = useCallback(async () => {
    try {
      setLoading(true);
      
      // Consultar directamente la tabla profiles (sin Edge Functions por ahora)
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, email, role')
        .in('role', ['admin', 'supervisor'])
        .order('role', { ascending: false })
        .order('name', { ascending: true });
      
      if (profilesError) {
        console.error('[Approval] Error fetching profiles:', profilesError);
        throw profilesError;
      }
      
      const supervisors = profiles || [];
      console.log('[Approval] Supervisores cargados:', supervisors.length, supervisors);
      setSupervisors(supervisors);
      return supervisors;
    } catch (err) {
      console.error('[Approval] Error fetching supervisors:', err);
      setError(err.message);
      toast.error('Error al cargar supervisores', {
        description: err.message
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Crear solicitud de aprobación ───
  const createApprovalRequest = useCallback(async (movementId, supervisorId, options = {}) => {
    try {
      setLoading(true);
      setError(null);

      // Crear solicitud directamente en la base de datos (sin Edge Function)
      const timeoutAt = new Date(Date.now() + (options.timeoutMinutes || 30) * 60 * 1000).toISOString();
      
      // Obtener información del usuario actual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      // Obtener información del supervisor
      const { data: supervisor, error: supervisorError } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('id', supervisorId)
        .single();

      if (supervisorError || !supervisor) {
        throw new Error('Supervisor no encontrado');
      }

      // Generar un UUID válido si movementId no es válido
      const validMovementId = movementId?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) 
        ? movementId 
        : crypto.randomUUID();

      // Crear la solicitud en approval_requests
      const { data: request, error: requestError } = await supabase
        .from('approval_requests')
        .insert({
          movement_id: validMovementId,
          requester_id: user.id,
          supervisor_id: supervisorId,
          status: 'pending',
          requested_at: new Date().toISOString(),
          timeout_at: timeoutAt,
          notification_method: options.notificationMethod || 'email',
          notification_status: 'pending',
          metadata: {
            requester_email: user.email,
            requester_name: user.user_metadata?.name || user.email,
            supervisor_email: supervisor.email,
            supervisor_name: supervisor.name,
            temp_movement_id: movementId,
            motivo: options.reason || 'Salida de inventario'
          }
        })
        .select()
        .single();

      if (requestError) throw requestError;

      setCurrentRequestId(request.id);
      setRequests(prev => [request, ...prev]);
      
      // Enviar email al supervisor
      try {
        await sendApprovalEmail(
          supervisor.email, 
          supervisor.name, 
          user, 
          request, 
          options.reason || options.motivo || 'Salida de inventario'
        );
        
        // Actualizar estado de notificación
        await supabase
          .from('approval_requests')
          .update({ notification_status: 'sent' })
          .eq('id', request.id);
          
        toast.success('Solicitud de aprobación enviada', {
          description: `Email enviado a ${supervisor.name}`
        });
      } catch (emailError) {
        console.warn('[Approval] Error sending email:', emailError);
        await supabase
          .from('approval_requests')
          .update({ notification_status: 'failed' })
          .eq('id', request.id);
          
        toast.success('Solicitud de aprobación creada', {
          description: `Pero el email no pudo enviarse. Contacta a ${supervisor.name} directamente.`
        });
      }

      return request;
    } catch (err) {
      console.error('[Approval] Error creating request:', err);
      setError(err.message);
      toast.error('Error al crear solicitud', {
        description: err.message
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Verificar estado de solicitud ───
  const checkRequestStatus = useCallback(async (requestId) => {
    try {
      // Consultar directamente la base de datos
      const { data: request, error } = await supabase
        .from('approval_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (error) throw error;
      if (!request) return null;

      // Verificar si expiró
      let status = request.status;
      if (status === APPROVAL_STATUS.PENDING && new Date(request.timeout_at) < new Date()) {
        // Actualizar a expirada
        await supabase
          .from('approval_requests')
          .update({ 
            status: 'expired', 
            completed_at: new Date().toISOString(),
            notification_status: 'expired'
          })
          .eq('id', requestId);
        
        status = 'expired';
      }

      const updatedRequest = { ...request, status };

      // Actualizar el request en el estado local
      setRequests(prev => prev.map(req => 
        req.id === requestId ? updatedRequest : req
      ));

      // Si el estado cambió, mostrar notificación
      if (status !== APPROVAL_STATUS.PENDING) {
        if (status === APPROVAL_STATUS.APPROVED) {
          toast.success('Solicitud aprobada', {
            description: 'Ya puedes completar la salida'
          });
        } else if (status === APPROVAL_STATUS.REJECTED) {
          toast.error('Solicitud rechazada', {
            description: request.rejection_reason || 'Sin especificar'
          });
        } else if (status === APPROVAL_STATUS.EXPIRED) {
          toast.warning('Solicitud expirada', {
            description: 'El tiempo de aprobación ha terminado'
          });
        }
        setPollingActive(false);
      }

      return updatedRequest;
    } catch (err) {
      console.error('[Approval] Error checking status:', err);
      return null;
    }
  }, []);

  // ─── Aprobar solicitud (para supervisores) ───
  const approveRequest = useCallback(async (requestId, notes = '') => {
    try {
      setLoading(true);

      // Obtener usuario actual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      // Obtener la solicitud
      const { data: request, error: requestError } = await supabase
        .from('approval_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (requestError || !request) throw new Error('Solicitud no encontrada');

      // Verificar que esté pendiente
      if (request.status !== 'pending') {
        throw new Error('La solicitud ya fue procesada');
      }

      // Verificar que no haya expirado
      if (new Date(request.timeout_at) < new Date()) {
        throw new Error('La solicitud ha expirado');
      }

      // Actualizar la solicitud
      const { data: updatedRequest, error: updateError } = await supabase
        .from('approval_requests')
        .update({
          status: 'approved',
          completed_at: new Date().toISOString(),
          rejection_reason: notes,
          metadata: {
            ...request.metadata,
            approved_by: user.id,
            approved_at: new Date().toISOString()
          }
        })
        .eq('id', requestId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Actualizar el movimiento
      await supabase
        .from('movements')
        .update({
          approval_status: 'approved',
          supervisor_id: user.id,
          approval_completed_at: new Date().toISOString(),
          approval_notes: notes
        })
        .eq('id', request.movement_id);

      setRequests(prev => prev.map(req => 
        req.id === requestId ? updatedRequest : req
      ));
      
      toast.success('Solicitud aprobada exitosamente');
      return updatedRequest;
    } catch (err) {
      console.error('[Approval] Error approving request:', err);
      toast.error('Error al aprobar solicitud', {
        description: err.message
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Rechazar solicitud (para supervisores) ───
  const rejectRequest = useCallback(async (requestId, reason) => {
    try {
      setLoading(true);

      // Obtener usuario actual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      // Obtener la solicitud
      const { data: request, error: requestError } = await supabase
        .from('approval_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (requestError || !request) throw new Error('Solicitud no encontrada');

      // Verificar que esté pendiente
      if (request.status !== 'pending') {
        throw new Error('La solicitud ya fue procesada');
      }

      if (!reason || reason.trim().length === 0) {
        throw new Error('El motivo de rechazo es requerido');
      }

      // Actualizar la solicitud
      const { data: updatedRequest, error: updateError } = await supabase
        .from('approval_requests')
        .update({
          status: 'rejected',
          completed_at: new Date().toISOString(),
          rejection_reason: reason.trim(),
          metadata: {
            ...request.metadata,
            rejected_by: user.id,
            rejected_at: new Date().toISOString()
          }
        })
        .eq('id', requestId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Actualizar el movimiento
      await supabase
        .from('movements')
        .update({
          approval_status: 'rejected',
          supervisor_id: user.id,
          approval_completed_at: new Date().toISOString(),
          approval_notes: reason.trim()
        })
        .eq('id', request.movement_id);

      setRequests(prev => prev.map(req => 
        req.id === requestId ? updatedRequest : req
      ));
      
      toast.success('Solicitud rechazada');
      return updatedRequest;
    } catch (err) {
      console.error('[Approval] Error rejecting request:', err);
      toast.error('Error al rechazar solicitud', {
        description: err.message
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Polling inteligente para verificar estado ───
  const startPolling = useCallback((requestId, intervalMs = 5000) => {
    if (pollingActive) return;
    
    setPollingActive(true);
    setCurrentRequestId(requestId);
    
    let pollInterval = intervalMs;
    const poll = async () => {
      const request = await checkRequestStatus(requestId);
      
      if (request && request.status !== APPROVAL_STATUS.PENDING) {
        setPollingActive(false);
        return;
      }

      // Backoff exponencial: aumentar intervalo gradualmente
      pollInterval = Math.min(pollInterval * 1.5, 30000); // Máximo 30s
      
      if (pollingActive) {
        setTimeout(poll, pollInterval);
      }
    };

    poll();
  }, [pollingActive, checkRequestStatus]);

  const stopPolling = useCallback(() => {
    setPollingActive(false);
    setCurrentRequestId(null);
  }, []);

  // ─── Obtener solicitudes del usuario actual ───
  const fetchMyRequests = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('approval_requests')
        .select('*')
        .eq('requester_id', user.id)
        .order('requested_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setRequests(data || []);
      return data || [];
    } catch (err) {
      console.error('[Approval] Error fetching requests:', err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Limpiar estado ───
  const clearRequests = useCallback(() => {
    setRequests([]);
    setCurrentRequestId(null);
    stopPolling();
  }, [stopPolling]);

  // ─── Cargar supervisores al montar ───
  useEffect(() => {
    fetchSupervisors();
  }, [fetchSupervisors]);

  // ─── Limpiar polling al desmontar ───
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return (
    <ApprovalContext.Provider value={{
      requests,
      supervisors,
      loading,
      error,
      pollingActive,
      currentRequestId,
      fetchSupervisors,
      createApprovalRequest,
      checkRequestStatus,
      approveRequest,
      rejectRequest,
      startPolling,
      stopPolling,
      fetchMyRequests,
      clearRequests,
      APPROVAL_STATUS
    }}>
      {children}
    </ApprovalContext.Provider>
  );
};