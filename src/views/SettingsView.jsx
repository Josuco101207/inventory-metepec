import React, { useState } from 'react';
import { Building2, Save, MapPin, Phone, Globe, Trash2, AlertOctagon, Plus, Tag, Map, Bell, Moon, History, ChevronRight, X, FileSpreadsheet } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import { exportFullDatabase } from '../utils/exportUtils';
import { toast } from 'sonner';
import { useCategories } from '../context/CategoriesContext';
import FlyPattern from '../components/FlyPattern';
import './SettingsView.css';

const SettingsView = () => {
  const { items, brands, locations, addBrand, deleteBrand, addLocation, deleteLocation, clearDatabaseCategories } = useInventory();
  const { isAdmin } = useAuth();
  const { categories: CATEGORIES } = useCategories();
  const [newBrand, setNewBrand] = useState('');
  const [newLocName, setNewLocName] = useState('');
  const [newLocZone, setNewLocZone] = useState('');
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
        
        {/* Header */}
        <header className="fly-settings-header">
          <h1 className="fly-settings-title">Ajustes</h1>
          <p className="fly-settings-sub">Personaliza la experiencia y gestión del sistema</p>
        </header>

        <div className="fly-settings-grid">
          
          {/* Main Column */}
          <div className="fly-settings-main">
            
            {/* Company Identity Section */}
            <section className="fly-settings-section">
              <div className="fly-section-header">
                <div className="fly-section-icon-wrapper fly-icon-blue">
                  <Building2 size={22} />
                </div>
                <div>
                  <h2 className="fly-section-title">Identidad de la Empresa</h2>
                  <p className="fly-section-sub">Información fiscal y de contacto</p>
                </div>
              </div>
              
              <div className="fly-form-grid">
                <div className="fly-form-group">
                  <label>Nombre Comercial</label>
                  <input 
                    type="text" 
                    value={companyInfo.name} 
                    onChange={(e) => setCompanyInfo({...companyInfo, name: e.target.value})}
                  />
                </div>
                <div className="fly-form-group">
                  <label>Moneda</label>
                  <select value={companyInfo.currency} onChange={(e) => setCompanyInfo({...companyInfo, currency: e.target.value})}>
                    <option value="MXN">Peso Mexicano (MXN)</option>
                    <option value="USD">Dólar Estadounidense (USD)</option>
                    <option value="EUR">Euro (EUR)</option>
                  </select>
                </div>

                <div className="fly-form-group fly-form-full">
                  <label>Dirección Fiscal</label>
                  <div className="fly-input-wrapper">
                    <MapPin size={16} />
                    <input 
                      type="text" 
                      value={companyInfo.address} 
                      onChange={(e) => setCompanyInfo({...companyInfo, address: e.target.value})}
                    />
                  </div>
                </div>

                <div className="fly-form-group">
                  <label>Teléfono</label>
                  <div className="fly-input-wrapper">
                    <Phone size={16} />
                    <input 
                      type="text" 
                      value={companyInfo.phone} 
                      onChange={(e) => setCompanyInfo({...companyInfo, phone: e.target.value})}
                    />
                  </div>
                </div>
                <div className="fly-form-group">
                  <label>Sitio Web</label>
                  <div className="fly-input-wrapper">
                    <Globe size={16} />
                    <input 
                      type="text" 
                      value={companyInfo.website} 
                      onChange={(e) => setCompanyInfo({...companyInfo, website: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <button className="fly-btn fly-btn-primary" onClick={handleSave}>
                <Save size={16} /> Guardar Cambios
              </button>
            </section>

            {/* Danger Zone */}
            {isAdmin && (
              <section className="fly-settings-section fly-section-danger">
                <div className="fly-section-header">
                  <div className="fly-section-icon-wrapper fly-icon-red">
                    <AlertOctagon size={22} />
                  </div>
                  <div>
                    <h2 className="fly-section-title">Área de Seguridad</h2>
                    <p className="fly-section-sub">Mantenimiento crítico de la base de datos</p>
                  </div>
                </div>
                
                <div className="fly-danger-content">
                  <h3 className="fly-danger-title">Mantenimiento de Base de Datos</h3>
                  <p className="fly-danger-sub">Esta acción eliminará de forma irreversible el historial y artículos de la categoría seleccionada.</p>
                  
                  <div className="fly-form-group">
                    <label>Seleccionar Área a Vaciar</label>
                    <select 
                      value={categoryToClear} 
                      onChange={(e) => setCategoryToClear(e.target.value)}
                    >
                      {ALL_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>

                  <button 
                    className="fly-btn fly-btn-danger"
                    onClick={async () => {
                      if (window.confirm(`¿CONFIRMACIÓN CRÍTICA? Se borrarán TODOS los datos y el historial de la categoría: ${categoryToClear.toUpperCase()}. Esta acción no se puede deshacer.`)) {
                        const success = await clearDatabaseCategories([categoryToClear]);
                        if (success) toast.success(`Área de ${categoryToClear} limpiada correctamente`);
                      }
                    }}
                  >
                    <Trash2 size={16} /> Vaciar Inventario {categoryToClear}
                  </button>

                  <div className="fly-divider"></div>

                  <h3 className="fly-danger-title">Respaldo Total</h3>
                  <p className="fly-danger-sub">Descarga una copia completa de toda la base de datos en un solo archivo Excel.</p>
                  <button 
                    className="fly-btn fly-btn-success"
                    onClick={() => exportFullDatabase(items)}
                  >
                    <FileSpreadsheet size={16} /> Exportar Toda la Herramienta
                  </button>
                </div>
              </section>
            )}
          </div>

          {/* Sidebar Column */}
          <div className="fly-settings-sidebar">
            
            {/* Preferences */}
            <section className="fly-settings-section">
              <div className="fly-section-header">
                <div className="fly-section-icon-wrapper fly-icon-purple">
                  <Bell size={20} />
                </div>
                <h2 className="fly-section-title">Preferencias</h2>
              </div>
              
              <div className="fly-preferences-list">
                <div className="fly-preference-item">
                  <div className="fly-pref-label">
                    <span className="fly-pref-title">Notificaciones</span>
                    <span className="fly-pref-sub">Alertas de stock bajo</span>
                  </div>
                  <IOSSwitch checked={true} onChange={() => {}} />
                </div>
                <div className="fly-preference-item">
                  <div className="fly-pref-label">
                    <span className="fly-pref-title">Reporte Semanal</span>
                    <span className="fly-pref-sub">PDF por correo</span>
                  </div>
                  <IOSSwitch checked={false} onChange={() => {}} />
                </div>
                <div className="fly-preference-item">
                  <div className="fly-pref-label">
                    <span className="fly-pref-title">Modo Oscuro</span>
                    <span className="fly-pref-sub">Seguir sistema</span>
                  </div>
                  <IOSSwitch checked={false} onChange={() => {}} />
                </div>
              </div>
            </section>

            {/* Brands */}
            <section className="fly-settings-section">
              <div className="fly-section-header">
                <div className="fly-section-icon-wrapper fly-icon-green">
                  <Tag size={20} />
                </div>
                <h2 className="fly-section-title">Marcas</h2>
              </div>
              
              <div className="fly-add-input">
                <input 
                  type="text" 
                  placeholder="Añadir..." 
                  value={newBrand}
                  onChange={(e) => setNewBrand(e.target.value)}
                />
                <button className="fly-btn-icon" onClick={() => { addBrand(newBrand); setNewBrand(''); }}>
                  <Plus size={20} />
                </button>
              </div>
              
              <div className="fly-tags-grid">
                {brands.map(b => (
                  <div key={b.id} className="fly-tag">
                    {b.name}
                    <button onClick={() => deleteBrand(b.id)} className="fly-tag-close">
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Locations */}
            <section className="fly-settings-section">
              <div className="fly-section-header">
                <div className="fly-section-icon-wrapper fly-icon-orange">
                  <Map size={20} />
                </div>
                <h2 className="fly-section-title">Ubicaciones</h2>
              </div>
              
              <div className="fly-location-add">
                <div className="fly-location-inputs">
                  <input type="text" placeholder="Nombre" value={newLocName} onChange={(e) => setNewLocName(e.target.value)} />
                  <input type="text" placeholder="Zona" value={newLocZone} onChange={(e) => setNewLocZone(e.target.value)} />
                </div>
                <button className="fly-btn fly-btn-secondary" onClick={() => { addLocation(newLocName, newLocZone); setNewLocName(''); setNewLocZone(''); }}>
                  Añadir Ubicación
                </button>
              </div>
              
              <div className="fly-locations-list">
                {locations.map(l => (
                  <div key={l.id} className="fly-location-item">
                    <div className="fly-location-info">
                      <span className="fly-location-name">{l.name}</span>
                      <span className="fly-location-zone">{l.zone || 'Almacén'}</span>
                    </div>
                    <button onClick={() => deleteLocation(l.id)} className="fly-action-btn fly-action-red">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
