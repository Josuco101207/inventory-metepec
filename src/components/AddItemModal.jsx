import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, Plus, Camera, Upload, FileImage, CheckCircle2 } from 'lucide-react';
import { useCategories } from '../context/CategoriesContext';
import { useInventory } from '../context/InventoryContext';
import { uploadProductPhoto } from '../services/uploadProductPhoto';
import { toast } from 'sonner';
import './ActionModal.css';
import './AddItemModal.css';
import useIsMobile from '../hooks/useIsMobile';
import BottomSheet from './BottomSheet';

/**
 * Map DB column types to input types
 */
const dbTypeToInput = (dbType) => {
  if (!dbType) return 'text';
  const t = dbType.toLowerCase();
  if (t.includes('int') || t === 'float8' || t === 'numeric' || t === 'float4') return 'number';
  if (t.includes('bool')) return 'checkbox';
  if (t.includes('date') || t.includes('timestamp')) return 'date';
  return 'text';
};

const defaultForType = (dbType) => {
  const input = dbTypeToInput(dbType);
  if (input === 'number') return 0;
  if (input === 'checkbox') return false;
  return '';
};

// Fields that are auto-managed and should NOT appear in the form
const HIDDEN_FIELDS = [
  'id', 'created_at', 'updated_at',
  // Managed by loan/return/maintenance system
  'status', 'prestados', 'borrowedBy', 'lentBy', 'loanDate',
];

