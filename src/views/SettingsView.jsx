import React, { useState } from 'react';
import { Building2, Save, MapPin, Phone, Globe, Trash2, AlertOctagon, Plus, Tag, Map, Bell, Moon, History, ChevronRight, X, FileSpreadsheet, Wrench } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import { exportFullDatabase } from '../utils/exportUtils';
import { toast } from 'sonner';
import { useCategories } from '../context/CategoriesContext';
import FlyPattern from '../components/FlyPattern';
import './SettingsView.css';

const SettingsView = () => {
  const { items, brands, locations, subcategories, addBrand, deleteBrand, addLocation, deleteLocation, addSubcategory, deleteSubcategory, clearDatabaseCategories } = useInventory();
  const { isAdmin } = useAuth();
  const { categories: CATEGORIES } = useCategories();
  const [newBrand, setNewBrand] = useState('');
  
  // Location Builder State
  const [locType1, setLocType1] = useState('Estante');
  const [locId1, setLocId1] = useState('');
  const [showSubLevel, setShowSubLevel] = useState(false);
  const [locType2, setLocType2] = useState('Piso');
  const [locId2, setLocId2] = useState('');

  const type1Options = ['Estante', 'Pasillo', 'Vitrina', 'Mostrador', 'Bodega', 'Zona', 'Cajonera'];
  const type2Options = ['Piso', 'Nivel', 'Cajón', 'Caja', 'Fila', 'Sección'];

  const handleAddLocation = () => {
    if (!locId1.trim()) return;
    let finalName = `${locType1} ${locId1.trim()}`;
    if (showSubLevel && locId2.trim()) {
      finalName += ` - ${locType2} ${locId2.trim()}`;
    }
    addLocation(finalName, '');
    setLocId1('');
    setLocId2('');
    setShowSubLevel(false);
  };
  const [newSubcategoryName, setNewSubcategoryName] = useState('');
  const [categoryToClear, setCategoryToClear] = useState(CATEGORIES[0]?.title || '');

  const ALL_CATEGORIES = CATEGORIES.map(cat => cat.title);

  const [companyInfo, setCompanyInfo] = useState({
    name: 'Constructora Alfa',
    address: 'Av. Industrial 123, Ciudad de México',
    phone: '+52 55 1234 5678',
    website: 'www.constructoraalfa.com',
    currency: 'MXN'
  });

  const handleSave = () => {
    toast.success("Configuración guardada correctamente");
  };

  const IOSSwitch = ({ checked, onChange }) => (
    <label className="ios-switch">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="ios-slider"></span>
    </label>
  );

  return (
    <div className="fly-settings-view">
      <FlyPattern fixed opacity={0.04} />
      
      <div className="fly-settings-container">
        <header className="fly-settings-header">
          <div className="fly-sh-left">
            <div className="fly-sh-icon"><Wrench size={26} /></div>
            <h1>Ajustes y Configuración<span>Administra parámetros del sistema</span></h1>
          </div>
        </header>

        <div className="fly-settings-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {/* Tarjeta de Localizaciones */}
          <div className="fly-s-card">
            <div className="fly-s-card-header">
              <MapPin size={20} />
              <h2>Localizaciones</h2>
            </div>
            <div className="fly-s-card-content">
              <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', marginBottom: '1rem' }}>
                Añade o elimina las ubicaciones donde se puede encontrar inventario.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <select 
                    value={locType1} 
                    onChange={e => setLocType1(e.target.value)}
                    style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--background)', color: 'var(--text-color)' }}
                  >
                    {type1Options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                  <input 
                    type="text" 
                    placeholder="Ej: 3, A..." 
                    value={locId1} 
                    onChange={e => setLocId1(e.target.value)}
                    style={{ flex: 1, padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--background)', color: 'var(--text-color)' }}
                    onKeyDown={e => {
                      if(e.key === 'Enter') handleAddLocation();
                    }}
                  />
                </div>

                {showSubLevel && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', paddingLeft: '1rem', borderLeft: '2px solid var(--border-color)' }}>
                    <select 
                      value={locType2} 
                      onChange={e => setLocType2(e.target.value)}
                      style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--background)', color: 'var(--text-color)' }}
                    >
                      {type2Options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                    <input 
                      type="text" 
                      placeholder="Ej: 4, B..." 
                      value={locId2} 
                      onChange={e => setLocId2(e.target.value)}
                      style={{ flex: 1, padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--background)', color: 'var(--text-color)' }}
                      onKeyDown={e => {
                        if(e.key === 'Enter') handleAddLocation();
                      }}
                    />
                    <button 
                      onClick={() => { setShowSubLevel(false); setLocId2(''); }}
                      style={{ background: 'transparent', border: 'none', color: 'hsl(var(--danger))', cursor: 'pointer', padding: '4px' }}
                      title="Quitar sub-nivel"
                    >
                      <X size={18} />
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                  {!showSubLevel ? (
                    <button 
                      onClick={() => setShowSubLevel(true)}
                      style={{ background: 'transparent', border: '1px dashed var(--border-color)', color: 'hsl(var(--text-muted))', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                      <Plus size={14} /> Añadir sub-nivel
                    </button>
                  ) : <div></div>}
                  
                  <button 
                    className="fly-btn fly-btn-primary" 
                    onClick={handleAddLocation}
                    disabled={!locId1.trim()}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem' }}
                  >
                    <Plus size={18} /> Guardar
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
                {locations.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', background: 'var(--background)', borderRadius: '8px', border: '1px dashed var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No hay localizaciones registradas
                  </div>
                ) : (
                  locations.map(loc => (
                    <div key={loc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontWeight: 500 }}>{loc.name}</span>
                      <button 
                        onClick={() => {
                          if(window.confirm(`¿Seguro que deseas eliminar la ubicación "${loc.name}"?`)) {
                            deleteLocation(loc.id);
                          }
                        }}
                        style={{ background: 'transparent', border: 'none', color: 'hsl(var(--danger))', cursor: 'pointer', padding: '4px', opacity: 0.8 }}
                        title="Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Tarjeta de Subcategorías */}
          <div className="fly-s-card">
            <div className="fly-s-card-header">
              <Tag size={20} />
              <h2>Subcategorías</h2>
            </div>
            <div className="fly-s-card-content">
              <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', marginBottom: '1rem' }}>
                Añade o elimina subcategorías para clasificar los artículos.
              </p>
              
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <input 
                  type="text" 
                  placeholder="Nombre de la subcategoría" 
                  value={newSubcategoryName} 
                  onChange={e => setNewSubcategoryName(e.target.value)}
                  style={{ flex: 1, padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--background)' }}
                  onKeyDown={e => {
                    if(e.key === 'Enter' && newSubcategoryName.trim()) {
                      addSubcategory(newSubcategoryName.trim());
                      setNewSubcategoryName('');
                    }
                  }}
                />
                <button 
                  className="fly-btn fly-btn-primary" 
                  onClick={() => {
                    if(newSubcategoryName.trim()) {
                      addSubcategory(newSubcategoryName.trim());
                      setNewSubcategoryName('');
                    }
                  }}
                  disabled={!newSubcategoryName.trim()}
                >
                  <Plus size={18} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
                {subcategories.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', background: 'var(--background)', borderRadius: '8px', border: '1px dashed var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No hay subcategorías registradas
                  </div>
                ) : (
                  subcategories.map(sub => (
                    <div key={sub.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontWeight: 500 }}>{sub.name}</span>
                      <button 
                        onClick={() => {
                          if(window.confirm(`¿Seguro que deseas eliminar la subcategoría "${sub.name}"?`)) {
                            deleteSubcategory(sub.id);
                          }
                        }}
                        style={{ background: 'transparent', border: 'none', color: 'hsl(var(--danger))', cursor: 'pointer', padding: '4px', opacity: 0.8 }}
                        title="Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
