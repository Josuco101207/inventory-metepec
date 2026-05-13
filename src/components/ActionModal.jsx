import React, { useState } from 'react';
import { X, RefreshCw, ArrowUpCircle, ArrowDownCircle, User, AlertCircle } from 'lucide-react';
import './ActionModal.css';

const ActionModal = ({ isOpen, onClose, item, onConfirm, personnel = [] }) => {
  const [qty, setQty] = useState(1);
  const [action, setAction] = useState('Entrada');
  const [details, setDetails] = useState('');

  if (!isOpen || !item) return null;

  const isSalida = action === 'Salida';
  const isValid = qty && parseInt(qty) > 0 && (!isSalida || details.trim().length > 0);

  const handleConfirm = () => {
    if (!isValid) return;
    const finalQty = isSalida ? -parseInt(qty) : parseInt(qty);
    const detailText = details.trim() ? `Entregado a: ${details.trim()}` : '';
    onConfirm(item.id, finalQty, detailText);
    setDetails('');
    setQty(1);
    setAction('Entrada');
    onClose();
  };

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

        <div className="flex flex-col gap-6">
          {/* Toggle Entrada / Salida */}
          <div className="f-group">
            <label>Tipo de Operación</label>
            <div className="operation-toggle">
              <button
                className={`op-btn ${action === 'Entrada' ? 'active-entrada' : ''}`}
                onClick={() => { setAction('Entrada'); setDetails(''); }}
              >
                <ArrowUpCircle size={18} /> Entrada
              </button>
              <button
                className={`op-btn ${action === 'Salida' ? 'active-salida' : ''}`}
                onClick={() => setAction('Salida')}
              >
                <ArrowDownCircle size={18} /> Salida
              </button>
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

          {/* Recipient — always shown, REQUIRED for Salida */}
          <div className="f-group">
            <label>
              <User size={14} style={{ marginRight: 6 }} />
              {isSalida ? 'Entregado a (OBLIGATORIO)' : 'Recibe / Destinatario (Opcional)'}
            </label>

            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="f-input"
                list="personnel-list-modal"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder={isSalida ? 'Nombre de quien recibe...' : 'Nombre (opcional)...'}
                style={{
                  borderColor: isSalida && details.trim().length === 0 ? 'hsl(var(--danger))' : undefined,
                }}
              />
              <datalist id="personnel-list-modal">
                {personnel.map(p => (
                  <option key={p.id} value={p.name} />
                ))}
              </datalist>
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
                Debes indicar quién recibe el material para continuar.
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
      </div>
    </div>
  );
};

export default ActionModal;
