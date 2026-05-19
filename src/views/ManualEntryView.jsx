import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useInventory } from '../context/InventoryContext';
import { useCategories } from '../context/CategoriesContext';
import { toast } from 'sonner';
import { Package, Plus, Trash2, Save, AlertCircle, Loader2 } from 'lucide-react';
import './ManualEntryView.css';


// Campos del sistema que nunca deben aparecer en el formulario
const SYSTEM_FIELDS = ['id', 'created_at', 'updated_at', 'status', 'prestados', 'borrowedBy', 'lentBy', 'loanDate'];

const emptyLine = (category = '') => ({
  id: Date.now() + Math.random(),
  category,
});

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


  const categoryTitles = useMemo(() => categories.map(c => c.title), [categories]);

  // Helper para obtener el schema de una categoría (sin campos del sistema)
  const getCategorySchema = useCallback((categoryTitle) => {
    const cat = getCategoryByTitle(categoryTitle);
    const schema = cat?.schema || [];
    return schema.filter(f => !SYSTEM_FIELDS.includes(f.name));
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

  // ─── Line helpers ───
  const updateLine = useCallback((idx, field, value) => {
    setLines(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  }, []);

  const addLine = useCallback(() => setLines(prev => [...prev, emptyLine()]), []);
  const removeLine = useCallback((idx) => setLines(prev => prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)), []);

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
    
    lines.forEach((line, idx) => {
      if (!line.category) {
        e[`${idx}-category`] = true;
        return;
      }
      // Validar todos los campos que sean 'not null' según el schema
      const schema = getCategorySchema(line.category);
      schema.forEach(field => {
        const val = line[field.name];
        const isEmpty = val === undefined || val === null || val === '';
        // qty siempre requerido
        if (field.name === 'qty' && (isEmpty || parseFloat(val) <= 0)) {
          e[`${idx}-${field.name}`] = true;
        }
        // cualquier campo tipo text con name=name es requerido
        if (field.name === 'name' && typeof val === 'string' && !val.trim()) {
          e[`${idx}-${field.name}`] = true;
        }
      });
    });

    setErrors(e);
    return Object.keys(e).length === 0;
  }, [lines, getCategorySchema]);

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
        const schema = line.category ? getCategorySchema(line.category) : [];
        
        // Construir productData con los campos exactos del schema
        const productData = { category: line.category };
        schema.forEach(field => {
          const val = line[field.name];
          if (val !== undefined && val !== '') productData[field.name] = val;
        });
        
        // Observaciones del ingreso (sólo si hay campo en la tabla o como metadata)
        const noteStr = `Ingreso Manual${proveedor ? ' | Proveedor: ' + proveedor : ''}${observaciones ? ' | ' + observaciones : ''}`;
        if (schema.find(f => f.name === 'observaciones')) productData.observaciones = noteStr;
        
        // Buscar producto existente por nombre
        const productName = productData.name || '';
        const existingProduct = productName ? findProductByName(productName, line.category) : null;
        const qty = parseFloat(productData.qty) || 0;
        
        if (existingProduct && qty > 0) {
          await updateStock(existingProduct.id, qty, userName, noteStr);
        } else {
          await addItem(productData, userName);
        }
      }

      toast.success(`${lines.length} productos ingresados manualmente exitosamente`);
      
      // Reset form
      setProveedor('');
      setObservaciones('');
      setLines([emptyLine()]);
      setErrors({});
    } catch (err) {
      console.error('Error en ingreso manual:', err);
      toast.error('Error al procesar el ingreso manual: ' + err.message);
    } finally {
      setSaving(false);
    }
  }, [validate, lines, proveedor, observaciones, userData, canAdd, addItem, updateStock, getCategorySchema, findProductByName]);

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
            <input className="me-input" placeholder="Nombre del proveedor" value={proveedor} onChange={e => setProveedor(e.target.value)} />
          </div>
          <div className="me-field me-field-full">
            <label>Observaciones (Opcional)</label>
            <input className="me-input" placeholder="Notas adicionales sobre el ingreso..." value={observaciones} onChange={e => setObservaciones(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="me-card">
        <div className="me-table-wrapper">
          <table className="me-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th style={{ width: 160 }}>Categoría</th>
                {/* Columnas dinámicas basadas en el schema de la primera línea con categoría */}
                {(() => {
                  const firstCat = lines.find(l => l.category)?.category;
                  if (!firstCat) return null;
                  return getCategorySchema(firstCat).map(field => (
                    <th key={field.name} style={{ minWidth: 130 }}>
                      {field.label || field.name}
                    </th>
                  ));
                })()}
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
                      <select
                        className={`me-table-input ${errors[`${idx}-category`] ? 'me-cell-error' : ''}`}
                        value={line.category}
                        onChange={e => updateLine(idx, 'category', e.target.value)}>
                        <option value="">Seleccionar...</option>
                        {categoryTitles.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </td>
                    {schema.length === 0 && (
                      <td colSpan={99} style={{ opacity: 0.4, fontSize: '0.8rem', padding: '0.5rem' }}>
                        Selecciona una categoría para ver sus campos
                      </td>
                    )}
                    {schema.map(field => {
                      const inputType = dbTypeToInput(field.type);
                      const fieldName = field.name;
                      const fieldValue = line[fieldName] ?? '';
                      const hasError = !!errors[`${idx}-${fieldName}`];

                      return (
                        <td key={fieldName}>
                          {inputType === 'select' && field.options ? (
                            <select
                              className={`me-table-input ${hasError ? 'me-cell-error' : ''}`}
                              value={fieldValue}
                              onChange={e => updateLine(idx, fieldName, e.target.value)}>
                              <option value="">—</option>
                              {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          ) : inputType === 'checkbox' ? (
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '0.25rem' }}>
                              <input
                                type="checkbox"
                                checked={!!fieldValue}
                                onChange={e => updateLine(idx, fieldName, e.target.checked)}
                              />
                              <span style={{ fontSize: '0.8rem' }}>{fieldValue ? 'Sí' : 'No'}</span>
                            </label>
                          ) : (
                            <input
                              type={inputType}
                              className={`me-table-input ${hasError ? 'me-cell-error' : ''}`}
                              placeholder={field.label || fieldName}
                              value={fieldValue}
                              onChange={e => updateLine(idx, fieldName, e.target.value)}
                              step={inputType === 'number' ? 'any' : undefined}
                            />
                          )}
                        </td>
                      );
                    })}
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
