import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { FileText, Plus, Trash2, Save, ChevronDown, AlertCircle, CheckCircle2, List, FilePlus, ArrowLeft, DollarSign, Loader2 } from 'lucide-react';
import './InvoicesView.css';

const INVOICES_KEY = 'dicrejart_invoices';

const getInvoices = () => {
  try {
    const invoices = localStorage.getItem(INVOICES_KEY);
    return invoices ? JSON.parse(invoices) : [];
  } catch (e) {
    console.error("Error reading invoices:", e);
    return [];
  }
};

const setInvoices = (invoices) => {
  try {
    localStorage.setItem(INVOICES_KEY, JSON.stringify(invoices));
  } catch (e) {
    console.error("Error writing invoices:", e);
  }
};

const addInvoice = (invoiceData) => {
  const invoices = getInvoices();
  const newInvoice = { 
    ...invoiceData, 
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    createdAt: new Date().toISOString()
  };
  invoices.unshift(newInvoice);
  setInvoices(invoices);
  return newInvoice;
};

const deleteInvoice = (id) => {
  const invoices = getInvoices();
  const filtered = invoices.filter(i => i.id !== id);
  setInvoices(filtered);
};

const UNITS = ['PZA', 'KG', 'M', 'LT', 'ML', 'CM', 'ROLLO', 'CAJA', 'PAR', 'JGO', 'BOLSA', 'PAQUETE'];
const IVA_RATE = 0.16;

const emptyLine = () => ({
  id: Date.now() + Math.random(),
  oc: '', cantidad: '', um: 'PZA', frgnName: '', descripcion: '',
  precioUnitario: '', ivaManual: '', importeTotal: 0, ivaCalc: 0
});

const fmt = (n, currency = 'MXN') => {
  const v = parseFloat(n) || 0;
  return v.toLocaleString('es-MX', { style: 'currency', currency, minimumFractionDigits: 2 });
};

