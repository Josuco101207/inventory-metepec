import React, { useState, useCallback } from 'react';
import { X, RefreshCw, ArrowDownCircle, FileText, AlertCircle, ShieldCheck, Loader2, CheckCircle2, Eye, EyeOff, Lock } from 'lucide-react';
import useIsMobile from '../hooks/useIsMobile';
import BottomSheet from './BottomSheet';
import { useSalidaAuth } from '../context/SalidaAuthContext';
import { validateSupervisorCredentials } from '../storage/supabaseStorage';
import { toast } from 'sonner';
import './ActionModal.css';

// ─── Sub-panel: Autorización por Supervisor ───────────────────────────────────
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

  const [qty, setQty] = useState(1);
  const [motivo, setMotivo] = useState('');

  const parsedQty = parseInt(qty) || 0;
  const stockDisponible = item?.qty ?? 0;

  const isValid =
    parsedQty > 0 &&
    parsedQty <= stockDisponible &&
    motivo.trim().length > 0 &&
    isAutorizado;

  const handleConfirm = useCallback(() => {
    if (!isValid) return;

    // Validación de seguridad en cliente: bloquear si no hay autorización
    if (!authState.autorizadoPorId) {
      toast.error('Salida bloqueada: se requiere autorización de supervisor.');
      return;
    }

    const authDetails = buildAuthDetails(`Motivo: ${motivo.trim()}`);
    onConfirm(item.id, -parsedQty, authDetails);

    // Limpiar estado local
    setQty(1);
    setMotivo('');
    limpiarAuth();
    onClose();
  }, [isValid, authState, buildAuthDetails, motivo, parsedQty, item, onConfirm, limpiarAuth, onClose]);

  const handleClose = useCallback(() => {
    setQty(1);
    setMotivo('');
    onClose();
  }, [onClose]);

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
          {!isAutorizado && <span className="am-auth-required-badge">REQUERIDA</span>}
        </div>

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
