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
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          gap: '2rem',
          textAlign: 'center'
        }}>
          <div style={{
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            background: 'hsla(var(--primary), 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px dashed hsl(var(--primary))'
          }}>
            <Wrench size={48} style={{ color: 'hsl(var(--primary))' }} />
          </div>
          
          <div>
            <h1 style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 900,
              fontSize: '2rem',
              color: 'hsl(var(--text-main))',
              marginBottom: '0.5rem',
              letterSpacing: '-0.02em'
            }}>
              En Construcción
            </h1>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontSize: '1rem',
              color: 'hsl(var(--text-muted))',
              fontWeight: 500,
              maxWidth: '400px'
            }}>
              Esta sección está siendo desarrollada. Pronto estará disponible con nuevas funcionalidades.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
