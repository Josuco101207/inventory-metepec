import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CheckCircle2, XCircle, Clock, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';

const ApprovalActionView = ({ action }) => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState('loading'); // loading | confirming | success | error | already_handled
  const [request, setRequest] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);

  // Cargar la solicitud
  useEffect(() => {
    const loadRequest = async () => {
      try {
        const { data, error } = await supabase
          .rpc('get_approval_request_by_token', { p_id: id, p_token: token });

        if (error || !data || data.length === 0) {
          setStatus('error');
          setErrorMsg('Solicitud no encontrada, enlace expirado o token de seguridad inválido.');
          return;
        }

        const requestData = data[0];
        setRequest(requestData);

        if (requestData.status !== 'pending') {
          setStatus('already_handled');
        } else if (new Date(requestData.timeout_at) < new Date()) {
          setStatus('already_handled');
          setErrorMsg('Esta solicitud ya expiró.');
        } else {
          setStatus('confirming');
          if (action === 'reject') setShowRejectForm(true);
        }
      } catch (err) {
        setStatus('error');
        setErrorMsg(err.message || 'Error al cargar la solicitud.');
      }
    };

    if (id) loadRequest();
  }, [id, action, token]);

  const handleApprove = async () => {
    setProcessing(true);
    try {
      const { data: success, error } = await supabase
        .rpc('respond_to_approval_request_by_token', {
          p_id: id,
          p_token: token,
          p_status: 'approved'
        });

      if (error || !success) throw error || new Error('No se pudo procesar la aprobación.');
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Error al aprobar la solicitud.');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setProcessing(true);
    try {
      const { data: success, error } = await supabase
        .rpc('respond_to_approval_request_by_token', {
          p_id: id,
          p_token: token,
          p_status: 'rejected',
          p_rejection_reason: rejectReason.trim()
        });

      if (error || !success) throw error || new Error('No se pudo procesar el rechazo.');
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Error al rechazar la solicitud.');
    } finally {
      setProcessing(false);
    }
  };

  const isApprove = action === 'approve';

  const styles = {
    page: {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      padding: '1.5rem',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    card: {
      background: '#1e1e2e',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '20px',
      padding: '2.5rem 2rem',
      maxWidth: '440px',
      width: '100%',
      boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
      textAlign: 'center',
    },
    logo: {
      fontSize: '0.75rem',
      fontWeight: 800,
      letterSpacing: '0.15em',
      color: 'rgba(255,255,255,0.4)',
      textTransform: 'uppercase',
      marginBottom: '1.5rem',
    },
    iconWrap: (color) => ({
      width: 72,
      height: 72,
      borderRadius: '50%',
      background: `${color}20`,
      border: `2px solid ${color}40`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto 1.25rem',
      color,
    }),
    title: {
      fontSize: '1.4rem',
      fontWeight: 900,
      color: '#fff',
      margin: '0 0 0.5rem',
    },
    sub: {
      fontSize: '0.875rem',
      color: 'rgba(255,255,255,0.55)',
      margin: '0 0 1.5rem',
      lineHeight: 1.5,
    },
    infoBox: {
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '12px',
      padding: '1rem',
      marginBottom: '1.5rem',
      textAlign: 'left',
    },
    infoRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0.35rem 0',
      fontSize: '0.82rem',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    },
    infoLabel: { color: 'rgba(255,255,255,0.45)', fontWeight: 600 },
    infoValue: { color: '#fff', fontWeight: 700, maxWidth: '60%', textAlign: 'right' },
    btnPrimary: (color, disabled) => ({
      width: '100%',
      padding: '0.9rem',
      background: disabled ? '#333' : color,
      color: disabled ? '#666' : '#fff',
      border: 'none',
      borderRadius: '12px',
      fontWeight: 800,
      fontSize: '1rem',
      cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem',
      transition: 'all 0.2s',
      marginBottom: '0.75rem',
    }),
    btnSecondary: {
      width: '100%',
      padding: '0.9rem',
      background: 'transparent',
      color: 'rgba(255,255,255,0.5)',
      border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: '12px',
      fontWeight: 700,
      fontSize: '0.9rem',
      cursor: 'pointer',
      marginBottom: '0.75rem',
    },
    textarea: {
      width: '100%',
      padding: '0.75rem 1rem',
      background: 'rgba(255,255,255,0.05)',
      border: '1.5px solid rgba(255,255,255,0.15)',
      borderRadius: '10px',
      color: '#fff',
      fontSize: '0.9rem',
      fontFamily: 'inherit',
      resize: 'vertical',
      minHeight: '80px',
      marginBottom: '0.75rem',
      outline: 'none',
      boxSizing: 'border-box',
    },
  };

  // ─── Estados de UI ───

  if (status === 'loading') {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.logo}>Dicrejart · Sistema de Inventario</div>
          <div style={styles.iconWrap('rgba(255,255,255,0.4)')}>
            <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
          <p style={styles.title}>Cargando solicitud...</p>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.logo}>Dicrejart · Sistema de Inventario</div>
          <div style={styles.iconWrap('#ef4444')}>
            <AlertCircle size={32} />
          </div>
          <p style={styles.title}>Error</p>
          <p style={styles.sub}>{errorMsg || 'Ocurrió un error inesperado.'}</p>
        </div>
      </div>
    );
  }

  if (status === 'already_handled') {
    const statusLabel = {
      approved: { label: 'Ya fue Aprobada', color: '#10b981', Icon: CheckCircle2 },
      rejected: { label: 'Ya fue Rechazada', color: '#ef4444', Icon: XCircle },
      expired:  { label: 'Solicitud Expirada', color: '#f59e0b', Icon: Clock },
      cancelled:{ label: 'Solicitud Cancelada', color: '#6b7280', Icon: XCircle },
    }[request?.status] || { label: 'Ya fue Procesada', color: '#6b7280', Icon: ShieldCheck };

    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.logo}>Dicrejart · Sistema de Inventario</div>
          <div style={styles.iconWrap(statusLabel.color)}>
            <statusLabel.Icon size={32} />
          </div>
          <p style={styles.title}>{statusLabel.label}</p>
          <p style={styles.sub}>
            Esta solicitud ya fue procesada anteriormente y no puede modificarse.
            {errorMsg && ` ${errorMsg}`}
          </p>
          {request?.response_message && (
            <div style={{ ...styles.infoBox, textAlign: 'center' }}>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', margin: 0 }}>
                "{request.response_message}"
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.logo}>Dicrejart · Sistema de Inventario</div>
          <div style={styles.iconWrap(isApprove ? '#10b981' : '#ef4444')}>
            {isApprove ? <CheckCircle2 size={32} /> : <XCircle size={32} />}
          </div>
          <p style={styles.title}>
            {isApprove ? '¡Solicitud Aprobada!' : 'Solicitud Rechazada'}
          </p>
          <p style={styles.sub}>
            {isApprove
              ? 'La salida de inventario ha sido autorizada exitosamente. El solicitante ya puede continuar.'
              : 'La solicitud fue rechazada. El solicitante será notificado automáticamente.'}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', marginTop: '1rem' }}>
            Puedes cerrar esta ventana.
          </p>
        </div>
      </div>
    );
  }

  // ─── Estado: confirming ───
  const requesterName = request?.metadata?.requester_name || request?.metadata?.requester_email || 'Usuario';
  const motivoText = request?.metadata?.motivo || 'Salida de inventario';
  const expiresAt = request?.timeout_at
    ? new Date(request.timeout_at).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })
    : '—';

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>Dicrejart · Sistema de Inventario</div>

        <div style={styles.iconWrap(isApprove ? '#10b981' : '#ef4444')}>
          {isApprove ? <ShieldCheck size={32} /> : <XCircle size={32} />}
        </div>

        <p style={styles.title}>
          {isApprove ? 'Aprobar Solicitud' : 'Rechazar Solicitud'}
        </p>
        <p style={styles.sub}>
          {isApprove
            ? 'Al aprobar, el operador podrá registrar la salida de inventario.'
            : 'Indica el motivo del rechazo para que el solicitante sea notificado.'}
        </p>

        {/* Detalles de la solicitud */}
        <div style={styles.infoBox}>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Solicitante</span>
            <span style={styles.infoValue}>{requesterName}</span>
          </div>
          {request?.metadata?.item_name && (
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Material</span>
              <span style={styles.infoValue}>{request.metadata.item_name}</span>
            </div>
          )}
          {request?.metadata?.quantity !== undefined && (
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Cantidad</span>
              <span style={styles.infoValue}>
                {request.metadata.quantity} {request.metadata.item_unit || ''}
              </span>
            </div>
          )}
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Motivo</span>
            <span style={styles.infoValue}>{motivoText}</span>
          </div>
          <div style={{ ...styles.infoRow, borderBottom: 'none' }}>
            <span style={styles.infoLabel}>Expira</span>
            <span style={styles.infoValue}>{expiresAt}</span>
          </div>
        </div>

        {/* Formulario de rechazo */}
        {!isApprove && (
          <>
            <textarea
              style={styles.textarea}
              placeholder="Motivo del rechazo (requerido)..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
            />
          </>
        )}

        {/* Botón principal */}
        {isApprove ? (
          <button
            style={styles.btnPrimary('#10b981', processing)}
            onClick={handleApprove}
            disabled={processing}
          >
            {processing
              ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Procesando...</>
              : <><CheckCircle2 size={18} /> Confirmar Aprobación</>
            }
          </button>
        ) : (
          <button
            style={styles.btnPrimary('#ef4444', processing || !rejectReason.trim())}
            onClick={handleReject}
            disabled={processing || !rejectReason.trim()}
          >
            {processing
              ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Procesando...</>
              : <><XCircle size={18} /> Confirmar Rechazo</>
            }
          </button>
        )}

        <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.25)', marginTop: '0.5rem' }}>
          Esta acción no requiere iniciar sesión.
        </p>

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
};

export default ApprovalActionView;
