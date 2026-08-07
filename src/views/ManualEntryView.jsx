import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useInventory } from '../context/InventoryContext';
import { useCategories } from '../context/CategoriesContext';
import { toast } from 'sonner';
import { uploadFactura } from '../services/uploadFactura';
import { uploadProductPhoto } from '../services/uploadProductPhoto';
import { Package, Plus, Trash2, Save, AlertCircle, Loader2, Upload, Camera, FileImage, X, CheckCircle2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import './ManualEntryView.css';


// Campos del sistema que nunca deben aparecer en el formulario
const SYSTEM_FIELDS = ['id', 'created_at', 'updated_at', 'status', 'prestados', 'borrowedBy', 'lentBy', 'loanDate'];

const emptyLine = (category = '') => ({
  id: Date.now() + Math.random(),
  category,
});

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];

const ManualEntryView = () => {
  const { userData, isAdmin: isSystemAdmin, loading: authLoading } = useAuth();
  const { addItem, updateStock, items, locations, subcategories, loadCategoryItems } = useInventory();
  const { categories, getCategoryByTitle } = useCategories();
  const location = useLocation();
  const navigate = useNavigate();
  const preselectedCategory = location.state?.category || '';
  
  const isAdmin = isSystemAdmin || userData?.role === 'admin';
  
  const categoryTitles = useMemo(() => {
    const allTitles = categories.map(c => c.title);
    if (isAdmin) return allTitles;
    return allTitles.filter(cat => (userData?.allowedCategories || []).includes(cat));
  }, [categories, isAdmin, userData]);

  const canAdd = isAdmin || categoryTitles.length > 0;

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [lines, setLines] = useState([emptyLine(preselectedCategory)]);
  const [proveedor, setProveedor] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [facturaFile, setFacturaFile] = useState(null);
  const [facturaPreview, setFacturaPreview] = useState(null);
  const [facturaDragOver, setFacturaDragOver] = useState(false);
  const facturaFileRef = React.useRef(null);
  const facturaCameraRef = React.useRef(null);

  // Auto-cargar items de la categoría pre-seleccionada
  useEffect(() => {
    if (preselectedCategory && loadCategoryItems) {
      loadCategoryItems(preselectedCategory);
    }
  }, [preselectedCategory, loadCategoryItems]);


  const handleFacturaFile = useCallback((file) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Formato no soportado. Usa JPG, PNG, WebP o PDF.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('El archivo excede 10MB.');
      return;
    }
    setFacturaFile(file);
    if (file.type.startsWith('image/')) {
      setFacturaPreview(URL.createObjectURL(file));
    } else {
      setFacturaPreview(null);
    }
  }, []);

  const clearFactura = useCallback(() => {
    setFacturaFile(null);
    setFacturaPreview(null);
    if (facturaFileRef.current) facturaFileRef.current.value = '';
    if (facturaCameraRef.current) facturaCameraRef.current.value = '';
  }, []);





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

  const handleCategoryChange = useCallback((idx, val) => {
    updateLine(idx, 'category', val);
    if (val && loadCategoryItems) {
      loadCategoryItems(val);
    }
  }, [updateLine, loadCategoryItems]);

  const addLine = useCallback(() => setLines(prev => [...prev, emptyLine(preselectedCategory)]), [preselectedCategory]);
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
  }, [lines, getCategorySchema, facturaFile]);

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

      // Subir foto de factura a Supabase Storage (comprimida) solo si se adjuntó
      let facturaUrl = null;
      if (facturaFile) {
        try {
          facturaUrl = await uploadFactura(facturaFile);
        } catch (uploadErr) {
          toast.error('No se pudo subir la foto de factura: ' + uploadErr.message);
          setSaving(false);
          return;
        }
      }

      for (const line of lines) {
        const schema = line.category ? getCategorySchema(line.category) : [];
        
        // Construir productData con los campos exactos del schema
        const productData = { category: line.category };
        schema.forEach(field => {
          const val = line[field.name];
          if (val !== undefined && val !== '') productData[field.name] = val;
        });

        // Procesar foto_url si es un File
        if (productData.foto_url && productData.foto_url instanceof File) {
          try {
            const pUrl = await uploadProductPhoto(productData.foto_url);
            productData.foto_url = pUrl;
          } catch (uploadErr) {
            toast.error(`Error al subir la foto en la fila ${lines.indexOf(line) + 1}: ${uploadErr.message}`);
            throw uploadErr;
          }
        }
        
        // Observaciones del ingreso (sólo si hay campo en la tabla o como metadata)
        const noteStr = `Ingreso Manual${proveedor ? ' | Proveedor: ' + proveedor : ''}${observaciones ? ' | ' + observaciones : ''}${facturaUrl ? ' | factura_url:' + facturaUrl : ''}`;
        if (schema.find(f => f.name === 'observaciones')) productData.observaciones = noteStr;
        // Guardar URL de factura si la tabla tiene ese campo
        if (facturaUrl && schema.find(f => f.name === 'factura_url')) productData.factura_url = facturaUrl;
        
        // Buscar producto existente por nombre
        const productName = productData.name || '';
        const existingProduct = productName ? findProductByName(productName, line.category) : null;
        const qty = parseFloat(productData.qty) || 0;
        
        if (existingProduct && qty > 0) {
          await updateStock(existingProduct.id, qty, userName, noteStr);
        } else {
          await addItem(productData, userName, facturaUrl);
        }
      }

      toast.success(`${lines.length} productos ingresados manualmente exitosamente`);
      
      // Reset form
      setProveedor('');
      setObservaciones('');
      setLines([emptyLine()]);
      setErrors({});
      clearFactura();
      
      // Volver a inventario tras éxito
      const catObj = categories.find(c => c.title === preselectedCategory);
      if (catObj && catObj.route) {
        navigate(catObj.route);
      } else {
        navigate('/');
      }
    } catch (err) {
      console.error('Error en ingreso manual:', err);
      toast.error('Error al procesar el ingreso manual: ' + err.message);
    } finally {
      setSaving(false);
    }
  }, [validate, lines, proveedor, observaciones, userData, canAdd, addItem, updateStock, getCategorySchema, findProductByName, clearFactura, facturaFile, navigate, preselectedCategory]);

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
          <h1>Ingreso Manual de Productos<span>Con o sin evidencia de factura</span></h1>
        </div>
      </div>

      {/* Foto de Factura - OBLIGATORIO */}
      <div className={`me-card me-factura-card ${errors.factura ? 'me-card-error' : facturaFile ? 'me-card-ok' : ''}`}>
        <div className="me-factura-header">
          <FileImage size={18} />
          <span>Foto / Archivo de Factura</span>
          <span className="me-badge-required" style={{ background: 'rgba(255,255,255,0.1)', color: '#aaa' }}>OPCIONAL</span>
          {facturaFile && <CheckCircle2 size={16} className="me-factura-check" />}
        </div>

        {facturaFile ? (
          <div className="me-factura-preview-wrap">
            {facturaPreview ? (
              <img src={facturaPreview} alt="Factura" className="me-factura-preview-img" />
            ) : (
              <div className="me-factura-pdf-badge">
                <FileImage size={32} />
                <span>{facturaFile.name}</span>
              </div>
            )}
            <div className="me-factura-preview-actions">
              <span className="me-factura-filename">{facturaFile.name}</span>
              <button className="me-factura-clear" onClick={clearFactura} title="Quitar archivo">
                <X size={16} /> Cambiar
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`me-factura-dropzone ${facturaDragOver ? 'me-factura-dropzone-active' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setFacturaDragOver(true); }}
            onDragLeave={() => setFacturaDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setFacturaDragOver(false); handleFacturaFile(e.dataTransfer.files?.[0]); }}
            onClick={() => facturaFileRef.current?.click()}
          >
            <Upload size={28} />
            <p>Arrastra la factura aquí o haz clic para seleccionar</p>
            <span>JPG, PNG, WebP, PDF · Máx 10MB</span>
          </div>
        )}

        <div className="me-factura-actions">
          <button className="fly-btn fly-btn-secondary me-factura-btn" onClick={() => facturaFileRef.current?.click()}>
            <FileImage size={16} /> Subir Archivo
          </button>
          <button className="fly-btn fly-btn-secondary me-factura-btn" onClick={() => facturaCameraRef.current?.click()}>
            <Camera size={16} /> Tomar Foto
          </button>
        </div>

        <input ref={facturaFileRef} type="file" accept={ACCEPTED_TYPES.join(',')} style={{ display: 'none' }}
          onChange={(e) => handleFacturaFile(e.target.files?.[0])} />
        <input ref={facturaCameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
          onChange={(e) => handleFacturaFile(e.target.files?.[0])} />


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
                        onChange={e => handleCategoryChange(idx, e.target.value)}>
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
                          {fieldName === 'location' ? (
                            <select
                              className={`me-table-input ${hasError ? 'me-cell-error' : ''}`}
                              value={fieldValue}
                              onChange={e => updateLine(idx, fieldName, e.target.value)}>
                              <option value="">—</option>
                              {locations?.map(loc => <option key={loc.id} value={loc.name}>{loc.name}</option>)}
                            </select>
                          ) : (fieldName === 'subcategory' || fieldName === 'subcategoria') ? (
                            <select
                              className={`me-table-input ${hasError ? 'me-cell-error' : ''}`}
                              value={fieldValue}
                              onChange={e => updateLine(idx, fieldName, e.target.value)}>
                              <option value="">—</option>
                              {subcategories?.filter(sub => !sub.name.includes('::') || sub.name.startsWith(`${line.category}::`)).map(sub => {
                                const displayName = sub.name.includes('::') ? sub.name.split('::')[1] : sub.name;
                                return <option key={sub.id} value={displayName}>{displayName}</option>;
                              })}
                            </select>
                          ) : fieldName === 'foto_url' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: '100px' }}>
                              {fieldValue instanceof File ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'hsla(var(--primary), 0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', color: 'hsl(var(--primary))' }}>
                                  <CheckCircle2 size={12} /> Listo
                                  <button onClick={() => updateLine(idx, fieldName, '')} style={{ marginLeft: 4, cursor: 'pointer', opacity: 0.7 }}><X size={12}/></button>
                                </div>
                              ) : (
                                <>
                                  <label style={{ cursor: 'pointer', padding: '4px 8px', background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Subir Archivo">
                                    <FileImage size={14} />
                                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) updateLine(idx, fieldName, e.target.files[0]); }} />
                                  </label>
                                  <label style={{ cursor: 'pointer', padding: '4px 8px', background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Tomar Foto">
                                    <Camera size={14} />
                                    <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) updateLine(idx, fieldName, e.target.files[0]); }} />
                                  </label>
                                </>
                              )}
                            </div>
                          ) : inputType === 'select' && field.options ? (
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
                              list={
                                inputType === 'text' && fieldName !== 'observaciones' && fieldName !== 'descripcion'
                                  ? `dl-${line.category}-${fieldName}` 
                                  : undefined
                              }
                              className={`me-table-input ${hasError ? 'me-cell-error' : ''}`}
                              placeholder={field.label || fieldName}
                              value={fieldValue}
                              onChange={e => {
                                let val = e.target.value;
                                if (inputType === 'number' && parseFloat(val) < 0) {
                                  val = '0';
                                }
                                updateLine(idx, fieldName, val);
                              }}
                              onKeyDown={e => {
                                if (inputType === 'number' && ['e', 'E', '+', '-'].includes(e.key)) {
                                  e.preventDefault();
                                }
                              }}
                              step={inputType === 'number' ? 'any' : undefined}
                              min={inputType === 'number' ? '0' : undefined}
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

        {/* Datalists for autocompletion */}
        {Array.from(new Set(lines.map(l => l.category).filter(Boolean))).map(cat => {
          const catConfig = getCategoryByTitle(cat);
          if (!catConfig) return null;
          const schema = getCategorySchema(cat);
          const catItems = items.filter(i => i.category === cat);
          
          return schema.filter(f => dbTypeToInput(f.type) === 'text' && f.name !== 'observaciones' && f.name !== 'descripcion').map(field => {
            const uniqueValues = Array.from(new Set(catItems.map(i => i[field.name]).filter(Boolean)));
            return (
              <datalist id={`dl-${cat}-${field.name}`} key={`${cat}-${field.name}`}>
                {uniqueValues.map(val => (
                  <option key={val} value={val} />
                ))}
              </datalist>
            );
          });
        })}

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
