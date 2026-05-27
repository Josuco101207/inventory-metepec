import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

const STORAGE_KEY = 'dicrejart_salida_auth';
const AUTH_EXPIRY_MS = 15 * 60 * 1000; // 15 minutos de validez

const SalidaAuthContext = createContext(null);

export const useSalidaAuth = () => {
  const ctx = useContext(SalidaAuthContext);
  if (!ctx) throw new Error('useSalidaAuth must be used within SalidaAuthProvider');
  return ctx;
};

export const SALIDA_METHODS = {
  NONE: 'none',
  FACTURA: 'factura',
  SUPERVISOR: 'supervisor',
  APPROVAL: 'approval', // Nuevo método para flujo de aprobación
};

const EMPTY_STATE = {
  method: SALIDA_METHODS.NONE,
  facturaId: null,
  facturaUrl: null,
  autorizadoPor: null,
  autorizadoPorId: null,
  autorizadoAt: null,
  approvalId: null, // Nuevo campo para flujo de aprobación
  approvalStatus: null, // Estado de la aprobación
};

const isExpired = (timestamp) => {
  if (!timestamp) return true;
  return Date.now() - new Date(timestamp).getTime() > AUTH_EXPIRY_MS;
};

export const SalidaAuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState(EMPTY_STATE);

  // Cargar desde localStorage al montar, descartar si expiró
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.autorizadoAt && isExpired(parsed.autorizadoAt)) {
          localStorage.removeItem(STORAGE_KEY);
        } else if (parsed.method && parsed.method !== SALIDA_METHODS.NONE) {
          setAuthState(parsed);
        }
      }
    } catch (e) {
      console.error('[SalidaAuth] Error loading state:', e);
    }
  }, []);

  // Persistir cuando cambia
  useEffect(() => {
    try {
      if (authState.method === SALIDA_METHODS.NONE) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(authState));
      }
    } catch (e) {
      console.error('[SalidaAuth] Error saving state:', e);
    }
  }, [authState]);

  // Limpiar autorización
  const limpiarAuth = useCallback(() => {
    setAuthState(EMPTY_STATE);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Temporizador para invalidar automáticamente la sesión temporal expirada
  useEffect(() => {
    if (authState.method === SALIDA_METHODS.NONE || !authState.autorizadoAt) return;

    const timeSinceAuth = Date.now() - new Date(authState.autorizadoAt).getTime();
    const remainingTime = AUTH_EXPIRY_MS - timeSinceAuth;

    if (remainingTime <= 0) {
      limpiarAuth();
      return;
    }

    const timer = setTimeout(() => {
      limpiarAuth();
      toast.warning('Autorización temporal de salida expirada', {
        description: 'La sesión de salida ha expirado tras 15 minutos.'
      });
    }, remainingTime);

    return () => clearTimeout(timer);
  }, [authState.method, authState.autorizadoAt, limpiarAuth]);

  // Autorizar vía factura
  const autorizarConFactura = useCallback((facturaId, facturaUrl) => {
    setAuthState({
      method: SALIDA_METHODS.FACTURA,
      facturaId,
      facturaUrl,
      autorizadoPor: null,
      autorizadoPorId: null,
      autorizadoAt: new Date().toISOString(),
    });
  }, []);

  // Autorizar vía supervisor
  const autorizarConSupervisor = useCallback((supervisorName, supervisorId) => {
    setAuthState({
      method: SALIDA_METHODS.SUPERVISOR,
      facturaId: null,
      facturaUrl: null,
      autorizadoPor: supervisorName,
      autorizadoPorId: supervisorId,
      autorizadoAt: new Date().toISOString(),
    });
  }, []);

  // Autorizar vía aprobación (nuevo método)
  const autorizarConAprobacion = useCallback((approvalId, supervisorId, supervisorName) => {
    setAuthState({
      method: SALIDA_METHODS.APPROVAL,
      facturaId: null,
      facturaUrl: null,
      autorizadoPor: supervisorName,
      autorizadoPorId: supervisorId,
      autorizadoAt: new Date().toISOString(),
      approvalId: approvalId,
      approvalStatus: 'approved'
    });
  }, []);



  // Verificar si la autorización actual sigue vigente
  const isAutorizado = authState.method !== SALIDA_METHODS.NONE &&
    !isExpired(authState.autorizadoAt);

  // Construir el campo details enriquecido para el movimiento
  const buildAuthDetails = useCallback((motivoBase) => {
    if (!isAutorizado) return null;
    if (authState.method === SALIDA_METHODS.FACTURA) {
      return `${motivoBase} | factura_id:${authState.facturaId}${authState.facturaUrl ? ` | factura_url:${authState.facturaUrl}` : ''}`;
    }
    if (authState.method === SALIDA_METHODS.SUPERVISOR) {
      return `${motivoBase} | autorizado_por:${authState.autorizadoPor} | supervisor_id:${authState.autorizadoPorId}`;
    }
    if (authState.method === SALIDA_METHODS.APPROVAL) {
      return `${motivoBase} | approval_id:${authState.approvalId} | supervisor_id:${authState.autorizadoPorId} | autorizado_por:${authState.autorizadoPor}`;
    }
    return null;
  }, [isAutorizado, authState]);

  return (
    <SalidaAuthContext.Provider value={{
      authState,
      isAutorizado,
      autorizarConFactura,
      autorizarConSupervisor,
      autorizarConAprobacion,
      limpiarAuth,
      buildAuthDetails,
      SALIDA_METHODS,
    }}>
      {children}
    </SalidaAuthContext.Provider>
  );
};
