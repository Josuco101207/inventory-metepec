import React, { useState } from 'react';
import { X, RefreshCw, ArrowUpCircle, ArrowDownCircle, FileText, AlertCircle, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useIsMobile from '../hooks/useIsMobile';
import BottomSheet from './BottomSheet';
import './ActionModal.css';

const ActionModal = ({ isOpen, onClose, item, onConfirm, personnel = [] }) => {
  const navigate = useNavigate();
  const { isMobile } = useIsMobile();
  const [qty, setQty] = useState(1);
  const [action, setAction] = useState('Salida');
  const [details, setDetails] = useState('');

  if (!isOpen || !item) return null;

  const isSalida = action === 'Salida';
  const isValid = qty && parseInt(qty) > 0 && (!isSalida || details.trim().length > 0);

  const handleConfirm = () => {
    if (!isValid) return;
    const finalQty = isSalida ? -parseInt(qty) : parseInt(qty);
    const detailText = details.trim() ? (isSalida ? `Motivo: ${details.trim()}` : details.trim()) : '';
    onConfirm(item.id, finalQty, detailText);
    setDetails('');
    setQty(1);
    setAction('Salida');
    onClose();
  };

  const content = (
    <div className="flex flex-col gap-6">
      {/* Solo Salida — las Entradas se manejan vía Carga IA de Facturas */}
      <div className="f-group">
        <label>Tipo de Operación</label>
        <div className="operation-toggle">
          <button
            className="op-btn active-salida"
            style={{ flex: 1 }}
          >
            <ArrowDownCircle size={18} /> Salida
          </button>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          marginTop: 8, padding: '8px 12px', borderRadius: 10,
          background: 'rgba(141, 198, 63, 0.1)',
          fontSize: 11, fontWeight: 700, color: 'hsl(var(--primary))'
        }}>
          <Sparkles size={13} />
          <span>Las entradas de inventario se realizan únicamente mediante <button
            type="button"
            onClick={() => { onClose(); navigate('/invoice-ai'); }}
            style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', font: 'inherit', padding: 0 }}
          >Carga IA de Facturas</button>.</span>
        </div>
      </div>

      {/* Quantity */}
      <div className="f-group">
        <label>Cantidad ({item?.unit || 'Piezas'})</label>
        <input
          type="number"
          className="f-input text-lg font-bold"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder="0"
          autoFocus
          min={1}
        />
      </div>

      {/* Reason — shown for both, REQUIRED for Salida */}
      <div className="f-group">
        <label>
          <FileText size={14} style={{ marginRight: 6 }} />
          {isSalida ? 'Motivo de salida (OBLIGATORIO)' : 'Notas (Opcional)'}
        </label>

        <div style={{ position: 'relative' }}>
          <input
            type="text"
            className="f-input"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder={isSalida ? 'Ej: uso en evento, consumo diario, préstamo...' : 'Notas adicionales (opcional)...'}
            style={{
              borderColor: isSalida && details.trim().length === 0 ? 'hsl(var(--danger))' : undefined,
            }}
          />
        </div>

        {/* Warning message when Salida and empty */}
        {isSalida && details.trim().length === 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            marginTop: 8, padding: '8px 12px', borderRadius: 10,
            background: 'hsla(var(--danger), 0.1)',
            fontSize: 11, fontWeight: 700, color: 'hsl(var(--danger))'
          }}>
            <AlertCircle size={13} />
            Debes indicar el motivo de la salida para continuar.
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="flex gap-4">
        <button className="btn-apple-secondary flex-1" onClick={onClose}>Cancelar</button>
        <button
          className={`flex-1 ${isSalida ? 'btn-apple-danger' : 'btn-apple-primary'}`}
          onClick={handleConfirm}
          disabled={!isValid}
        >
          {isSalida ? 'Confirmar Salida' : 'Confirmar Entrada'}
        </button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <BottomSheet isOpen={isOpen} onClose={onClose} title="Movimiento de Stock">
        <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '1.25rem' }}>
          Artículo: <strong style={{ color: 'rgba(255,255,255,0.96)' }}>{item?.name}</strong>
        </p>
        {content}
      </BottomSheet>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card animate-scale-up">
        <header className="modal-header">
          <h3>
            <RefreshCw className="text-blue-500" size={28} />
            Movimiento de Stock
          </h3>
          <p>
            Artículo: <strong>{item?.name}</strong>
          </p>
        </header>

        {content}
      </div>
    </div>
  );
};

export default ActionModal;
