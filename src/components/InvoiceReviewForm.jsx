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
  if (isNew) return <div className="irf-led irf-led-new" title="Producto Nuevo"><span className="irf-led-dot" /><span className="irf-led-label">NUEVO</span></div>;
  if (isExact) return <div className="irf-led irf-led-exact" title="Coincidencia Exacta"><span className="irf-led-dot" /><span className="irf-led-label">{Math.round(score * 100)}%</span></div>;
  if (score >= 0.7) return <div className="irf-led irf-led-high" title={`Alta (${Math.round(score * 100)}%)`}><span className="irf-led-dot" /><span className="irf-led-label">{Math.round(score * 100)}%</span></div>;
  if (score >= 0.5) return <div className="irf-led irf-led-mid" title={`Parcial (${Math.round(score * 100)}%)`}><span className="irf-led-dot" /><span className="irf-led-label">{Math.round(score * 100)}%</span></div>;
  return <div className="irf-led irf-led-low" title={`Baja (${Math.round(score * 100)}%)`}><span className="irf-led-dot" /><span className="irf-led-label">{Math.round(score * 100)}%</span></div>;
};

const InvoiceReviewForm = ({ extractedData, onBack, onConfirm, previewUrl, facturaStorageUrl }) => {
  const { items: inventoryItems, addItem, updateStock, locations, subcategories, brands } = useInventory();
  const { categories } = useCategories();
  const { userData } = useAuth();
  const [header, setHeader] = useState(extractedData.header);
  const [items, setItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);

  const categoryTitles = useMemo(() => categories.map(c => c.title), [categories]);

  useEffect(() => {
    const parseNumber = (val) => {
      if (typeof val === 'number') return val;
      if (!val) return 0;
      const clean = String(val).replace(/[^0-9.-]/g, '');
      return parseFloat(clean) || 0;
    };

    const mapped = extractedData.items.map((item, idx) => {
      const matches = findBestMatches(item.descripcion, inventoryItems);
      const bestMatch = matches[0] || null;
      const isNew = !bestMatch || bestMatch.score < 0.35;
      
      const rawCat = isNew ? suggestCategory(item.descripcion) : (bestMatch?.item?.category || '');
      const defaultCat = categoryTitles.length > 0 ? categoryTitles[0] : 'General';
      const sugCat = categoryTitles.includes(rawCat) ? rawCat : defaultCat;

      const cant = parseNumber(item.cantidad);
      const precio = parseNumber(item.precioUnitario);
      const ivaVal = item.iva !== undefined ? parseNumber(item.iva) : (precio * cant * IVA_RATE);

      return {
        _key: `${Date.now()}-${idx}`,
        originalName: item.descripcion,
        mappedName: bestMatch && !isNew ? bestMatch.item.name : item.descripcion,
        mappedItemId: bestMatch && !isNew ? bestMatch.item.id : null,
        cantidad: cant,
        unidad: item.unidad || 'PZA',
        precioUnitario: precio,
        iva: ivaVal,
        importe: precio * cant,
        isNew,
        matchScore: bestMatch?.score || 0,
        isExact: bestMatch?.isExact || false,
        category: sugCat,
        matches,
        accepted: true,
        detallesExtra: item.detallesExtra || {}, // Ensure we keep the extra details!
        dynamicFields: item.detallesExtra || {}, // Pre-fill with any extra details parsed from invoice
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

  const updateDynamicField = useCallback((idx, fieldName, value) => {
    setItems(prev => {
      const copy = [...prev];
      copy[idx] = { 
        ...copy[idx], 
        dynamicFields: {
          ...(copy[idx].dynamicFields || {}),
          [fieldName]: value
        }
      };
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
            unidad: item.unidad,
            ...(item.dynamicFields || {})
          }, userName, facturaStorageUrl || null);
        } else if (item.mappedItemId) {
          await updateStock(
            item.mappedItemId,
            Math.round(item.cantidad),
            userName,
            `Ingreso Factura ${header.folio} | ${header.proveedor}${detallesStr}${facturaStorageUrl ? ' | factura_url:' + facturaStorageUrl : ''}`
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

            <div className="irf-table">
              <div className="irf-table-header">
                <div className="irf-th-name">Producto</div>
                <div className="irf-th-qty">Cant.</div>
                <div className="irf-th-unit">Unidad</div>
                <div className="irf-th-price">Precio U.</div>
                <div className="irf-th-total">Importe</div>
                <div className="irf-th-actions">Acciones</div>
              </div>
              
              <div className="irf-table-body">
                {items.map((item, idx) => (
                  <div key={item._key} className={`irf-tr ${!item.accepted ? 'irf-tr-rejected' : ''}`}>
                    <div className="irf-tr-main">
                      <div className="irf-td-name">
                        <MatchBadge score={item.matchScore} isExact={item.isExact} isNew={item.isNew} />
                        <div className="irf-td-name-inputs">
                          <span className="irf-original-text" title={item.originalName}>{item.originalName}</span>
                          <input
                            className="iv-input irf-mapped-input"
                            value={item.mappedName}
                            onChange={(e) => updateItem(idx, 'mappedName', e.target.value)}
                            placeholder="Nombre en sistema..."
                          />
                        </div>
                      </div>
                      
                      <div className="irf-td-qty">
                        <input
                          className="iv-input"
                          type="number"
                          min="0"
                          step="1"
                          value={item.cantidad}
                          onChange={(e) => updateItem(idx, 'cantidad', e.target.value)}
                        />
                      </div>

                      <div className="irf-td-unit">
                        <select
                          className="iv-input"
                          value={item.unidad}
                          onChange={(e) => updateItem(idx, 'unidad', e.target.value)}
                        >
                          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                      
                      <div className="irf-td-price">
                        <input
                          className="iv-input"
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.precioUnitario}
                          onChange={(e) => updateItem(idx, 'precioUnitario', e.target.value)}
                        />
                      </div>
                      
                      <div className="irf-td-total">
                        <span className="irf-importe">{fmt(item.importe)}</span>
                      </div>
                      
                      <div className="irf-td-actions">
                        <button 
                          className={`irf-btn-icon ${expandedRow === idx ? 'active' : ''}`} 
                          onClick={() => setExpandedRow(expandedRow === idx ? null : idx)} 
                          title="Detalles y Coincidencias"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button 
                          className={`irf-btn-icon ${!item.accepted ? 'disabled' : 'success'}`} 
                          onClick={() => updateItem(idx, 'accepted', !item.accepted)} 
                          title={item.accepted ? "Excluir producto" : "Incluir producto"}
                        >
                          <CheckCircle2 size={16} />
                        </button>
                        <button 
                          className="irf-btn-icon danger" 
                          onClick={() => removeItem(idx)} 
                          title="Eliminar de la lista"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {expandedRow === idx && (
                      <div className="irf-tr-expanded">
                        <div className="irf-expanded-fields">
                          <div className="iv-field">
                            <label>Categoría</label>
                            <select
                              className="iv-input"
                              value={item.category}
                              onChange={(e) => updateItem(idx, 'category', e.target.value)}
                            >
                              {categoryTitles.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          
                          {/* DYNAMIC FIELDS FROM CATEGORY SCHEMA */}
                          {(() => {
                            const catConfig = categories.find(c => c.title === item.category) || {};
                            const schema = catConfig.schema || [];
                            const mappings = catConfig.fieldMappings || {};
                            const mappedCols = [mappings.name, mappings.qty, mappings.observaciones, mappings.threshold].filter(Boolean);
                            // Hide fields we already manage natively, plus mapped ones
                            const HIDDEN = [
                              'id', 'created_at', 'updated_at', 'status', 'prestados', 'borrowedBy', 'lentBy', 'loanDate', 
                              'name', 'qty', 'threshold', 'category', 'observaciones', 'importe', 'precio_unitario', 'precioUnitario', 'iva', 'unidad', 'foto_url', 'descripcion',
                              ...mappedCols
                            ];
                            const visibleFields = schema.filter(f => !HIDDEN.includes(f.name));

                            if (visibleFields.length === 0) return null;

                            return visibleFields.map(field => {
                              const dbTypeToInput = (dbType) => {
                                if (!dbType) return 'text';
                                const t = dbType.toLowerCase();
                                if (t.includes('int') || t === 'float8' || t === 'numeric' || t === 'float4') return 'number';
                                if (t.includes('bool')) return 'checkbox';
                                if (t.includes('date') || t.includes('timestamp')) return 'date';
                                return 'text';
                              };
                              const inputType = dbTypeToInput(field.type);
                              const val = (item.dynamicFields || {})[field.name];

                              return (
                                <div className="iv-field" key={field.name}>
                                  <label className="irf-dynamic-label">{field.label || field.name} <span style={{color: 'var(--fly-yellow)'}}>*</span></label>
                                  {inputType === 'checkbox' ? (
                                    <label className="flex items-center gap-2 cursor-pointer" style={{fontSize: '0.82rem', color: '#fff', paddingTop: '0.2rem', paddingBottom: '0.2rem'}}>
                                      <input 
                                        type="checkbox" 
                                        checked={!!val} 
                                        onChange={(e) => updateDynamicField(idx, field.name, e.target.checked)} 
                                      />
                                      <span>{val ? 'Sí' : 'No'}</span>
                                    </label>
                                  ) : (field.name === 'location' || field.name === 'localizacion') ? (
                                    <select className="iv-input" value={val || ''} onChange={(e) => updateDynamicField(idx, field.name, e.target.value)}>
                                      <option value="">Seleccionar...</option>
                                      {locations?.map(loc => <option key={loc.id} value={loc.name}>{loc.name}</option>)}
                                    </select>
                                  ) : (field.name === 'brand' || field.name === 'marca') ? (
                                    <select className="iv-input" value={val || ''} onChange={(e) => updateDynamicField(idx, field.name, e.target.value)}>
                                      <option value="">Seleccionar...</option>
                                      {brands?.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                                    </select>
                                  ) : (field.name === 'subcategory' || field.name === 'subcategoria') ? (
                                    <select className="iv-input" value={val || ''} onChange={(e) => updateDynamicField(idx, field.name, e.target.value)}>
                                      <option value="">Seleccionar...</option>
                                      {subcategories?.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                    </select>
                                  ) : (
                                    <input 
                                      className="iv-input" 
                                      type={inputType} 
                                      step={inputType === 'number' ? 'any' : undefined}
                                      value={val ?? ''} 
                                      onChange={(e) => updateDynamicField(idx, field.name, e.target.value)}
                                      placeholder={`Ingresa ${field.label || field.name}...`}
                                    />
                                  )}
                                </div>
                              );
                            });
                          })()}
                          
                          <div className="iv-field">
                            <label>IVA (16%)</label>
                            <input className="iv-input" value={fmt(item.iva)} readOnly style={{ opacity: 0.7 }} />
                          </div>
                          <button 
                            className="irf-action-btn"
                            onClick={() => markAsNew(idx)}
                          >
                            <PlusCircle size={14} /> Forzar como Nuevo
                          </button>
                        </div>
                        
                        <div className="irf-matches-panel">
                          <p className="irf-matches-title">Sugerencias del Inventario:</p>
                          {item.matches.length > 0 ? (
                            <div className="irf-matches-list">
                              {item.matches.slice(0, 3).map((m, mi) => (
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
                            <p className="irf-no-matches">No se encontraron sugerencias en el inventario.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
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
