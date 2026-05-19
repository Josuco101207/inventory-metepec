import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useInventory } from '../context/InventoryContext';
import { useCategories } from '../context/CategoriesContext';
import { toast } from 'sonner';
import { Package, Plus, Trash2, Save, AlertCircle, CheckCircle2, Loader2, DollarSign } from 'lucide-react';
import './ManualEntryView.css';

const UNITS = ['PZA', 'KG', 'M', 'LT', 'ML', 'CM', 'ROLLO', 'CAJA', 'PAR', 'JGO', 'BOLSA', 'PAQUETE'];
const IVA_RATE = 0.16;

const emptyLine = () => ({
  id: Date.now() + Math.random(),
  cantidad: '',
  um: 'PZA',
  frgnName: '',
  descripcion: '',
  precioUnitario: '',
  ivaManual: '',
  importeTotal: 0,
  ivaCalc: 0,
  category: '',
  marca: '',
  location: '',
  subcategory: ''
});

const fmt = (n, currency = 'MXN') => {
  const v = parseFloat(n) || 0;
  return v.toLocaleString('es-MX', { style: 'currency', currency, minimumFractionDigits: 2 });
};

const ManualEntryView = () => {
  const { userData, isAdmin: isSystemAdmin, loading: authLoading } = useAuth();
  const { addItem, updateStock, items } = useInventory();
  const { categories } = useCategories();
  
  const isAdmin = isSystemAdmin || userData?.role === 'admin';
  const canAdd = isAdmin || (userData?.allowedCategories || []).includes('Ingreso Manual');

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [lines, setLines] = useState([emptyLine()]);
  const [proveedor, setProveedor] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [currency, setCurrency] = useState('MXN');
  const [tipoCambio, setTipoCambio] = useState('');

  const categoryTitles = useMemo(() => categories.map(c => c.title), [categories]);

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

  // ─── Totals ───
  const totals = useMemo(() => {
    let subtotal = 0, iva = 0;
    lines.forEach(l => { subtotal += l.importeTotal; iva += l.ivaCalc; });
    return { subtotal, iva, total: subtotal + iva };
  }, [lines]);

  // ─── Validation ───
  const validate = useCallback(() => {
    const e = {};
    
    // Validar tipo de cambio si es USD
    if (currency === 'USD' && (!tipoCambio || parseFloat(tipoCambio) <= 0)) {
      e.tipoCambio = true;
    }
    
    // Validar líneas
    lines.forEach((line, idx) => {
      if (!line.descripcion.trim()) {
        e[`${idx}-desc`] = true;
      }
      if (!line.cantidad || parseFloat(line.cantidad) <= 0) {
        e[`${idx}-qty`] = true;
      }
      if (!line.category) {
        e[`${idx}-category`] = true;
      }
    });

    setErrors(e);
    return Object.keys(e).length === 0;
  }, [currency, tipoCambio, lines]);

  // ─── Save ───
  const handleSave = useCallback(async () => {
    if (!validate()) {
      toast.error('Completa todos los campos obligatorios');
      return;
    }
    
    if (!canAdd) {
      toast.error('No tienes permiso para realizar ingresos manuales');
      return;
    }

    setSaving(true);
    try {
      const userName = userData?.name || userData?.email || 'Sistema';
      
      for (const line of lines) {
        const qty = parseFloat(line.cantidad) || 0;
        const price = parseFloat(line.precioUnitario) || 0;
        const importe = qty * price;
        const iva = line.ivaManual !== '' ? parseFloat(line.ivaManual) : importe * IVA_RATE;
        
        // Buscar si el producto ya existe en el inventario
        const existingProduct = findProductByName(line.descripcion, line.category);
        
        if (existingProduct) {
          // Actualizar stock del producto existente
          await updateStock(
            existingProduct.id,
            qty,
            userName,
            `Ingreso Manual | Proveedor: ${proveedor || 'N/A'} | ${observaciones || ''}`
          );
        } else {
          // Crear nuevo producto
          await addItem({
            name: line.descripcion,
            qty: qty,
            threshold: 1,
            marca: line.marca || proveedor || '',
            location: line.location || '',
            status: 'Disponible',
            subcategory: line.subcategory || '',
            observaciones: `Ingreso Manual | Proveedor: ${proveedor || 'N/A'} | Precio: $${price}/u | ${observaciones || ''}`,
            category: line.category,
            importe: importe,
            precio_unitario: price,
            precioUnitario: price,
            iva: iva,
            unidad: line.um,
          }, userName);
        }
      }

      toast.success(`${lines.length} productos ingresados manualmente exitosamente`);
      
      // Reset form
      setProveedor('');
      setObservaciones('');
      setCurrency('MXN');
      setTipoCambio('');
      setLines([emptyLine()]);
      setErrors({});
    } catch (err) {
      console.error('Error en ingreso manual:', err);
      toast.error('Error al procesar el ingreso manual: ' + err.message);
    } finally {
      setSaving(false);
    }
  }, [validate, lines, proveedor, observaciones, currency, tipoCambio, userData, canAdd, addItem, updateStock]);

  // Helper para buscar producto por nombre y categoría
  const findProductByName = (name, category) => {
    // Buscar producto exacto por nombre y categoría
    const exactMatch = items.find(
      item => item.name.toLowerCase() === name.toLowerCase() && item.category === category
    );
    
    if (exactMatch) return exactMatch;
    
    // Si no hay coincidencia exacta, buscar solo por nombre (ignorando categoría)
    const nameMatch = items.find(
      item => item.name.toLowerCase() === name.toLowerCase()
    );
    
    return nameMatch || null;
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen w-full bg-slate-950">
        <Loader2 className="animate-spin text-blue-500" size={48} />
      </div>
    );
  }

  return (
    <div className="manual-entry-view">
      {/* Header */}
      <div className="me-header">
        <div className="me-header-left">
          <div className="me-header-icon"><Package size={26} /></div>
          <h1>Ingreso Manual de Productos<span>Registro sin factura</span></h1>
        </div>
      </div>

      {/* Info Section */}
      <div className="me-card me-info-card">
        <div className="me-info-content">
          <AlertCircle size={20} className="me-info-icon" />
          <div className="me-info-text">
            <h3>Ingreso Manual</h3>
            <p>Este modo permite ingresar productos sin factura. El sistema registrará el movimiento pero no validará cantidades contra ningún documento.</p>
          </div>
        </div>
      </div>

      {/* Header Fields */}
      <div className="me-card" style={{ position: 'relative' }}>
        {saving && <div className="me-saving-overlay"><div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid hsl(var(--border-color))', borderTopColor: 'hsl(var(--primary))', borderRadius: '50%' }} /></div>}
        <div className="me-form-header">
          <div className="me-field">
            <label>Proveedor (Opcional)</label>
            <input className={`me-input ${errors.proveedor ? 'me-input-error' : ''}`} placeholder="Nombre del proveedor" value={proveedor} onChange={e => setProveedor(e.target.value)} />
          </div>
          <div className="me-field">
            <label>Moneda</label>
            <div className="me-currency-toggle">
              <span className={`me-currency-label ${currency === 'MXN' ? 'active' : ''}`}>MXN</span>
              <label className="me-currency-switch">
                <input type="checkbox" checked={currency === 'USD'} onChange={e => setCurrency(e.target.checked ? 'USD' : 'MXN')} />
                <span className="me-switch-track"><span className="me-switch-thumb" /></span>
              </label>
              <span className={`me-currency-label ${currency === 'USD' ? 'active' : ''}`}>USD</span>
            </div>
          </div>
          {currency === 'USD' && (
            <div className="me-field">
              <label>Tipo de Cambio</label>
              <input type="number" step="0.01" className={`me-input ${errors.tipoCambio ? 'me-input-error' : ''}`} placeholder="19.50" value={tipoCambio} onChange={e => setTipoCambio(e.target.value)} />
            </div>
          )}
        </div>
        <div className="me-field me-field-full">
          <label>Observaciones (Opcional)</label>
          <input className="me-input" placeholder="Notas adicionales sobre el ingreso..." value={observaciones} onChange={e => setObservaciones(e.target.value)} />
        </div>
      </div>

      {/* Line Items Table */}
      <div className="me-card">
        <div className="me-table-wrapper">
          <table className="me-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th style={{ width: 80 }}>Cantidad</th>
                <th style={{ width: 90 }}>U.M</th>
                <th style={{ width: 120 }}>FrgnName</th>
                <th style={{ minWidth: 200 }}>Descripción</th>
                <th style={{ width: 150 }}>Categoría</th>
                <th style={{ width: 120 }}>P. Unitario</th>
                <th style={{ width: 100 }}>IVA</th>
                <th style={{ width: 120 }}>Importe</th>
                <th style={{ width: 36 }} />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={line.id}>
                  <td className="me-row-num">{idx + 1}</td>
                  <td>
                    <input type="number" step="0.01" className={`me-table-input ${errors[`${idx}-qty`] ? 'me-cell-error' : ''}`}
                      placeholder="0" value={line.cantidad}
                      onChange={e => updateLine(idx, 'cantidad', e.target.value)} />
                  </td>
                  <td>
                    <select className="me-table-input" value={line.um}
                      onChange={e => updateLine(idx, 'um', e.target.value)}>
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>
                  <td>
                    <input className="me-table-input" placeholder="—" value={line.frgnName}
                      onChange={e => updateLine(idx, 'frgnName', e.target.value)} />
                  </td>
                  <td>
                    <input className={`me-table-input ${errors[`${idx}-desc`] ? 'me-cell-error' : ''}`}
                      placeholder="Nombre del producto" value={line.descripcion}
                      onChange={e => updateLine(idx, 'descripcion', e.target.value)} />
                  </td>
                  <td>
                    <select className={`me-table-input ${errors[`${idx}-category`] ? 'me-cell-error' : ''}`}
                      value={line.category}
                      onChange={e => updateLine(idx, 'category', e.target.value)}>
                      <option value="">Seleccionar...</option>
                      {categoryTitles.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </td>
                  <td>
                    <input type="number" step="0.01" className="me-table-input"
                      placeholder="$0.00" value={line.precioUnitario}
                      onChange={e => updateLine(idx, 'precioUnitario', e.target.value)} />
                  </td>
                  <td>
                    <input type="number" step="0.01" className="me-table-input"
                      placeholder={fmt(line.ivaCalc).replace(/[^0-9.,]/g, '')}
                      value={line.ivaManual}
                      onChange={e => updateLine(idx, 'ivaManual', e.target.value)} />
                  </td>
                  <td>
                    <input className="me-table-input me-readonly" readOnly tabIndex={-1}
                      value={fmt(line.importeTotal, currency)} />
                  </td>
                  <td>
                    <button className="me-delete-row" onClick={() => removeLine(idx)} title="Eliminar fila">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="me-add-row" onClick={addLine}><Plus size={18} /> Agregar línea</button>

        {/* Totals */}
        <div className="me-totals">
          <div className="me-totals-box">
            <div className="me-total-row"><span>Subtotal</span><span className="me-total-value">{fmt(totals.subtotal, currency)}</span></div>
            <div className="me-total-row"><span>IVA (16%)</span><span className="me-total-value">{fmt(totals.iva, currency)}</span></div>
            <div className="me-total-row me-grand-total"><span>Total</span><span className="me-total-value">{fmt(totals.total, currency)}</span></div>
          </div>
        </div>

        {/* Validation feedback */}
        {Object.keys(errors).length > 0 && (
          <div className="me-validation-msg me-msg-error" style={{ marginTop: '1rem' }}>
            <AlertCircle size={16} /> Revisa los campos marcados en rojo.
          </div>
        )}

        {/* Footer */}
        <div className="me-footer">
          <button className="btn-apple-secondary" onClick={() => { setLines([emptyLine()]); setProveedor(''); setObservaciones(''); setErrors({}); }}>
            Limpiar Todo
          </button>
          {canAdd ? (
            <button className="btn-apple-primary" onClick={handleSave} disabled={saving}>
              <Save size={18} /> {saving ? 'Guardando...' : 'Procesar Ingreso Manual'}
            </button>
          ) : (
            <div className="me-validation-msg me-msg-error" style={{ background: 'hsla(var(--danger), 0.1)', color: 'hsl(var(--danger))', border: '1px solid hsla(var(--danger), 0.2)' }}>
               <AlertCircle size={16} /> No tienes permiso para realizar ingresos manuales.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManualEntryView;