const InvoicesView = () => {
  const { userData, isAdmin: isSystemAdmin, loading: authLoading } = useAuth();
  const isAdmin = isSystemAdmin || userData?.role === 'admin';
  const canAdd = isAdmin || (userData?.allowedCategories || []).includes('Facturas');
  const canDelete = isAdmin || (userData?.editableCategories || []).includes('Facturas');

  const [tab, setTab] = useState('new');     // 'new' | 'list'
  const [invoices, setInvoices] = useState([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [viewingInvoice, setViewingInvoice] = useState(null);

  // ─── Autocomplete state ───
  const [acIndex, setAcIndex] = useState(-1);    // which line shows dropdown
  const [acResults, setAcResults] = useState([]); // matching items
  const [acHighlight, setAcHighlight] = useState(-1);
  const [savedParts, setSavedParts] = useState([]); // historical part numbers
  const inputRefs = useRef({});

  // ─── Invoice Header ───
  const [folio, setFolio] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [fechaEmision, setFechaEmision] = useState(new Date().toISOString().slice(0, 10));
  const [currency, setCurrency] = useState('MXN');
  const [tipoCambio, setTipoCambio] = useState('');

  // ─── Line Items ───
  const [lines, setLines] = useState([emptyLine()]);

  // ─── Load saved invoices ───
  useEffect(() => {
    const data = getInvoices();
    setInvoices(data);
    // Build autocomplete corpus from all saved line items
    const parts = new Map();
    data.forEach(inv => (inv.lines || []).forEach(l => {
      if (l.descripcion && !parts.has(l.descripcion)) {
        parts.set(l.descripcion, { descripcion: l.descripcion, um: l.um, frgnName: l.frgnName || '' });
      }
    }));
    setSavedParts([...parts.values()]);
  }, []);

  // ─── Line helpers ───
  const updateLine = useCallback((idx, field, value) => {
    setLines(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      const qty = parseFloat(copy[idx].cantidad) || 0;
      const price = parseFloat(copy[idx].precioUnitario) || 0;
      copy[idx].importeTotal = qty * price;
      const manIva = copy[idx].ivaManual;
      copy[idx].ivaCalc = manIva !== '' ? parseFloat(manIva) || 0 : copy[idx].importeTotal * IVA_RATE;
      return copy;
    });
  }, []);

  const addLine = useCallback(() => setLines(prev => [...prev, emptyLine()]), []);
  const removeLine = useCallback((idx) => setLines(prev => prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)), []);

  // ─── Autocomplete logic ───
  const handleDescChange = useCallback((idx, val) => {
    updateLine(idx, 'descripcion', val);
    if (val.length >= 2) {
      const lower = val.toLowerCase();
      const matches = savedParts.filter(p => p.descripcion.toLowerCase().includes(lower)).slice(0, 6);
      setAcResults(matches);
      setAcIndex(idx);
      setAcHighlight(-1);
    } else {
      setAcIndex(-1);
      setAcResults([]);
    }
  }, [updateLine, savedParts]);

  const selectAc = useCallback((idx, item) => {
    setLines(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], descripcion: item.descripcion, um: item.um || copy[idx].um, frgnName: item.frgnName || copy[idx].frgnName };
      return copy;
    });
    setAcIndex(-1);
    setAcResults([]);
  }, []);

  // ─── Keyboard nav: Enter → next field, Escape → close AC ───
  const handleKeyDown = useCallback((e, lineIdx, field) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // If AC dropdown open select highlighted
      if (field === 'descripcion' && acIndex === lineIdx && acResults.length > 0 && acHighlight >= 0) {
        selectAc(lineIdx, acResults[acHighlight]);
        return;
      }
      // Move to next focusable input
      const fields = ['oc', 'cantidad', 'um', 'frgnName', 'descripcion', 'precioUnitario', 'ivaManual'];
      const fi = fields.indexOf(field);
      let nextLine = lineIdx, nextField = fi + 1;
      if (nextField >= fields.length) { nextLine++; nextField = 0; }
      if (nextLine >= lines.length) { addLine(); nextLine = lines.length; nextField = 0; }
      const key = `${nextLine}-${fields[nextField] || fields[0]}`;
      setTimeout(() => inputRefs.current[key]?.focus(), 30);
    }
    if (e.key === 'Escape') { setAcIndex(-1); }
    if (field === 'descripcion' && acIndex === lineIdx && acResults.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setAcHighlight(h => Math.min(h + 1, acResults.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setAcHighlight(h => Math.max(h - 1, 0)); }
    }
  }, [acIndex, acResults, acHighlight, lines.length, addLine, selectAc]);

  // ─── Totals ───
  const totals = useMemo(() => {
    let subtotal = 0, iva = 0;
    lines.forEach(l => { subtotal += l.importeTotal; iva += l.ivaCalc; });
    return { subtotal, iva, total: subtotal + iva };
  }, [lines]);

  // ─── Validation ───
  const validate = useCallback(() => {
    const e = {};
    // Ya no bloqueamos por folio, proveedor o fecha para dar flexibilidad
    // Solo validamos el tipo de cambio si es USD para evitar errores de cálculo
    if (currency === 'USD' && (!tipoCambio || parseFloat(tipoCambio) <= 0)) e.tipoCambio = true;
    
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [currency, tipoCambio]);

  // ─── Save ───
  const handleSave = useCallback(async () => {
    if (!validate()) { toast.error('Completa todos los campos obligatorios'); return; }
    setSaving(true);
    try {
      // Filtramos líneas que estén totalmente vacías antes de guardar
      const validLines = lines.filter(l => 
        l.oc.trim() || l.cantidad || l.frgnName.trim() || l.descripcion.trim() || l.precioUnitario
      );

      if (validLines.length === 0 && !folio && !proveedor) {
        toast.error('La factura está vacía');
        return;
      }

      const invoiceData = {
        folio: folio.trim() || 'SIN FOLIO', 
        proveedor: proveedor.trim() || 'SIN PROVEEDOR', 
        fechaEmision: fechaEmision || new Date().toISOString().slice(0, 10),
        currency, 
        tipoCambio: currency === 'USD' ? parseFloat(tipoCambio) || 0 : null,
        lines: validLines.map(l => ({
          oc: l.oc, 
          cantidad: parseFloat(l.cantidad) || 0, 
          um: l.um,
          frgnName: l.frgnName, 
          descripcion: l.descripcion || 'Sin descripción',
          precioUnitario: parseFloat(l.precioUnitario) || 0,
          ivaManual: l.ivaManual !== '' ? parseFloat(l.ivaManual) : null,
          ivaCalc: l.ivaCalc, 
          importeTotal: l.importeTotal
        })),
        subtotal: totals.subtotal, iva: totals.iva, total: totals.total,
        createdBy: userData?.name || userData?.email || 'Sistema',
        createdAt: new Date().toISOString()
      };
      
      addInvoice(invoiceData);
      
      // Reload invoices
      const updatedInvoices = getInvoices();
      setInvoices(updatedInvoices);
      
      // Rebuild autocomplete corpus
      const parts = new Map();
      updatedInvoices.forEach(inv => (inv.lines || []).forEach(l => {
        if (l.descripcion && !parts.has(l.descripcion)) {
          parts.set(l.descripcion, { descripcion: l.descripcion, um: l.um, frgnName: l.frgnName || '' });
        }
      }));
      setSavedParts([...parts.values()]);
      
      toast.success(`Factura ${folio} guardada exitosamente`);
      // Reset form
      setFolio(''); setProveedor(''); setFechaEmision(new Date().toISOString().slice(0, 10));
      setCurrency('MXN'); setTipoCambio(''); setLines([emptyLine()]); setErrors({});
      setTab('list');
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar factura');
    } finally { setSaving(false); }
  }, [validate, folio, proveedor, fechaEmision, currency, tipoCambio, lines, totals, userData]);

  // ─── Delete Invoice ───
  const handleDelete = useCallback(async (id) => {
    if (!window.confirm('¿Eliminar esta factura permanentemente?')) return;
    try {
      deleteInvoice(id);
      setInvoices(prev => prev.filter(i => i.id !== id));
      toast.info('Factura eliminada');
      if (viewingInvoice?.id === id) setViewingInvoice(null);
    } catch { toast.error('Error al eliminar'); }
  }, [viewingInvoice]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen w-full bg-slate-950">
        <Loader2 className="animate-spin text-blue-500" size={48} />
      </div>
    );
  }

  // ─── Render: Viewing a saved invoice (read-only) ───
  if (viewingInvoice) {
    const inv = viewingInvoice;
    return (
      <div className="invoices-view">
        <div className="iv-header">
          <div className="iv-header-left">
            <button className="btn-apple-secondary" onClick={() => setViewingInvoice(null)} style={{ padding: '0.6rem 1rem' }}>
              <ArrowLeft size={18} /> Volver
            </button>
            <div>
              <h1>Factura {inv.folio}<span>{inv.proveedor} — {inv.fechaEmision}</span></h1>
            </div>
          </div>
          {canDelete && (
            <button className="btn-apple-danger" onClick={() => handleDelete(inv.id)} style={{ padding: '0.6rem 1rem' }}>
              <Trash2 size={16} /> Eliminar
            </button>
          )}
        </div>
        <div className="iv-card">
          <div className="iv-invoice-header">
            <div className="iv-field"><label>Folio</label><div className="iv-input" style={{ cursor: 'default' }}>{inv.folio}</div></div>
            <div className="iv-field"><label>Proveedor</label><div className="iv-input" style={{ cursor: 'default' }}>{inv.proveedor}</div></div>
            <div className="iv-field"><label>Fecha</label><div className="iv-input" style={{ cursor: 'default' }}>{inv.fechaEmision}</div></div>
            <div className="iv-field"><label>Moneda</label><div className="iv-input" style={{ cursor: 'default' }}>{inv.currency}{inv.tipoCambio ? ` (TC: ${inv.tipoCambio})` : ''}</div></div>
          </div>
        </div>
        <div className="iv-card">
          <div className="iv-table-wrapper">
            <table className="iv-table">
              <thead><tr>
                <th>#</th><th>OC</th><th>Cant</th><th>U.M</th><th>FrgnName</th><th>Descripción</th><th>P. Unit</th><th>IVA</th><th>Importe</th>
              </tr></thead>
              <tbody>
                {(inv.lines || []).map((l, i) => (
                  <tr key={i}>
                    <td className="iv-row-num">{i + 1}</td>
                    <td>{l.oc || '—'}</td>
                    <td>{l.cantidad}</td>
                    <td>{l.um}</td>
                    <td>{l.frgnName || '—'}</td>
                    <td>{l.descripcion}</td>
                    <td>{fmt(l.precioUnitario, inv.currency)}</td>
                    <td>{fmt(l.ivaCalc, inv.currency)}</td>
                    <td style={{ fontWeight: 700 }}>{fmt(l.importeTotal, inv.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="iv-totals">
            <div className="iv-totals-box">
              <div className="iv-total-row"><span>Subtotal</span><span className="iv-total-value">{fmt(inv.subtotal, inv.currency)}</span></div>
              <div className="iv-total-row"><span>IVA</span><span className="iv-total-value">{fmt(inv.iva, inv.currency)}</span></div>
              <div className="iv-total-row iv-grand-total"><span>Total</span><span className="iv-total-value">{fmt(inv.total, inv.currency)}</span></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main Render ───
  return (
    <div className="invoices-view">
      {/* Header */}
      <div className="iv-header">
        <div className="iv-header-left">
          <div className="iv-header-icon"><FileText size={26} /></div>
          <h1>Facturas de Materiales<span>Registro y consulta de facturas</span></h1>
        </div>
        <div className="iv-tabs">
          <button className={`iv-tab ${tab === 'new' ? 'iv-tab-active' : ''}`} onClick={() => setTab('new')}>
            <FilePlus size={16} /> Nueva
          </button>
          <button className={`iv-tab ${tab === 'list' ? 'iv-tab-active' : ''}`} onClick={() => setTab('list')}>
            <List size={16} /> Historial
            {invoices.length > 0 && <span className="iv-tab-badge">{invoices.length}</span>}
          </button>
        </div>
      </div>

      {/* ═══ TAB: New Invoice ═══ */}
      {tab === 'new' && (
        <>
          {/* Invoice Header */}
          <div className="iv-card" style={{ position: 'relative' }}>
            {saving && <div className="iv-saving-overlay"><div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid hsl(var(--border-color))', borderTopColor: 'hsl(var(--primary))', borderRadius: '50%' }} /></div>}
            <div className="iv-invoice-header">
              <div className="iv-field">
                <label>Folio de Factura</label>
                <input className={`iv-input ${errors.folio ? 'iv-input-error' : ''}`} placeholder="Opcional" value={folio} onChange={e => setFolio(e.target.value)} />
              </div>
              <div className="iv-field">
                <label>Proveedor</label>
                <input className={`iv-input ${errors.proveedor ? 'iv-input-error' : ''}`} placeholder="Opcional" value={proveedor} onChange={e => setProveedor(e.target.value)} />
              </div>
              <div className="iv-field">
                <label>Fecha de Emisión</label>
                <input type="date" className={`iv-input ${errors.fechaEmision ? 'iv-input-error' : ''}`} value={fechaEmision} onChange={e => setFechaEmision(e.target.value)} />
              </div>
              <div className="iv-field">
                <label>Moneda</label>
                <div className="iv-currency-toggle">
                  <span className={`iv-currency-label ${currency === 'MXN' ? 'active' : ''}`}>MXN</span>
                  <label className="iv-currency-switch">
                    <input type="checkbox" checked={currency === 'USD'} onChange={e => setCurrency(e.target.checked ? 'USD' : 'MXN')} />
                    <span className="iv-switch-track"><span className="iv-switch-thumb" /></span>
                  </label>
                  <span className={`iv-currency-label ${currency === 'USD' ? 'active' : ''}`}>USD</span>
                </div>
              </div>
              {currency === 'USD' && (
                <div className="iv-field">
                  <label>Tipo de Cambio</label>
                  <input type="number" step="0.01" className={`iv-input ${errors.tipoCambio ? 'iv-input-error' : ''}`} placeholder="19.50" value={tipoCambio} onChange={e => setTipoCambio(e.target.value)} />
                </div>
              )}
            </div>
          </div>

          {/* Line Items Table */}
          <div className="iv-card">
            <div className="iv-table-wrapper">
              <table className="iv-table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>#</th>
                    <th style={{ width: 110 }}>OC</th>
                    <th style={{ width: 80 }}>Cantidad</th>
                    <th style={{ width: 90 }}>U.M</th>
                    <th style={{ width: 120 }}>FrgnName</th>
                    <th style={{ minWidth: 200 }}>Nº Parte / Descripción</th>
                    <th style={{ width: 120 }}>P. Unitario</th>
                    <th style={{ width: 100 }}>IVA</th>
                    <th style={{ width: 120 }}>Importe</th>
                    <th style={{ width: 36 }} />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => (
                    <tr key={line.id}>
                      <td className="iv-row-num">{idx + 1}</td>
                      <td>
                        <input className="iv-table-input" placeholder="2026-400" value={line.oc}
                          ref={el => inputRefs.current[`${idx}-oc`] = el}
                          onChange={e => updateLine(idx, 'oc', e.target.value)}
                          onKeyDown={e => handleKeyDown(e, idx, 'oc')} />
                      </td>
                      <td>
                        <input type="number" step="0.01" className={`iv-table-input ${errors[`${idx}-qty`] ? 'iv-cell-error' : ''}`}
                          placeholder="0" value={line.cantidad}
                          ref={el => inputRefs.current[`${idx}-cantidad`] = el}
                          onChange={e => updateLine(idx, 'cantidad', e.target.value)}
                          onKeyDown={e => handleKeyDown(e, idx, 'cantidad')} />
                      </td>
                      <td>
                        <select className="iv-table-input" value={line.um}
                          ref={el => inputRefs.current[`${idx}-um`] = el}
                          onChange={e => updateLine(idx, 'um', e.target.value)}
                          onKeyDown={e => handleKeyDown(e, idx, 'um')}>
                          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </td>
                      <td>
                        <input className="iv-table-input" placeholder="—" value={line.frgnName}
                          ref={el => inputRefs.current[`${idx}-frgnName`] = el}
                          onChange={e => updateLine(idx, 'frgnName', e.target.value)}
                          onKeyDown={e => handleKeyDown(e, idx, 'frgnName')} />
                      </td>
                      <td>
                        <div className="iv-autocomplete-wrapper">
                          <input className={`iv-table-input ${errors[`${idx}-desc`] ? 'iv-cell-error' : ''}`}
                            placeholder="PLACA FOAM EPE 3&quot;" value={line.descripcion}
                            ref={el => inputRefs.current[`${idx}-descripcion`] = el}
                            onChange={e => handleDescChange(idx, e.target.value)}
                            onKeyDown={e => handleKeyDown(e, idx, 'descripcion')}
                            onBlur={() => setTimeout(() => setAcIndex(-1), 150)} />
                          {acIndex === idx && acResults.length > 0 && (
                            <div className="iv-autocomplete-dropdown">
                              {acResults.map((item, ai) => (
                                <div key={ai} className={`iv-autocomplete-item ${ai === acHighlight ? 'iv-ac-active' : ''}`}
                                  onMouseDown={() => selectAc(idx, item)}>
                                  {item.descripcion}
                                  <small>{item.um}{item.frgnName ? ` · ${item.frgnName}` : ''}</small>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <input type="number" step="0.01" className={`iv-table-input ${errors[`${idx}-price`] ? 'iv-cell-error' : ''}`}
                          placeholder="$0.00" value={line.precioUnitario}
                          ref={el => inputRefs.current[`${idx}-precioUnitario`] = el}
                          onChange={e => updateLine(idx, 'precioUnitario', e.target.value)}
                          onKeyDown={e => handleKeyDown(e, idx, 'precioUnitario')} />
                      </td>
                      <td>
                        <input type="number" step="0.01" className="iv-table-input"
                          placeholder={fmt(line.ivaCalc).replace(/[^0-9.,]/g, '')}
                          value={line.ivaManual}
                          ref={el => inputRefs.current[`${idx}-ivaManual`] = el}
                          onChange={e => updateLine(idx, 'ivaManual', e.target.value)}
                          onKeyDown={e => handleKeyDown(e, idx, 'ivaManual')} />
                      </td>
                      <td>
                        <input className="iv-table-input iv-readonly" readOnly tabIndex={-1}
                          value={fmt(line.importeTotal, currency)} />
                      </td>
                      <td>
                        <button className="iv-delete-row" onClick={() => removeLine(idx)} title="Eliminar fila">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="iv-add-row" onClick={addLine}><Plus size={18} /> Agregar línea</button>

            {/* Totals */}
            <div className="iv-totals">
              <div className="iv-totals-box">
                <div className="iv-total-row"><span>Subtotal</span><span className="iv-total-value">{fmt(totals.subtotal, currency)}</span></div>
                <div className="iv-total-row"><span>IVA (16%)</span><span className="iv-total-value">{fmt(totals.iva, currency)}</span></div>
                <div className="iv-total-row iv-grand-total"><span>Total</span><span className="iv-total-value">{fmt(totals.total, currency)}</span></div>
              </div>
            </div>

            {/* Validation feedback */}
            {Object.keys(errors).length > 0 && (
              <div className="iv-validation-msg iv-msg-error" style={{ marginTop: '1rem' }}>
                <AlertCircle size={16} /> Revisa los campos marcados en rojo (como el Tipo de Cambio).
              </div>
            )}

            {/* Footer */}
            <div className="iv-footer">
              <button className="btn-apple-secondary" onClick={() => { setLines([emptyLine()]); setFolio(''); setProveedor(''); setErrors({}); }}>
                Limpiar Todo
              </button>
              {canAdd ? (
                <button className="btn-apple-primary" onClick={handleSave} disabled={saving}>
                  <Save size={18} /> {saving ? 'Guardando...' : 'Guardar Factura'}
                </button>
              ) : (
                <div className="iv-validation-msg iv-msg-error" style={{ background: 'hsla(var(--danger), 0.1)', color: 'hsl(var(--danger))', border: '1px solid hsla(var(--danger), 0.2)' }}>
                   <AlertCircle size={16} /> No tienes permiso para registrar facturas.
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ═══ TAB: Invoice List ═══ */}
      {tab === 'list' && (
        <div className="iv-card">
          {invoices.length === 0 ? (
            <div className="iv-empty">
              <div className="iv-empty-icon"><FileText size={32} /></div>
              <h3>Sin facturas registradas</h3>
              <p>Crea tu primera factura en la pestaña "Nueva" para comenzar el registro.</p>
            </div>
          ) : (
            <div className="iv-invoices-list">
              {invoices.map(inv => (
                <div key={inv.id} className="iv-invoice-row" onClick={() => setViewingInvoice(inv)}>
                  <span className="iv-invoice-row-folio">{inv.folio}</span>
                  <span className="iv-invoice-row-provider">{inv.proveedor}</span>
                  <span className="iv-invoice-row-date">{inv.fechaEmision}</span>
                  <span className="iv-invoice-row-total">{fmt(inv.total, inv.currency)}</span>
                  <span className="iv-invoice-row-items">{(inv.lines || []).length} líneas</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InvoicesView;
