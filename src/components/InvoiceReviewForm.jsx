import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  CheckCircle2, AlertTriangle, PlusCircle, Trash2, Save,
  ArrowLeft, Search, ChevronDown, Package, Sparkles, Edit3
} from 'lucide-react';
import { findBestMatches, suggestCategory } from '../utils/textSimilarity';
import { useInventory } from '../context/InventoryContext';
import { useCategories } from '../context/CategoriesContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const IVA_RATE = 0.16;
const UNITS = ['PZA', 'KG', 'M', 'LT', 'ML', 'CM', 'ROLLO', 'CAJA', 'PAR', 'JGO', 'BOLSA', 'PAQUETE'];

const MatchBadge = ({ score, isExact, isNew }) => {
  if (isNew) return <span className="irf-badge irf-badge-new"><PlusCircle size={12} /> Producto Nuevo</span>;
  if (isExact) return <span className="irf-badge irf-badge-exact"><CheckCircle2 size={12} /> Coincidencia Exacta</span>;
  if (score >= 0.7) return <span className="irf-badge irf-badge-high"><Sparkles size={12} /> Alta ({Math.round(score * 100)}%)</span>;
  if (score >= 0.5) return <span className="irf-badge irf-badge-mid"><Search size={12} /> Parcial ({Math.round(score * 100)}%)</span>;
  return <span className="irf-badge irf-badge-low"><AlertTriangle size={12} /> Baja ({Math.round(score * 100)}%)</span>;
};

