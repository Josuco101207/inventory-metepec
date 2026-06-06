import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

const ApprovalContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useApproval = () => {
  const ctx = useContext(ApprovalContext);
  if (!ctx) throw new Error('useApproval must be used within ApprovalProvider');
  return ctx;
};

// eslint-disable-next-line react-refresh/only-export-components
export const APPROVAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  COMPLETED: 'completed'
};

// ─── FUNCIÓN PARA ENVIAR EMAIL DE APROBACIÓN ───
// TODO: El envío de correos deberá moverse/mantenerse en una Edge Function de Supabase.
const sendApprovalEmail = async (supervisorEmail, supervisorName, requester, request, motivo) => {
  const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;

  const approveUrl = `${appUrl}/approve/${request.id}?token=${request.security_token}`;
  const rejectUrl = `${appUrl}/reject/${request.id}?token=${request.security_token}`;

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
          ${request.metadata?.item_name ? `<p><strong>Material:</strong> ${request.metadata.item_name}</p>` : ''}
          ${request.metadata?.quantity !== undefined ? `<p><strong>Cantidad:</strong> ${request.metadata.quantity} ${request.metadata.item_unit || ''}</p>` : ''}
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

  const sendWithRetry = async (url, options, maxRetries = 3) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const res = await fetch(url, options);
        if (res.ok) return res;
        // Si es el último intento o no es un error de red/500, lanzamos error
        if (i === maxRetries - 1 || res.status < 500) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP error ${res.status}`);
        }
      } catch (err) {
        if (i === maxRetries - 1) throw err;
        // Exponential backoff: 1s, 2s, 4s...
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
  };

  try {
    // Llamar a Edge Function de Supabase con reintentos
    const { data: { session } } = await supabase.auth.getSession();
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    const response = await sendWithRetry(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: supervisorEmail,
        subject: 'Nueva solicitud de aprobación de salida',
        html: emailHtml,
      }),
    });

    const data = await response.json();
    console.log('[Approval] Email sent successfully via Edge Function:', data);
    return data;
  } catch (error) {
    console.error('[Approval] Error sending email via Edge Function (after retries):', error);
    // No lanzar error para no bloquear la creación de la solicitud
    return { success: false, error: error.message };
  }
};

export const ApprovalProvider = ({ children }) => {
  const [requests, setRequests] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pollingActive, setPollingActive] = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState(null);
  const pollingRef = useRef({ active: false, requestId: null });

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
      setSupervisors(supervisors);
      return supervisors;
    } catch (err) {
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

      // Usar null temporalmente si es un ID temporal, para evitar error de Llave Foránea
      const validMovementId = movementId?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) 
        ? movementId 
        : null;

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
            motivo: options.reason || 'Salida de inventario',
            item_id: options.item?.id,
            item_name: options.item?.name,
            item_unit: options.item?.unit,
            quantity: options.qty
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

  // ─── Polling inteligente con backoff ───
  const startPolling = useCallback((requestId) => {
    if (pollingRef.current.active && pollingRef.current.requestId === requestId) return;
    
    if (pollingRef.current.timeoutId) clearTimeout(pollingRef.current.timeoutId);
    pollingRef.current = { active: true, requestId };
    setPollingActive(true);
    setCurrentRequestId(requestId);
    
    const poll = async () => {
      if (!pollingRef.current.active || pollingRef.current.requestId !== requestId) return;
      
      const request = await checkRequestStatus(requestId);
      
      if (request && request.status !== APPROVAL_STATUS.PENDING) {
        pollingRef.current.active = false;
        setPollingActive(false);
        return;
      }
      
      pollingRef.current.timeoutId = setTimeout(poll, 3000); // Check every 3 seconds
    };
    
    poll();
  }, [checkRequestStatus]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current.timeoutId) clearTimeout(pollingRef.current.timeoutId);
    pollingRef.current = { active: false, requestId: null };
    setPollingActive(false);
    setCurrentRequestId(null);
  }, []);

  useEffect(() => {
    return () => {
      if (pollingRef.current.timeoutId) clearTimeout(pollingRef.current.timeoutId);
    };
  }, []);

  // ─── Reactivar solicitud ───
  const reactivateRequest = useCallback(async (requestId) => {
    try {
      setLoading(true);
      
      const newTimeout = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      
      const { data: request, error } = await supabase
        .from('approval_requests')
        .update({
          status: 'pending',
          timeout_at: newTimeout,
          notification_status: 'pending'
        })
        .eq('id', requestId)
        .select()
        .single();
        
      if (error) throw error;
      
      setRequests(prev => prev.map(req => 
        req.id === requestId ? request : req
      ));
      
      toast.success('Solicitud reactivada', {
        description: 'El tiempo ha sido extendido por 30 minutos'
      });
      
      startPolling(requestId);
      return request;
    } catch (err) {
      console.error('[Approval] Error reactivating request:', err);
      toast.error('Error al reactivar solicitud', {
        description: err.message
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [startPolling]);

  // ─── Cancelar solicitud ───
  const cancelRequest = useCallback(async (requestId) => {
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('approval_requests')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString()
        })
        .eq('id', requestId);
        
      if (error) throw error;
      
      setRequests(prev => prev.map(req => 
        req.id === requestId ? { ...req, status: 'cancelled' } : req
      ));
      
      stopPolling();
      
      toast.success('Solicitud cancelada');
      return true;
    } catch (err) {
      console.error('[Approval] Error cancelling request:', err);
      toast.error('Error al cancelar solicitud', {
        description: err.message
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [stopPolling]);

  // ─── Obtener solicitudes del usuario ───
  const fetchUserRequests = useCallback(async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');
      
      const { data: requests, error } = await supabase
        .from('approval_requests')
        .select('*')
        .eq('requester_id', user.id)
        .order('requested_at', { ascending: false })
        .limit(20);
        
      if (error) throw error;
      
      setRequests(requests || []);
      return requests;
    } catch (err) {
      console.error('[Approval] Error fetching requests:', err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Obtener solicitudes para aprobar (para supervisores) ───
  const fetchPendingApprovals = useCallback(async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');
      
      const { data: requests, error } = await supabase
        .from('approval_requests')
        .select('*')
        .eq('supervisor_id', user.id)
        .eq('status', 'pending')
        .order('requested_at', { ascending: false });
        
      if (error) throw error;
      
      return requests || [];
    } catch (err) {
      console.error('[Approval] Error fetching pending approvals:', err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Aprobar solicitud (para supervisores) ───
  const approveRequest = useCallback(async (requestId, message = '') => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');
      
      // Obtener el registro actual directamente de Supabase para evitar stale closures en el estado local
      const { data: currentReq, error: fetchError } = await supabase
        .from('approval_requests')
        .select('metadata')
        .eq('id', requestId)
        .single();
        
      if (fetchError) throw fetchError;
      const currentMeta = currentReq?.metadata || {};

      const { data: request, error } = await supabase
        .from('approval_requests')
        .update({
          status: 'approved',
          completed_at: new Date().toISOString(),
          metadata: { ...currentMeta, approved_by: user.id, response_message: message, approved_at: new Date().toISOString() }
        })
        .eq('id', requestId)
        .select()
        .single();
        
      if (error) throw error;
      
      setRequests(prev => prev.map(req => 
        req.id === requestId ? request : req
      ));
      
      toast.success('Solicitud aprobada');
      return request;
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
  const rejectRequest = useCallback(async (requestId, reason = '') => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');
      
      // Obtener el registro actual directamente de Supabase para evitar stale closures en el estado local
      const { data: currentReq, error: fetchError } = await supabase
        .from('approval_requests')
        .select('metadata')
        .eq('id', requestId)
        .single();
        
      if (fetchError) throw fetchError;
      const currentMeta = currentReq?.metadata || {};

      const { data: request, error } = await supabase
        .from('approval_requests')
        .update({
          status: 'rejected',
          completed_at: new Date().toISOString(),
          rejection_reason: reason,
          metadata: { ...currentMeta, rejected_by: user.id, rejected_at: new Date().toISOString() }
        })
        .eq('id', requestId)
        .select()
        .single();
        
      if (error) throw error;
      
      setRequests(prev => prev.map(req => 
        req.id === requestId ? request : req
      ));
      
      toast.success('Solicitud rechazada');
      return request;
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

  // Cargar supervisores al montar el provider
  useEffect(() => {
    fetchSupervisors();
  }, [fetchSupervisors]);

  const value = useMemo(() => ({
    requests,
    supervisors,
    loading,
    error,
    pollingActive,
    currentRequestId,
    fetchSupervisors,
    createApprovalRequest,
    checkRequestStatus,
    startPolling,
    stopPolling,
    reactivateRequest,
    cancelRequest,
    fetchUserRequests,
    fetchPendingApprovals,
    approveRequest,
    rejectRequest
  }), [
    requests, supervisors, loading, error, pollingActive, currentRequestId,
    fetchSupervisors, createApprovalRequest, checkRequestStatus, startPolling,
    stopPolling, reactivateRequest, cancelRequest, fetchUserRequests,
    fetchPendingApprovals, approveRequest, rejectRequest
  ]);

  return (
    <ApprovalContext.Provider value={value}>
      {children}
    </ApprovalContext.Provider>
  );
};