const AddItemModal = ({ isOpen, onClose, category, onSave, initialData }) => {
  const { getCategoryByTitle } = useCategories();
  const { locations, items, subcategories, brands } = useInventory();

  // Get schema from the category
  const catConfig = useMemo(() => getCategoryByTitle(category) || {}, [category, getCategoryByTitle]);
  const schema = useMemo(() => catConfig.schema || [], [catConfig]);
  const zoneColor = useMemo(() => catConfig?.zone || 'arcade', [catConfig]);

  // Visible fields = schema minus hidden ones
  const visibleFields = useMemo(() =>
    schema.filter(f => !HIDDEN_FIELDS.includes(f.name)),
    [schema]
  );

  // Build blank form from schema
  const blankForm = useMemo(() => {
    const form = {};
    visibleFields.forEach(f => {
      form[f.name] = defaultForType(f.type);
    });
    return form;
  }, [visibleFields]);

  const [formData, setFormData] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoDragOver, setPhotoDragOver] = useState(false);
  const photoFileRef = React.useRef(null);
  const photoCameraRef = React.useRef(null);
  const { isMobile } = useIsMobile();

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({ ...blankForm, ...initialData });
        setPhotoPreview(initialData.foto_url || null);
      } else {
        setFormData({ ...blankForm });
        setPhotoPreview(null);
      }
      setPhotoFile(null);
    }
  }, [category, isOpen, initialData, blankForm]);

  if (!isOpen) return null;

  const handlePhotoFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten imágenes para la foto del producto.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('La imagen excede 10MB.');
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const clearPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (photoFileRef.current) photoFileRef.current.value = '';
    if (photoCameraRef.current) photoCameraRef.current.value = '';
    setFormData(prev => ({ ...prev, foto_url: '' }));
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked
        : (dbTypeToInput(schema.find(f => f.name === name)?.type) === 'number' ? (parseFloat(value) || 0) : value)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let finalData = { ...formData };
      
      if (photoFile) {
        try {
          const url = await uploadProductPhoto(photoFile);
          finalData.foto_url = url;
        } catch (uploadErr) {
          toast.error('No se pudo subir la foto: ' + uploadErr.message);
          setSaving(false);
          return;
        }
      }

      await onSave(finalData);
      onClose();
      setFormData({ ...blankForm });
      clearPhoto();
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  };

  if (isMobile) {
    return (
      <BottomSheet isOpen={isOpen} onClose={onClose} title={`${initialData ? 'Editar' : 'Nuevo'} Artículo`}>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            {visibleFields.length === 0 ? (
              <p style={{ padding: '2rem', textAlign: 'center', fontSize: '0.8rem', opacity: 0.5 }}>
                Esta categoría no tiene columnas definidas.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {visibleFields.map(field => {
                  const inputType = dbTypeToInput(field.type);
                  return (
                    <div className="f-group" key={field.name}>
                      <label>{field.label || field.name}</label>
                      {(field.name === 'observaciones' || field.name === 'descripcion') ? (
                        <textarea name={field.name} placeholder={`Ingresa ${field.label || field.name}...`} onChange={handleChange} value={formData[field.name] || ''} style={{ width: '100%', padding: '0.75rem', height: '5rem', resize: 'none' }} />
                      ) : inputType === 'checkbox' ? (
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                          <input type="checkbox" name={field.name} checked={!!formData[field.name]} onChange={handleChange} />
                          <span>{formData[field.name] ? 'Sí' : 'No'}</span>
                        </label>
                      ) : field.name === 'foto_url' ? (
                        <div className={`me-factura-card ${photoFile ? 'me-card-ok' : ''}`} style={{ marginBottom: 0 }}>
                          {photoPreview ? (
                            <div className="me-factura-preview-wrap">
                              <img src={photoPreview} alt="Producto" className="me-factura-preview-img" style={{ maxHeight: 150 }} />
                              <div className="me-factura-preview-actions">
                                <button type="button" className="me-factura-clear" onClick={clearPhoto} title="Quitar foto">
                                  <X size={16} /> Cambiar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              className={`me-factura-dropzone ${photoDragOver ? 'me-factura-dropzone-active' : ''}`}
                              style={{ padding: '1rem', minHeight: '100px' }}
                              onDragOver={(e) => { e.preventDefault(); setPhotoDragOver(true); }}
                              onDragLeave={() => setPhotoDragOver(false)}
                              onDrop={(e) => { e.preventDefault(); setPhotoDragOver(false); handlePhotoFile(e.dataTransfer.files?.[0]); }}
                              onClick={() => photoFileRef.current?.click()}
                            >
                              <Upload size={20} />
                              <p style={{ fontSize: '0.75rem' }}>Añadir foto del producto</p>
                            </div>
                          )}
                          <div className="me-factura-actions" style={{ padding: '0.5rem' }}>
                            <button type="button" className="fly-btn fly-btn-secondary me-factura-btn" onClick={() => photoFileRef.current?.click()}>
                              <FileImage size={14} /> Archivo
                            </button>
                            <button type="button" className="fly-btn fly-btn-secondary me-factura-btn" onClick={() => photoCameraRef.current?.click()}>
                              <Camera size={14} /> Cámara
                            </button>
                          </div>
                          <input ref={photoFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handlePhotoFile(e.target.files?.[0])} />
                          <input ref={photoCameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => handlePhotoFile(e.target.files?.[0])} />
                        </div>
                      ) : (field.name === 'location' || field.name === 'localizacion') ? (
                        <select
                          name={field.name}
                          value={formData[field.name] || ''}
                          onChange={handleChange}
                          style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--surface)' }}
                        >
                          <option value="">Seleccionar ubicación...</option>
                          {locations.map(loc => (
                            <option key={loc.id} value={loc.name}>{loc.name}</option>
                          ))}
                        </select>
                      ) : (field.name === 'brand' || field.name === 'marca') ? (
                        <select
                          name={field.name}
                          value={formData[field.name] || ''}
                          onChange={handleChange}
                          style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--surface)' }}
                        >
                          <option value="">Seleccionar marca...</option>
                          {brands.map(b => (
                            <option key={b.id} value={b.name}>{b.name}</option>
                          ))}
                        </select>
                      ) : (field.name === 'subcategory' || field.name === 'subcategoria') ? (
                        <select
                          name={field.name}
                          value={formData[field.name] || ''}
                          onChange={handleChange}
                          style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--surface)' }}
                        >
                          <option value="">Seleccionar subcategoría...</option>
                          {subcategories.map(sub => (
                            <option key={sub.id} value={sub.name}>{sub.name}</option>
                          ))}
                        </select>
                      ) : (
                        <input type={inputType} name={field.name} placeholder={`Ingresa ${field.label || field.name}...`} value={formData[field.name] ?? ''} onChange={handleChange} step={inputType === 'number' ? 'any' : undefined} required={field.name === 'name'} style={{ width: '100%' }} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '1rem', paddingTop: '0.5rem' }}>
            <button type="button" className="btn-apple-secondary flex-1" onClick={onClose}>Cancelar</button>
            <button type="submit" className={`btn-fly-primary btn-fly-${zoneColor} flex-1`} disabled={saving || visibleFields.length === 0}>
              {saving ? 'Guardando...' : (initialData ? 'Guardar' : 'Crear')}
            </button>
          </div>
        </form>
      </BottomSheet>
    );
  }

  return (
    <div className="modal-overlay">
      <div className={`modal-card add-item-modal animate-scale-up add-modal-${zoneColor}`}>
        <header className={`modal-header add-modal-header-${zoneColor}`}>
          <div className="add-modal-badge">
            <Plus size={16} />
            <span>{category.toUpperCase()}</span>
          </div>
          <h3>{initialData ? 'Editar' : 'Nuevo'} Artículo</h3>
          <p>Completa los campos definidos para esta categoría.</p>
          <button type="button" className="modal-close-btn" onClick={onClose}><X size={20} /></button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="form-scroll-content">
            <div className="main-fields mb-6">
              {visibleFields.length === 0 ? (
                <p className="text-xs text-muted italic" style={{ padding: '2rem', textAlign: 'center' }}>
                  Esta categoría no tiene columnas definidas. Ve a Base de Datos para configurarla.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {visibleFields.map(field => {
                    const inputType = dbTypeToInput(field.type);
                    const isWide = field.name === 'name' || field.name === 'observaciones' || field.name === 'descripcion' || field.name === 'foto_url' || inputType === 'checkbox';

                    return (
                      <div className={`f-group ${isWide ? 'col-span-2' : ''}`} key={field.name}>
                        <label>{field.label || field.name}</label>
                        {(field.name === 'observaciones' || field.name === 'descripcion') ? (
                          <textarea
                            name={field.name}
                            placeholder={`Ingresa ${field.label || field.name}...`}
                            onChange={handleChange}
                            value={formData[field.name] || ''}
                            className="w-full p-3 h-20"
                            style={{ resize: 'none' }}
                          />
                        ) : inputType === 'checkbox' ? (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              name={field.name}
                              checked={!!formData[field.name]}
                              onChange={handleChange}
                            />
                            <span>{formData[field.name] ? 'Sí' : 'No'}</span>
                          </label>
                        ) : field.name === 'foto_url' ? (
                          <div className={`me-factura-card ${photoFile ? 'me-card-ok' : ''}`} style={{ marginBottom: 0 }}>
                            {photoPreview ? (
                              <div className="me-factura-preview-wrap">
                                <img src={photoPreview} alt="Producto" className="me-factura-preview-img" style={{ maxHeight: 150 }} />
                                <div className="me-factura-preview-actions">
                                  <button type="button" className="me-factura-clear" onClick={clearPhoto} title="Quitar foto">
                                    <X size={16} /> Cambiar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div
                                className={`me-factura-dropzone ${photoDragOver ? 'me-factura-dropzone-active' : ''}`}
                                style={{ padding: '1.5rem', minHeight: '120px' }}
                                onDragOver={(e) => { e.preventDefault(); setPhotoDragOver(true); }}
                                onDragLeave={() => setPhotoDragOver(false)}
                                onDrop={(e) => { e.preventDefault(); setPhotoDragOver(false); handlePhotoFile(e.dataTransfer.files?.[0]); }}
                                onClick={() => photoFileRef.current?.click()}
                              >
                                <Upload size={24} />
                                <p style={{ fontSize: '0.85rem' }}>Arrastra la foto aquí o haz clic</p>
                              </div>
                            )}
                            <div className="me-factura-actions" style={{ padding: '0.75rem' }}>
                              <button type="button" className="fly-btn fly-btn-secondary me-factura-btn" onClick={() => photoFileRef.current?.click()}>
                                <FileImage size={16} /> Subir Archivo
                              </button>
                              <button type="button" className="fly-btn fly-btn-secondary me-factura-btn" onClick={() => photoCameraRef.current?.click()}>
                                <Camera size={16} /> Tomar Foto
                              </button>
                            </div>
                            <input ref={photoFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handlePhotoFile(e.target.files?.[0])} />
                            <input ref={photoCameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => handlePhotoFile(e.target.files?.[0])} />
                          </div>
                        ) : (field.name === 'location' || field.name === 'localizacion') ? (
                          <select
                            name={field.name}
                            value={formData[field.name] || ''}
                            onChange={handleChange}
                            className="w-full"
                          >
                            <option value="">Seleccionar ubicación...</option>
                            {locations.map(loc => (
                              <option key={loc.id} value={loc.name}>{loc.name}</option>
                            ))}
                          </select>
                        ) : (field.name === 'brand' || field.name === 'marca') ? (
                          <select
                            name={field.name}
                            value={formData[field.name] || ''}
                            onChange={handleChange}
                            className="w-full"
                          >
                            <option value="">Seleccionar marca...</option>
                            {brands.map(b => (
                              <option key={b.id} value={b.name}>{b.name}</option>
                            ))}
                          </select>
                        ) : (field.name === 'subcategory' || field.name === 'subcategoria') ? (
                          <select
                            name={field.name}
                            value={formData[field.name] || ''}
                            onChange={handleChange}
                            className="w-full"
                          >
                            <option value="">Seleccionar subcategoría...</option>
                            {subcategories.map(sub => (
                              <option key={sub.id} value={sub.name}>{sub.name}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={inputType}
                            name={field.name}
                            placeholder={`Ingresa ${field.label || field.name}...`}
                            value={formData[field.name] ?? ''}
                            onChange={handleChange}
                            step={inputType === 'number' ? 'any' : undefined}
                            required={field.name === 'name'}
                            className="w-full"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="form-button-footer">
            <div className="flex gap-4">
              <button type="button" className="btn-apple-secondary flex-1" onClick={onClose}>Cancelar</button>
              <button type="submit" className={`btn-fly-primary btn-fly-${zoneColor} flex-1`} disabled={saving || visibleFields.length === 0}>
                <Save size={18} /> {saving ? 'Guardando...' : (initialData ? 'Guardar Cambios' : 'Crear Artículo')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddItemModal;
