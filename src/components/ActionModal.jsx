import React, { useState, useCallback, useEffect } from 'react';
import { X, RefreshCw, ArrowDownCircle, FileText, AlertCircle, ShieldCheck, Loader2, CheckCircle2, Eye, EyeOff, Lock, Clock, Send, Upload, FileImage } from 'lucide-react';
import useIsMobile from '../hooks/useIsMobile';
import BottomSheet from './BottomSheet';
import { useSalidaAuth } from '../context/SalidaAuthContext';
import { useApproval } from '../context/ApprovalContext';
import { APPROVAL_STATUS } from '../context/ApprovalContext';
import { uploadFactura } from '../services/uploadFactura';
import { toast } from 'sonner';
import SupervisorSelector from './SupervisorSelector';
import ApprovalStatusBadge from './ApprovalStatusBadge';
import './ActionModal.css';

// ─── Sub-panel: Vincular Factura de Compra ───────────────────
const FacturaUploadPanel = ({ onAuthorized }) => {
  const [file, setFile] = useState(null);
  const [folio, setFolio] = useState('');
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  const handleFileChange = useCallback((e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    setFile(selected);
    if (selected.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(selected));
    } else {
      setPreviewUrl(null);
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!file) {
      toast.error('Selecciona una imagen o PDF de factura');
      return;
    }
    const finalFolio = folio.trim() || `FAC-${Date.now()}`;
    setUploading(true);
    try {
      const publicUrl = await uploadFactura(file);
      onAuthorized(finalFolio, publicUrl);
    } catch (err) {
      console.error('[FacturaUploadPanel] Error:', err);
      toast.error(err.message || 'Error al subir la factura');
    } finally {
      setUploading(false);
    }
  }, [file, folio, onAuthorized]);

  // Limpiar URL temporal al desmontar
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <div className="am-auth-panel">
      <div className="am-auth-panel-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
        <Upload size={22} />
      </div>
      <p className="am-auth-panel-title">Vincular Factura de Compra</p>
      <p className="am-auth-panel-sub">Sube una foto o PDF de la factura correspondiente para autorizar esta salida.</p>

      <div className="f-group" style={{ marginTop: '1rem' }}>
        <label>Número de Factura / Folio (Opcional)</label>
        <input
          type="text"
          className="f-input"
          value={folio}
          onChange={e => setFolio(e.target.value)}
          placeholder="Ej: A-45201, 1024..."
          disabled={uploading}
        />
      </div>

      <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>Archivo de Factura</label>
        <div 
          style={{
            border: '2px dashed rgba(255,255,255,0.15)',
            borderRadius: '12px',
            padding: '1.25rem',
            textAlign: 'center',
            background: 'rgba(255,255,255,0.02)',
            cursor: 'pointer',
            position: 'relative',
            transition: 'border-color 0.2s',
          }}
          onClick={() => !uploading && document.getElementById('factura-file-input').click()}
        >
          <input
            id="factura-file-input"
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            disabled={uploading}
          />
          {previewUrl ? (
            <img 
              src={previewUrl} 
              alt="Preview" 
              style={{ maxWidth: '100%', maxHeight: '100px', objectFit: 'contain', borderRadius: '8px', margin: '0 auto' }} 
            />
          ) : file ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#fff', fontSize: '0.85rem' }}>
              <FileImage size={24} style={{ color: '#3b82f6' }} />
              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '200px' }}>{file.name}</span>
            </div>
          ) : (
            <div>
              <Upload size={20} style={{ color: 'rgba(255,255,255,0.4)', margin: '0 auto 8px' }} />
              <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
                Selecciona una foto o PDF de factura
              </span>
            </div>
          )}
        </div>
      </div>

      <button
        className="btn-apple-primary"
        style={{ width: '100%', marginTop: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#3b82f6', color: '#fff' }}
        onClick={handleUpload}
        disabled={uploading || !file}
      >
        {uploading ? <><Loader2 size={16} className="am-spin" /> Subiendo factura...</> : <><ShieldCheck size={16} /> Subir y Vincular</>}
      </button>
    </div>
  );
};

