import React, { useState, useCallback, useEffect } from 'react';
import { X, RefreshCw, ArrowDownCircle, FileText, AlertCircle, ShieldCheck, Loader2, CheckCircle2, Eye, EyeOff, Lock, Clock, Send } from 'lucide-react';
import useIsMobile from '../hooks/useIsMobile';
import BottomSheet from './BottomSheet';
import { useSalidaAuth } from '../context/SalidaAuthContext';
import { useApproval } from '../context/ApprovalContext';
import { APPROVAL_STATUS } from '../context/ApprovalContext';
import { validateSupervisorCredentials } from '../storage/supabaseStorage';
import { toast } from 'sonner';
import SupervisorSelector from './SupervisorSelector';
import ApprovalStatusBadge from './ApprovalStatusBadge';
import './ActionModal.css';

// ─── Sub-panel: Autorización por Supervisor (Método Directo) ───────────────────
const SupervisorPanel = ({ onAuthorized }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleValidate = useCallback(async () => {
    if (!email.trim() || !password) { setError('Completa correo y contraseña.'); return; }
    setError('');
    setLoading(true);
    try {
      const result = await validateSupervisorCredentials(email.trim(), password);
      onAuthorized(result.name, result.id);
    } catch (err) {
      setError(err.message || 'Error al validar credenciales');
    } finally {
      setLoading(false);
    }
  }, [email, password, onAuthorized]);

  return (
    <div className="am-auth-panel">
      <div className="am-auth-panel-icon">
        <Lock size={22} />
      </div>
      <p className="am-auth-panel-title">Credenciales de Supervisor</p>
      <p className="am-auth-panel-sub">Solo usuarios con rol <strong>admin</strong> o <strong>supervisor</strong> pueden autorizar.</p>

      <div className="f-group" style={{ marginTop: '1rem' }}>
        <label>Correo del supervisor</label>
        <input
          type="email"
          className="f-input"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="supervisor@empresa.com"
          autoComplete="off"
          disabled={loading}
        />
      </div>

      <div className="f-group" style={{ marginTop: '0.75rem', position: 'relative' }}>
        <label>Contraseña</label>
        <div style={{ position: 'relative' }}>
          <input
            type={showPw ? 'text' : 'password'}
            className="f-input"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            disabled={loading}
            onKeyDown={e => e.key === 'Enter' && handleValidate()}
            style={{ paddingRight: '3rem' }}
          />
          <button
            type="button"
            onClick={() => setShowPw(v => !v)}
            style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}
          >
            {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {error && (
        <div className="am-auth-error">
          <AlertCircle size={13} /> {error}
        </div>
      )}

      <button
        className="btn-apple-primary"
        style={{ width: '100%', marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        onClick={handleValidate}
        disabled={loading || !email || !password}
      >
        {loading ? <><Loader2 size={16} className="am-spin" /> Verificando...</> : <><ShieldCheck size={16} /> Validar Autorización</>}
      </button>
    </div>
  );
};

// ─── Sub-panel: Selección de Supervisor (Nuevo Flujo de Aprobación) ─────────────
const SupervisorSelectionPanel = ({ onRequestCreated, currentRequest, motivo }) => {
  const { createApprovalRequest, loading } = useApproval();
  const [selectedSupervisorId, setSelectedSupervisorId] = useState(null);
  const [creating, setCreating] = useState(false);

  const handleCreateRequest = useCallback(async () => {
    if (!selectedSupervisorId) {
      toast.error('Selecciona un supervisor');
      return;
    }

    setCreating(true);
    try {
      // Crear movimiento temporal (esto debería venir del componente padre)
      const tempMovementId = `temp_${Date.now()}`;
      
      const request = await createApprovalRequest(tempMovementId, selectedSupervisorId, {
        notificationMethod: 'email',
        reason: motivo,
        timeoutMinutes: 30
      });

      if (request) {
        onRequestCreated(request);
        toast.success('Solicitud enviada al supervisor');
      }
    } catch (err) {
      console.error('Error creating request:', err);
    } finally {
      setCreating(false);
    }
  }, [selectedSupervisorId, createApprovalRequest, onRequestCreated]);

  if (currentRequest) {
    return (
      <div className="am-request-status">
        <ApprovalStatusBadge status={currentRequest.status} size="lg" />
        <div className="am-request-details">
          <p className="am-request-info">
            <Clock size={14} />
            Solicitado a: {currentRequest.metadata?.supervisor_name || 'Supervisor'}
          </p>
          {currentRequest.status === APPROVAL_STATUS.PENDING && (
            <p className="am-request-timeout">
              Expira: {new Date(currentRequest.timeout_at).toLocaleTimeString('es-MX', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          )}
          {currentRequest.status === APPROVAL_STATUS.REJECTED && currentRequest.rejection_reason && (
            <p className="am-request-rejection">
              Motivo: {currentRequest.rejection_reason}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="am-supervisor-selection">
      <div className="am-selection-header">
        <Send size={20} />
        <div>
          <p className="am-selection-title">Solicitar Autorización</p>
          <p className="am-selection-sub">Selecciona un supervisor para enviar solicitud de aprobación</p>
        </div>
      </div>

      <SupervisorSelector 
        onSelect={setSelectedSupervisorId}
        selectedId={selectedSupervisorId}
        disabled={creating}
      />

      <button
        className="btn-apple-primary"
        style={{ width: '100%', marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        onClick={handleCreateRequest}
        disabled={!selectedSupervisorId || creating || loading}
      >
        {creating ? <><Loader2 size={16} className="am-spin" /> Enviando...</> : <><Send size={16} /> Enviar Solicitud</>}
      </button>
    </div>
  );
};

// ─── Badge de autorización activa ─────────────────────────────────────────────
const AuthBadge = ({ authState, onClear, SALIDA_METHODS }) => (
  <div className="am-auth-badge">
    <CheckCircle2 size={16} />
    <span>
      {authState.method === SALIDA_METHODS.FACTURA
        ? `Factura vinculada`
        : `Autorizado por ${authState.autorizadoPor}`}
    </span>
    <button type="button" className="am-auth-badge-clear" onClick={onClear}>
      <X size={13} />
    </button>
  </div>
);

// ─── ActionModal principal ────────────────────────────────────────────────────
const ActionModal = ({ isOpen, onClose, item, onConfirm }) => {
  const { isMobile } = useIsMobile();
  const { authState, isAutorizado, autorizarConSupervisor, limpiarAuth, buildAuthDetails, SALIDA_METHODS } = useSalidaAuth();
  const { currentRequestId, startPolling, stopPolling } = useApproval();

  const [qty, setQty] = useState(1);
  const [motivo, setMotivo] = useState('');
  const [authMethod, setAuthMethod] = useState('direct'); // 'direct' | 'approval'
  const [currentRequest, setCurrentRequest] = useState(null);

  const parsedQty = parseInt(qty) || 0;
  const stockDisponible = item?.qty ?? 0;

  // Determinar si el formulario es válido
  const isValid =
    parsedQty > 0 &&
    parsedQty <= stockDisponible &&
    motivo.trim().length > 0 &&
    (authMethod === 'direct' ? isAutorizado : currentRequest?.status === APPROVAL_STATUS.APPROVED);

  // Manejar creación de solicitud
  const handleRequestCreated = useCallback((request) => {
    setCurrentRequest(request);
    startPolling(request.id);
  }, [startPolling]);

  // Manejar confirmación de salida
  const handleConfirm = useCallback(() => {
    if (!isValid) return;

    let authDetails;
    
    if (authMethod === 'direct') {
      // Validación de seguridad en cliente: bloquear si no hay autorización directa
      if (!authState.autorizadoPorId) {
        toast.error('Salida bloqueada: se requiere autorización de supervisor.');
        return;
      }
      authDetails = buildAuthDetails(`Motivo: ${motivo.trim()}`);
    } else {
      // Nuevo flujo: usar aprobación
      if (!currentRequest || currentRequest.status !== APPROVAL_STATUS.APPROVED) {
        toast.error('Salida bloqueada: la solicitud debe estar aprobada.');
        return;
      }
      authDetails = `Motivo: ${motivo.trim()} | approval_id:${currentRequest.id} | supervisor_id:${currentRequest.supervisor_id}`;
    }

    onConfirm(item.id, -parsedQty, authDetails);

    // Limpiar estado local
    setQty(1);
    setMotivo('');
    setCurrentRequest(null);
    limpiarAuth();
    stopPolling();
    onClose();
  }, [isValid, authMethod, authState, buildAuthDetails, motivo, parsedQty, item, onConfirm, limpiarAuth, onClose, currentRequest, stopPolling]);

  // Manejar cierre
  const handleClose = useCallback(() => {
    setQty(1);
    setMotivo('');
    setCurrentRequest(null);
    stopPolling();
    onClose();
  }, [onClose, stopPolling]);

  // Limpiar polling al desmontar
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  if (!isOpen || !item) return null;

  const content = (
    <div className="flex flex-col gap-6">

      {/* Info del artículo */}
      <div className="am-item-info">
        <ArrowDownCircle size={18} style={{ color: 'hsl(var(--danger))', flexShrink: 0 }} />
        <div>
          <span className="am-item-name">{item.name}</span>
          <span className="am-item-stock">Stock actual: <strong>{item.qty ?? '—'} {item.unit || 'pzas'}</strong></span>
        </div>
      </div>

      {/* Cantidad */}
      <div className="f-group">
        <label>Cantidad a retirar ({item?.unit || 'Piezas'})</label>
        <input
          type="number"
          className="f-input text-lg font-bold"
          value={qty}
          onChange={e => setQty(e.target.value)}
          placeholder="0"
          min={1}
          max={item.qty || 9999}
        />
        {parsedQty > stockDisponible && parsedQty > 0 && (
          <div className="am-warn"><AlertCircle size={13} /> Cantidad mayor al stock disponible ({stockDisponible} {item?.unit || 'pzas'}). Ajusta el valor.</div>
        )}
      </div>

      {/* Motivo */}
      <div className="f-group">
        <label><FileText size={13} style={{ marginRight: 5 }} />Motivo de salida <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
        <input
          type="text"
          className="f-input"
          value={motivo}
          onChange={e => setMotivo(e.target.value)}
          placeholder="Ej: obra norte, evento, consumo diario..."
          style={{ borderColor: motivo.trim().length === 0 ? 'hsl(var(--danger))' : undefined }}
        />
        {motivo.trim().length === 0 && (
          <div className="am-warn"><AlertCircle size={13} /> Campo obligatorio.</div>
        )}
      </div>

      {/* ── Sección de Autorización Obligatoria ── */}
      <div className="am-auth-section">
        <div className="am-auth-section-header">
          <ShieldCheck size={15} />
          <span>Autorización de supervisor</span>
          {(!isAutorizado && authMethod === 'direct') && <span className="am-auth-required-badge">REQUERIDA</span>}
        </div>

        {/* Selector de método de autorización */}
        <div className="am-method-selector">
          <button
            className={`am-method-btn ${authMethod === 'direct' ? 'active' : ''}`}
            onClick={() => setAuthMethod('direct')}
          >
            <Lock size={14} />
            Credenciales Directas
          </button>
          <button
            className={`am-method-btn ${authMethod === 'approval' ? 'active' : ''}`}
            onClick={() => setAuthMethod('approval')}
          >
            <Send size={14} />
            Solicitar Aprobación
          </button>
        </div>

        {/* Contenido según método seleccionado */}
        {authMethod === 'direct' ? (
          <>
            {isAutorizado ? (
              <AuthBadge authState={authState} onClear={limpiarAuth} SALIDA_METHODS={SALIDA_METHODS} />
            ) : (
              <SupervisorPanel
                onAuthorized={(name, id) => {
                  autorizarConSupervisor(name, id);
                  toast.success(`Autorizado por ${name}`);
                }}
              />
            )}
          </>
        ) : (
          <SupervisorSelectionPanel 
            onRequestCreated={handleRequestCreated}
            currentRequest={currentRequest}
            motivo={motivo}
          />
        )}
      </div>

      {/* Botones */}
      <div className="flex gap-4">
        <button className="btn-apple-secondary flex-1" onClick={handleClose}>Cancelar</button>
        <button
          className="flex-1 btn-apple-danger"
          onClick={handleConfirm}
          disabled={!isValid}
          title={!isValid ? 'Completa todos los campos y la autorización' : ''}
        >
          Confirmar Salida
        </button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <BottomSheet isOpen={isOpen} onClose={handleClose} title="Salida de Material">
        {content}
      </BottomSheet>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card animate-scale-up" style={{ maxWidth: 520 }}>
        <header className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <RefreshCw size={24} style={{ color: 'hsl(var(--danger))' }} />
            Salida de Material
          </h3>
        </header>
        {content}
      </div>
    </div>
  );
};

export default ActionModal;