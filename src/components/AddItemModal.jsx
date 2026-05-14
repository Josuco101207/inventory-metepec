import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, Plus } from 'lucide-react';
import { useCategories } from '../context/CategoriesContext';
import './ActionModal.css';
import './AddItemModal.css';

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
const HIDDEN_FIELDS = ['id', 'created_at', 'updated_at'];

const AddItemModal = ({ isOpen, onClose, category, onSave, initialData }) => {
  const { getCategoryByTitle } = useCategories();

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

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // Merge initial data with blank form to ensure all fields exist
        setFormData({ ...blankForm, ...initialData });
      } else {
        setFormData({ ...blankForm });
      }
    }
  }, [category, isOpen, initialData, blankForm]);

  if (!isOpen) return null;

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
      await onSave({ ...formData });
      onClose();
      setFormData({ ...blankForm });
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  };

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
          <div className="main-fields mb-6">
            {visibleFields.length === 0 ? (
              <p className="text-xs text-muted italic" style={{ padding: '2rem', textAlign: 'center' }}>
                Esta categoría no tiene columnas definidas. Ve a Base de Datos para configurarla.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {visibleFields.map(field => {
                  const inputType = dbTypeToInput(field.type);
                  const isWide = field.name === 'name' || field.name === 'observaciones' || inputType === 'checkbox';

                  return (
                    <div className={`f-group ${isWide ? 'col-span-2' : ''}`} key={field.name}>
                      <label>{field.label || field.name}</label>
                      {field.name === 'observaciones' ? (
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

          <div className="flex gap-4">
            <button type="button" className="btn-apple-secondary flex-1" onClick={onClose}>Cancelar</button>
            <button type="submit" className={`btn-fly-primary btn-fly-${zoneColor} flex-1`} disabled={saving || visibleFields.length === 0}>
              <Save size={18} /> {saving ? 'Guardando...' : (initialData ? 'Guardar Cambios' : 'Crear Artículo')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddItemModal;
