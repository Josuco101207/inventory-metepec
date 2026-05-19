import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useInventory } from '../context/InventoryContext';
import { useCategories } from '../context/CategoriesContext';
import { toast } from 'sonner';
import { Package, Plus, Trash2, Save, AlertCircle, CheckCircle2, Loader2, DollarSign } from 'lucide-react';
import './ManualEntryView.css';

const UNITS = ['PZA', 'KG', 'M', 'LT', 'ML', 'CM', 'ROLLO', 'CAJA', 'PAR', 'JGO', 'BOLSA', 'PAQUETE'];
const IVA_RATE = 0.16;

const emptyLine = (category = '') => {
  const line = {
    id: Date.now() + Math.random(),
    cantidad: '',
    um: 'PZA',
    precioUnitario: '',
    ivaManual: '',
    importeTotal: 0,
    ivaCalc: 0,
    category: category,
  };
  return line;
};

const fmt = (n, currency = 'MXN') => {
  const v = parseFloat(n) || 0;
  return v.toLocaleString('es-MX', { style: 'currency', currency, minimumFractionDigits: 2 });
};

const ManualEntryView = () => {
  const { userData, isAdmin: isSystemAdmin, loading: authLoading } = useAuth();
  const { addItem, updateStock, items } = useInventory();
  const { categories, getCategoryByTitle } = useCategories();
  
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

  // Helper para obtener el schema de una categoría
  const getCategorySchema = useCallback((categoryTitle) => {
    const cat = getCategoryByTitle(categoryTitle);
    const schema = cat?.schema || [];
    console.log('Schema for', categoryTitle, ':', schema);
    return schema;
  }, [getCategoryByTitle]);

  // Helper para mapear tipos de DB a tipos de input
  const dbTypeToInput = useCallback((dbType) => {
    if (!dbType) return 'text';
    const t = dbType.toLowerCase();
    if (t.includes('int') || t === 'float8' || t === 'numeric' || t === 'float4') return 'number';
    if (t.includes('bool')) return 'checkbox';
    if (t.includes('date') || t.includes('timestamp')) return 'date';
    return 'text';
  }, []);

  // Campos que siempre deben aparecer en cada línea (independientes del schema)
  const CORE_FIELDS = [
    { name: 'cantidad', label: 'Cantidad', type: 'number', required: true },
    { name: 'um', label: 'U.M', type: 'select', options: UNITS, required: true },
    { name: 'precioUnitario', label: 'P. Unitario', type: 'number', required: false },
  ];

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

  // Helper para buscar producto por nombre y categoría (definido antes de handleSave)
  const findProductByName = useCallback((name, category) => {
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
  }, [items]);

  // ─── Validation ───
  const validate = useCallback(() => {
    const e = {};
    
    // Validar tipo de cambio si es USD
    if (currency === 'USD' && (!tipoCambio || parseFloat(tipoCambio) <= 0)) {
      e.tipoCambio = true;
    }
    
    // Validar líneas
    lines.forEach((line, idx) => {
      if (!line.cantidad || parseFloat(line.cantidad) <= 0) {
        e[`${idx}-qty`] = true;
      }
      if (!line.category) {
        e[`${idx}-category`] = true;
      }
      
      // Validar campos requeridos del schema de la categoría
      const schema = line.category ? getCategorySchema(line.category) : [];
      schema.forEach(field => {
        if (field.name === 'name' && !line[field.name]?.trim()) {
          e[`${idx}-${field.name}`] = true;
        }
      });
    });

    setErrors(e);
    return Object.keys(e).length === 0;
  }, [currency, tipoCambio, lines, getCategorySchema]);

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
        
        // Obtener el nombre del producto (puede ser 'name' o 'descripcion' dependiendo del schema)
        const schema = line.category ? getCategorySchema(line.category) : [];
        const nameField = schema.find(f => f.name === 'name') ? 'name' : 'descripcion';
        const productName = line[nameField] || line.descripcion || 'Sin nombre';
        
        // Buscar si el producto ya existe en el inventario
        const existingProduct = findProductByName(productName, line.category);
        
        // Construir el objeto del producto con todos los campos del schema
        const productData = {
          qty: qty,
          threshold: 1,
          status: 'Disponible',
          category: line.category,
          importe: importe,
          precio_unitario: price,
          precioUnitario: price,
          iva: iva,
          unidad: line.um,
          observaciones: `Ingreso Manual | Proveedor: ${proveedor || 'N/A'} | Precio: $${price}/u | ${observaciones || ''}`,
        };
        
        // Agregar campos dinámicos del schema
        schema.forEach(field => {
          if (!['qty', 'threshold', 'status', 'importe', 'precio_unitario', 'precioUnitario', 'iva', 'unidad', 'observaciones'].includes(field.name)) {
            productData[field.name] = line[field.name];
          }
        });
        
        // Agregar campos adicionales si no están en el schema
        if (proveedor && !productData.marca) {
          productData.marca = proveedor;
        }
        
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
          await addItem(productData, userName);
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
  }, [validate, lines, proveedor, observaciones, currency, tipoCambio, userData, canAdd, addItem, updateStock, getCategorySchema, findProductByName]);

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
                <th style={{ width: 150 }}>Categoría</th>
                {lines[0]?.category && getCategorySchema(lines[0].category).filter(field => 
                  !['cantidad', 'um', 'precioUnitario', 'qty', 'id', 'created_at', 'updated_at', 'status', 'prestados', 'borrowedBy', 'lentBy', 'loanDate'].includes(field.name)
                ).map(field => (
                  <th key={field.name} style={{ minWidth: 120 }}>
                    {field.label || field.name}
                  </th>
                ))}
                <th style={{ width: 120 }}>P. Unitario</th>
                <th style={{ width: 100 }}>IVA</th>
                <th style={{ width: 120 }}>Importe</th>
                <th style={{ width: 36 }} />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => {
                const schema = line.category ? getCategorySchema(line.category) : [];
                return (
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
                      <select className={`me-table-input ${errors[`${idx}-category`] ? 'me-cell-error' : ''}`}
                        value={line.category}
                        onChange={e => updateLine(idx, 'category', e.target.value)}>
                        <option value="">Seleccionar...</option>
                        {categoryTitles.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </td>
                    {schema.map(field => {
                      const inputType = dbTypeToInput(field.type);
                      const fieldName = field.name;
                      const fieldValue = line[fieldName] || '';
                      
                      // Skip core fields that are already rendered
                      if (['cantidad', 'um', 'precioUnitario', 'qty'].includes(fieldName)) return null;
                      // Skip auto-managed fields
                      if (['id', 'created_at', 'updated_at', 'status', 'prestados', 'borrowedBy', 'lentBy', 'loanDate'].includes(fieldName)) return null;
                      
                      return (
                        <td key={fieldName}>
                          {inputType === 'select' && field.options ? (
                            <select className="me-table-input" value={fieldValue}
                              onChange={e => updateLine(idx, fieldName, e.target.value)}>
                              {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          ) : inputType === 'checkbox' ? (
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!fieldValue}
                                onChange={e => updateLine(idx, fieldName, e.target.checked)}
                              />
                              <span>{fieldValue ? 'Sí' : 'No'}</span>
                            </label>
                          ) : (
                            <input
                              type={inputType}
                              className="me-table-input"
                              placeholder={field.label || fieldName}
                              value={fieldValue}
                              onChange={e => updateLine(idx, fieldName, e.target.value)}
                              step={inputType === 'number' ? 'any' : undefined}
                              required={fieldName === 'name'}
                            />
                          )}
                        </td>
                      );
                    })}
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
                );
              })}
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
