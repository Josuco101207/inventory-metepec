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
  const [newLocName, setNewLocName] = useState('');
  const [newLocZone, setNewLocZone] = useState('');
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
              
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <input 
                  type="text" 
                  placeholder="Nombre de la nueva ubicación" 
                  value={newLocName} 
                  onChange={e => setNewLocName(e.target.value)}
                  style={{ flex: 1, padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--background)' }}
                  onKeyDown={e => {
                    if(e.key === 'Enter' && newLocName.trim()) {
                      addLocation(newLocName.trim(), newLocZone.trim());
                      setNewLocName('');
                      setNewLocZone('');
                    }
                  }}
                />
                <button 
                  className="fly-btn fly-btn-primary" 
                  onClick={() => {
                    if(newLocName.trim()) {
                      addLocation(newLocName.trim(), newLocZone.trim());
                      setNewLocName('');
                      setNewLocZone('');
                    }
                  }}
                  disabled={!newLocName.trim()}
                >
                  <Plus size={18} />
                </button>
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
