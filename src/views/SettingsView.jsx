import React, { useState } from 'react';
import { MapPin, Trash2, Plus, Tag, X, Wrench, Clock, Save } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

import './SettingsView.css';

const SettingsView = () => {
  const { locations, subcategories, addLocation, deleteLocation, addSubcategory, deleteSubcategory } = useInventory();
  
  const [newSubcategoryName, setNewSubcategoryName] = useState('');
  const [reportTime, setReportTime] = useState('23:00');
  const [savingReport, setSavingReport] = useState(false);
  
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

  const handleSaveSchedule = async () => {
    if (!reportTime) {
      toast.error('Por favor selecciona una hora válida');
      return;
    }

    setSavingReport(true);
    try {
      const [hoursStr, minutesStr] = reportTime.split(':');
      let hours = parseInt(hoursStr, 10);
      const minutes = parseInt(minutesStr, 10);

      // Convert CST (UTC-6) to UTC
      let utcHours = (hours + 6) % 24;

      const cronExpression = `${minutes} ${utcHours} * * *`;
      const webhookUrl = `${window.location.origin}/api/daily-report`;
      const cronSecret = import.meta.env.VITE_CRON_SECRET || 'secret-token-123';

      const { error } = await supabase.rpc('update_report_schedule', {
        cron_expression: cronExpression,
        webhook_url: webhookUrl,
        cron_secret: cronSecret
      });

      if (error) throw error;

      toast.success(`Reporte programado para las ${reportTime} hrs exitosamente.`);
    } catch (err) {
      console.error('Error scheduling report:', err);
      toast.error(`Error al programar: ${err.message}`);
    } finally {
      setSavingReport(false);
    }
  };

  return (
    <div className="fly-settings-view">
      
      <div className="fly-settings-container">
        
        {/* CABECERA PREMIUM */}
        <header className="fly-settings-header">
          <div className="fly-sh-icon">
            <Wrench size={28} strokeWidth={2.5} />
          </div>
          <h1>
            Ajustes y Configuración
            <span>Panel de administración de parámetros del sistema</span>
          </h1>
        </header>

        <div className="fly-settings-grid">
          
          {/* TARJETA REPORTE DIARIO */}
          <div className="fly-glass-card" style={{ gridColumn: '1 / -1' }}>
            <div className="fly-gc-header">
              <Clock size={24} className="fly-gc-icon" style={{ color: '#3b82f6' }} />
              <div>
                <h2>Reporte Diario Automático</h2>
                <p className="fly-gc-desc">Define a qué hora se enviará el resumen de movimientos a los administradores.</p>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <input 
                type="time" 
                className="fly-premium-input"
                style={{ maxWidth: '150px' }}
                value={reportTime} 
                onChange={e => setReportTime(e.target.value)}
              />
              <button 
                className="fly-btn-neon" 
                onClick={handleSaveSchedule}
                disabled={savingReport}
              >
                {savingReport ? 'Guardando...' : <><Save size={18} /> Programar</>}
              </button>
            </div>
          </div>

          {/* TARJETA LOCALIZACIONES */}
          <div className="fly-glass-card">
            <div className="fly-gc-header">
              <MapPin size={24} className="fly-gc-icon" />
              <div>
                <h2>Constructor de Localizaciones</h2>
                <p className="fly-gc-desc">Define y clasifica las zonas de almacenamiento disponibles.</p>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="fly-premium-input-group">
                <select 
                  className="fly-premium-select"
                  value={locType1} 
                  onChange={e => setLocType1(e.target.value)}
                >
                  {type1Options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <input 
                  type="text" 
                  className="fly-premium-input"
                  placeholder="Ej: 3, A, Almacén 1..." 
                  value={locId1} 
                  onChange={e => setLocId1(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddLocation()}
                />
              </div>

              {showSubLevel && (
                <div className="fly-sublevel-container">
                  <div className="fly-premium-input-group" style={{ flex: 1 }}>
                    <select 
                      className="fly-premium-select"
                      value={locType2} 
                      onChange={e => setLocType2(e.target.value)}
                    >
                      {type2Options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                    <input 
                      type="text" 
                      className="fly-premium-input"
                      placeholder="Identificador..." 
                      value={locId2} 
                      onChange={e => setLocId2(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddLocation()}
                    />
                  </div>
                  <button 
                    className="fly-btn-ghost fly-btn-remove-sub"
                    onClick={() => { setShowSubLevel(false); setLocId2(''); }}
                    title="Remover Sub-nivel"
                  >
                    <X size={20} />
                  </button>
                </div>
              )}

              <div className="fly-builder-actions">
                {!showSubLevel ? (
                  <button className="fly-btn-ghost" onClick={() => setShowSubLevel(true)}>
                    <Plus size={16} /> Añadir Nivel Secundario
                  </button>
                ) : <div />}
                
                <button 
                  className="fly-btn-neon" 
                  onClick={handleAddLocation}
                  disabled={!locId1.trim()}
                >
                  <Plus size={18} /> Registrar
                </button>
              </div>
            </div>

            <div className="fly-glass-list">
              {locations.length === 0 ? (
                <div className="fly-empty-state">
                  No hay zonas registradas aún en el sistema.
                </div>
              ) : (
                locations.map(loc => (
                  <div key={loc.id} className="fly-glass-list-item">
                    <span className="fly-list-item-name">{loc.name}</span>
                    <button 
                      className="fly-btn-icon-danger"
                      onClick={() => {
                        if(window.confirm(`¿Seguro que deseas eliminar la ubicación "${loc.name}"?`)) {
                          deleteLocation(loc.id);
                        }
                      }}
                      title="Eliminar Ubicación"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* TARJETA SUBCATEGORÍAS */}
          <div className="fly-glass-card">
            <div className="fly-gc-header">
              <Tag size={24} className="fly-gc-icon" />
              <div>
                <h2>Subcategorías Globales</h2>
                <p className="fly-gc-desc">Añade etiquetas secundarias para una mejor trazabilidad.</p>
              </div>
            </div>
            
            <div className="fly-premium-input-group" style={{ marginBottom: '1rem' }}>
              <input 
                type="text" 
                className="fly-premium-input"
                placeholder="Nombre de la subcategoría..." 
                value={newSubcategoryName} 
                onChange={e => setNewSubcategoryName(e.target.value)}
                onKeyDown={e => {
                  if(e.key === 'Enter' && newSubcategoryName.trim()) {
                    addSubcategory(newSubcategoryName.trim());
                    setNewSubcategoryName('');
                  }
                }}
              />
              <button 
                className="fly-btn-neon" 
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

            <div className="fly-glass-list">
              {subcategories.length === 0 ? (
                <div className="fly-empty-state">
                  No hay etiquetas secundarias registradas.
                </div>
              ) : (
                subcategories.map(sub => (
                  <div key={sub.id} className="fly-glass-list-item">
                    <span className="fly-list-item-name">{sub.name}</span>
                    <button 
                      className="fly-btn-icon-danger"
                      onClick={() => {
                        if(window.confirm(`¿Seguro que deseas eliminar la etiqueta "${sub.name}"?`)) {
                          deleteSubcategory(sub.id);
                        }
                      }}
                      title="Eliminar Etiqueta"
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
  );
};

export default SettingsView;