// ─── Sub-panel: Selección de Supervisor (Nuevo Flujo de Aprobación) ─────────────
const SupervisorSelectionPanel = ({ onRequestCreated, currentRequest, motivo, item, qty }) => {
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
        timeoutMinutes: 30,
        item: item ? { id: item.id, name: item.name, unit: item.unit } : null,
        qty: qty
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
  }, [selectedSupervisorId, createApprovalRequest, onRequestCreated, motivo, item, qty]);

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
  const { authState, isAutorizado, autorizarConFactura, limpiarAuth, buildAuthDetails, SALIDA_METHODS } = useSalidaAuth();
  const { currentRequestId, startPolling, stopPolling, requests } = useApproval();

  const [qty, setQty] = useState(1);
  const [motivo, setMotivo] = useState('');
  const [authMethod, setAuthMethod] = useState('factura'); // 'factura' | 'approval'
  const [currentRequest, setCurrentRequest] = useState(null);

  useEffect(() => {
    if (currentRequestId && requests?.length > 0) {
      const updatedReq = requests.find(req => req.id === currentRequestId);
      if (updatedReq) {
        setCurrentRequest(updatedReq);
      }
    }
  }, [requests, currentRequestId]);

  const parsedQty = parseInt(qty) || 0;
  const stockDisponible = item?.qty ?? 0;

  // Determinar si el formulario es válido
  const isValid =
    parsedQty > 0 &&
    parsedQty <= stockDisponible &&
    motivo.trim().length > 0 &&
    (authMethod === 'factura' ? isAutorizado : currentRequest?.status === APPROVAL_STATUS.APPROVED);

  // Manejar creación de solicitud
  const handleRequestCreated = useCallback((request) => {
    setCurrentRequest(request);
    startPolling(request.id);
  }, [startPolling]);

  // Manejar confirmación de salida
  const handleConfirm = useCallback(() => {
    if (!isValid) return;

    let authDetails;
    
    if (authMethod === 'factura') {
      // Validación de seguridad en cliente: bloquear si no hay factura vinculada
      if (authState.method !== SALIDA_METHODS.FACTURA) {
        toast.error('Salida bloqueada: se requiere vincular una factura.');
        return;
      }
      authDetails = buildAuthDetails(`Motivo: ${motivo.trim()}`);
    } else {
      // Nuevo flujo: usar aprobación
      if (!currentRequest || currentRequest.status !== APPROVAL_STATUS.APPROVED) {
        toast.error('Salida bloqueada: la solicitud debe estar aprobada.');
        return;
      }
      authDetails = `Motivo: ${motivo.trim()} | approval_id:${currentRequest.id} | supervisor_id:${currentRequest.supervisor_id} | autorizado_por:${currentRequest.metadata?.supervisor_name || 'Supervisor'}`;
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
          <span>Vincular Documentación</span>
          {(!isAutorizado && authMethod === 'factura') && <span className="am-auth-required-badge">REQUERIDA</span>}
        </div>

        {/* Selector de método de autorización */}
        <div className="am-method-selector">
          <button
            className={`am-method-btn ${authMethod === 'factura' ? 'active' : ''}`}
            onClick={() => setAuthMethod('factura')}
          >
            <FileText size={14} />
            Vincular Factura
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
        {authMethod === 'factura' ? (
          <>
            {isAutorizado && authState.method === SALIDA_METHODS.FACTURA ? (
              <AuthBadge authState={authState} onClear={limpiarAuth} SALIDA_METHODS={SALIDA_METHODS} />
            ) : (
              <FacturaUploadPanel 
                onAuthorized={(facturaId, url) => {
                  autorizarConFactura(facturaId, url);
                  toast.success(`Factura vinculada: ${facturaId}`);
                }}
              />
            )}
          </>
        ) : (
          <SupervisorSelectionPanel 
            onRequestCreated={handleRequestCreated}
            currentRequest={currentRequest}
            motivo={motivo}
            item={item}
            qty={parsedQty}
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