const InvoiceReviewForm = ({ extractedData, onBack, onConfirm, previewUrl }) => {
  const { items: inventoryItems, addItem, updateStock } = useInventory();
  const { categories } = useCategories();
  const { userData } = useAuth();
  const [header, setHeader] = useState(extractedData.header);
  const [items, setItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);

  const categoryTitles = useMemo(() => categories.map(c => c.title), [categories]);

  useEffect(() => {
    const mapped = extractedData.items.map((item, idx) => {
      const matches = findBestMatches(item.descripcion, inventoryItems);
      const bestMatch = matches[0] || null;
      const isNew = !bestMatch || bestMatch.score < 0.35;
      
      const rawCat = isNew ? suggestCategory(item.descripcion) : (bestMatch?.item?.category || '');
      const defaultCat = categoryTitles.length > 0 ? categoryTitles[0] : 'General';
      const sugCat = categoryTitles.includes(rawCat) ? rawCat : defaultCat;

      return {
        _key: `${Date.now()}-${idx}`,
        originalName: item.descripcion,
        mappedName: bestMatch && !isNew ? bestMatch.item.name : item.descripcion,
        mappedItemId: bestMatch && !isNew ? bestMatch.item.id : null,
        cantidad: item.cantidad,
        unidad: item.unidad,
        precioUnitario: item.precioUnitario,
        iva: item.iva || item.precioUnitario * item.cantidad * IVA_RATE,
        importe: item.precioUnitario * item.cantidad,
        isNew,
        matchScore: bestMatch?.score || 0,
        isExact: bestMatch?.isExact || false,
        category: sugCat,
        matches,
        accepted: true,
        detallesExtra: item.detallesExtra || {}, // Ensure we keep the extra details!
      };
    });
    setItems(mapped);
  }, [extractedData, inventoryItems, categoryTitles]);

  const updateItem = useCallback((idx, field, value) => {
    setItems(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      if (field === 'cantidad' || field === 'precioUnitario') {
        const qty = parseFloat(copy[idx].cantidad) || 0;
        const price = parseFloat(copy[idx].precioUnitario) || 0;
        copy[idx].importe = qty * price;
        copy[idx].iva = qty * price * IVA_RATE;
      }
      return copy;
    });
  }, []);

  const selectMatch = useCallback((idx, match) => {
    setItems(prev => {
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        mappedName: match.item.name,
        mappedItemId: match.item.id,
        category: match.item.category || copy[idx].category,
        isNew: false,
        matchScore: match.score,
        isExact: match.isExact,
      };
      return copy;
    });
    setExpandedRow(null);
  }, []);

  const markAsNew = useCallback((idx) => {
    setItems(prev => {
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        mappedName: copy[idx].originalName,
        mappedItemId: null,
        isNew: true,
        matchScore: 0,
        isExact: false,
        category: suggestCategory(copy[idx].originalName),
      };
      return copy;
    });
    setExpandedRow(null);
  }, []);

  const removeItem = useCallback((idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const totals = useMemo(() => {
    const accepted = items.filter(i => i.accepted);
    const subtotal = accepted.reduce((s, i) => s + i.importe, 0);
    const iva = accepted.reduce((s, i) => s + i.iva, 0);
    return { subtotal, iva, total: subtotal + iva, count: accepted.length };
  }, [items]);

  const handleConfirm = useCallback(async () => {
    const accepted = items.filter(i => i.accepted);
    if (!accepted.length) {
      toast.error('No hay items seleccionados para procesar');
      return;
    }

    const userName = userData?.name || userData?.email || 'Sistema (IA)';
    setSubmitting(true);
    try {
      for (const item of accepted) {
        let detallesStr = '';
        if (item.detallesExtra && typeof item.detallesExtra === 'object') {
          const keys = Object.keys(item.detallesExtra);
          if (keys.length > 0) {
            detallesStr = ' | Detalles: ' + keys.map(k => `${k}: ${item.detallesExtra[k]}`).join(', ');
          }
        }

        if (item.isNew) {
          await addItem({
            name: item.mappedName,
            qty: Math.round(item.cantidad),
            threshold: 0,
            marca: item.detallesExtra?.marca || header.proveedor,
            location: '',
            status: 'Disponible',
            subcategory: '',
            observaciones: `Factura ${header.folio} | ${header.proveedor} | $${item.precioUnitario}/u${detallesStr}`,
            category: item.category,
            importe: item.importe,
            precio_unitario: item.precioUnitario,
            precioUnitario: item.precioUnitario,
            iva: item.iva,
          }, userName);
        } else if (item.mappedItemId) {
          await updateStock(
            item.mappedItemId,
            Math.round(item.cantidad),
            userName,
            `Ingreso Factura ${header.folio} | ${header.proveedor}${detallesStr}`
          );
        }
      }

      toast.success(`${accepted.length} productos procesados correctamente`);
      if (onConfirm) onConfirm({ header, items: accepted, totals });
    } catch (err) {
      console.error('Error processing invoice items:', err);
      toast.error('Error al procesar algunos items: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  }, [items, header, userData, addItem, updateStock, onConfirm, totals]);

  const fmt = (n) => {
    const v = parseFloat(n) || 0;
    return v.toLocaleString('es-MX', { style: 'currency', currency: header.moneda || 'MXN', minimumFractionDigits: 2 });
  };

  return (
    <div className="irf-container">
      {/* Top Bar */}
      <div className="irf-topbar">
        <button className="fly-btn fly-btn-ghost" onClick={onBack}>
          <ArrowLeft size={18} /> Volver
        </button>
        <h2>Revisión de Factura</h2>
        <button
          className="fly-btn fly-btn-primary"
          onClick={handleConfirm}
          disabled={submitting || totals.count === 0}
        >
          {submitting ? (
            <><div className="iu-spinner-small" /> Procesando...</>
          ) : (
            <><Save size={18} /> Confirmar {totals.count} Items</>
          )}
        </button>
      </div>

      {/* Split Layout */}
      <div className="irf-split">
        {/* Left: Invoice Preview */}
        <div className="irf-preview-panel">
          <div className="irf-preview-header">
            <Package size={18} />
            <span>Documento Original</span>
          </div>
          {previewUrl ? (
            <img src={previewUrl} alt="Factura" className="irf-preview-image" />
          ) : (
            <div className="irf-preview-placeholder">
              <Package size={48} />
              <p>Vista previa no disponible</p>
            </div>
          )}
        </div>

        {/* Right: Extracted Data */}
        <div className="irf-data-panel">
          {/* Header Fields */}
          <div className="irf-section">
            <h3 className="irf-section-title">Datos de la Factura</h3>
            <div className="irf-header-grid">
              <div className="iv-field">
                <label>Folio</label>
                <input
                  className="iv-input"
                  value={header.folio}
                  onChange={(e) => setHeader(h => ({ ...h, folio: e.target.value }))}
                />
              </div>
              <div className="iv-field">
                <label>Proveedor</label>
                <input
                  className="iv-input"
                  value={header.proveedor}
                  onChange={(e) => setHeader(h => ({ ...h, proveedor: e.target.value }))}
                />
              </div>
              <div className="iv-field">
                <label>Fecha</label>
                <input
                  className="iv-input"
                  type="date"
                  value={header.fecha}
                  onChange={(e) => setHeader(h => ({ ...h, fecha: e.target.value }))}
                />
              </div>
              <div className="iv-field">
                <label>Moneda</label>
                <select
                  className="iv-input"
                  value={header.moneda}
                  onChange={(e) => setHeader(h => ({ ...h, moneda: e.target.value }))}
                >
                  <option value="MXN">MXN</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="irf-section">
            <h3 className="irf-section-title">
              Productos Detectados
              <span className="irf-section-count">{items.length} items</span>
            </h3>

            <div className="irf-items-list">
              {items.map((item, idx) => (
                <div key={item._key} className={`irf-item-card ${!item.accepted ? 'irf-item-rejected' : ''}`}>
                  <div className="irf-item-main">
                    {/* Row 1: Names + Badge */}
                    <div className="irf-item-names">
                      <div className="irf-item-original">
                        <span className="irf-label-tiny">Original (Factura)</span>
                        <span className="irf-original-text">{item.originalName}</span>
                      </div>
                      <div className="irf-item-arrow">→</div>
                      <div className="irf-item-mapped">
                        <span className="irf-label-tiny">Nombre en Sistema</span>
                        <input
                          className="iv-input irf-mapped-input"
                          value={item.mappedName}
                          onChange={(e) => updateItem(idx, 'mappedName', e.target.value)}
                        />
                      </div>
                      <MatchBadge score={item.matchScore} isExact={item.isExact} isNew={item.isNew} />
                    </div>

                    {/* Row 2: Editable fields */}
                    <div className="irf-item-fields">
                      <div className="irf-mini-field">
                        <label>Cantidad</label>
                        <input
                          className="iv-input"
                          type="number"
                          min="0"
                          step="1"
                          value={item.cantidad}
                          onChange={(e) => updateItem(idx, 'cantidad', e.target.value)}
                        />
                      </div>
                      <div className="irf-mini-field">
                        <label>Unidad</label>
                        <select
                          className="iv-input"
                          value={item.unidad}
                          onChange={(e) => updateItem(idx, 'unidad', e.target.value)}
                        >
                          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                      <div className="irf-mini-field">
                        <label>P. Unitario</label>
                        <input
                          className="iv-input"
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.precioUnitario}
                          onChange={(e) => updateItem(idx, 'precioUnitario', e.target.value)}
                        />
                      </div>
                      <div className="irf-mini-field">
                        <label>IVA (16%)</label>
                        <input className="iv-input" value={fmt(item.iva)} readOnly style={{ opacity: 0.7 }} />
                      </div>
                      <div className="irf-mini-field">
                        <label>Importe</label>
                        <input className="iv-input irf-importe" value={fmt(item.importe)} readOnly />
                      </div>
                      <div className="irf-mini-field">
                        <label>Categoría</label>
                        <select
                          className="iv-input"
                          value={item.category}
                          onChange={(e) => updateItem(idx, 'category', e.target.value)}
                        >
                          {categoryTitles.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Row 3: Actions */}
                    <div className="irf-item-actions">
                      <button
                        className="irf-action-btn"
                        onClick={() => setExpandedRow(expandedRow === idx ? null : idx)}
                        title="Ver coincidencias"
                      >
                        <Search size={14} /> Buscar Coincidencias
                      </button>
                      <button
                        className="irf-action-btn"
                        onClick={() => markAsNew(idx)}
                        title="Marcar como nuevo"
                      >
                        <PlusCircle size={14} /> Nuevo Producto
                      </button>
                      <label className="irf-toggle-label">
                        <input
                          type="checkbox"
                          checked={item.accepted}
                          onChange={(e) => updateItem(idx, 'accepted', e.target.checked)}
                        />
                        <span>Incluir</span>
                      </label>
                      <button className="irf-action-btn irf-action-danger" onClick={() => removeItem(idx)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded: Match suggestions */}
                  {expandedRow === idx && (
                    <div className="irf-matches-panel">
                      <p className="irf-matches-title">Coincidencias encontradas en inventario:</p>
                      {item.matches.length > 0 ? (
                        <div className="irf-matches-list">
                          {item.matches.map((m, mi) => (
                            <button
                              key={mi}
                              className="irf-match-option"
                              onClick={() => selectMatch(idx, m)}
                            >
                              <span className="irf-match-name">{m.item.name}</span>
                              <span className="irf-match-cat">{m.item.category}</span>
                              <span className={`irf-match-score ${m.score >= 0.7 ? 'high' : m.score >= 0.5 ? 'mid' : 'low'}`}>
                                {Math.round(m.score * 100)}%
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="irf-no-matches">No se encontraron coincidencias en el inventario</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="irf-totals">
            <div className="irf-totals-inner">
              <div className="irf-total-row">
                <span>Subtotal ({totals.count} items)</span>
                <span className="irf-total-val">{fmt(totals.subtotal)}</span>
              </div>
              <div className="irf-total-row">
                <span>IVA 16%</span>
                <span className="irf-total-val">{fmt(totals.iva)}</span>
              </div>
              <div className="irf-total-row irf-total-grand">
                <span>Total</span>
                <span className="irf-total-val">{fmt(totals.total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceReviewForm;
