import React, { useMemo } from 'react';
import { User, Shield, Clock, TrendingUp, BarChart3, Mail, Calendar, Activity, Package, Zap, Hash, Database } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useInventory } from '../context/InventoryContext';
import { useCategories } from '../context/CategoriesContext';
import './ProfileView.css';

const ProfileView = () => {
  const { userData, isAdmin } = useAuth();
  const { movements, items, connectionStatus } = useInventory();
  const { categories } = useCategories();

  // Compute metrics
  const myMovements = useMemo(() => 
    movements.filter(m => m.user === (userData?.name || userData?.displayName || userData?.email)),
  [movements, userData]);
  
  const myActionsCount = myMovements.length;
  
  const progressPercent = movements.length > 0 ? Math.min(100, Math.round((myActionsCount / movements.length) * 100)) : 0;
  
  const totalTables = categories.filter(c => c.tableName).length;

  return (
    <div className="fly-profile-view">
      {/* Fondos de Orbes Fluidos */}
      <div className="profile-fluid-bg">
        <div className="profile-orb profile-orb-1" />
        <div className="profile-orb profile-orb-2" />
        <div className="profile-orb profile-orb-3" />
      </div>
      
      <div className="fly-profile-container">
        
        {/* 1. TARJETA DE IDENTIDAD (ID CARD) */}
        <div className="profile-id-card">
          <div className="profile-avatar-container">
            <div className="profile-avatar-glow" />
            <div className="profile-avatar">
              <User size={56} strokeWidth={1.5} />
            </div>
          </div>
          
          <div className="profile-info">
            <div className={`profile-role-badge ${isAdmin ? 'admin' : ''}`}>
              <Shield size={14} />
              {userData?.role || 'Operador Central'}
            </div>
            
            <h1 className="profile-name">
              {userData?.name || userData?.displayName || 'Usuario Fly'}
            </h1>
            
            <div className="profile-meta">
              <div className="profile-meta-item">
                <Mail size={16} />
                {userData?.email || 'usuario@flyextreme.com'}
              </div>
              <div className="profile-meta-item">
                <Activity size={16} />
                Estado: {connectionStatus === 'online' ? 'Sincronizado' : 'Offline'}
              </div>
            </div>
          </div>
        </div>

        {/* 2. HUD DE ESTADÍSTICAS */}
        <div className="profile-hud-grid">
          {/* Card 1 */}
          <div className="hud-card hud-yellow">
            <div className="hud-icon-wrapper">
              <div className="hud-icon"><TrendingUp size={20} /></div>
              <span className="hud-label">Mis Operaciones</span>
            </div>
            <div className="hud-value-container">
              <span className="hud-value">{myActionsCount}</span>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', fontWeight: 600 }}>/ {movements.length}</span>
            </div>
            <div className="hud-bar-bg">
              <div className="hud-bar-fill" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
          
          {/* Card 2 */}
          <div className="hud-card hud-cyan">
            <div className="hud-icon-wrapper">
              <div className="hud-icon"><Package size={20} /></div>
              <span className="hud-label">SKUs Base de Datos</span>
            </div>
            <div className="hud-value-container">
              <span className="hud-value">{items.length}</span>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', fontWeight: 600 }}>items</span>
            </div>
            <div className="hud-bar-bg">
              <div className="hud-bar-fill" style={{ width: '100%' }} />
            </div>
          </div>
          
          {/* Card 3 */}
          <div className="hud-card hud-magenta">
            <div className="hud-icon-wrapper">
              <div className="hud-icon"><Database size={20} /></div>
              <span className="hud-label">Categorías (Tablas)</span>
            </div>
            <div className="hud-value-container">
              <span className="hud-value">{totalTables}</span>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', fontWeight: 600 }}>registradas</span>
            </div>
            <div className="hud-bar-bg">
              <div className="hud-bar-fill" style={{ width: '100%' }} />
            </div>
          </div>
        </div>

        {/* 3. LÍNEA DE TIEMPO DE ACTIVIDAD */}
        <div className="profile-section">
          <div className="section-header">
            <div className="section-icon">
              <Clock size={24} />
            </div>
            <div className="section-titles">
              <h2>Línea de Tiempo Operativa</h2>
              <p>Historial de tus últimos registros en el sistema Fly Extreme</p>
            </div>
          </div>
          
          <div className="timeline-container">
            {myMovements.length > 0 ? myMovements.slice(0, 10).map((mov, idx) => (
              <div key={mov.id || idx} className="timeline-item">
                <div className={`timeline-dot action-${mov.action}`}></div>
                <div className="timeline-content">
                  <h3 className="timeline-action">{mov.action}</h3>
                  <div className="timeline-details">
                    <div className="timeline-detail">
                      <Package size={14} />
                      <span>{mov.item}</span>
                    </div>
                    {mov.qty && (
                      <div className="timeline-detail">
                        <Hash size={14} />
                        <span>Cantidad: {mov.qty}</span>
                      </div>
                    )}
                    <div className="timeline-detail">
                      <Calendar size={14} />
                      <span>
                        {mov.timestamp 
                          ? (typeof mov.timestamp === 'string' 
                              ? new Date(mov.timestamp).toLocaleString() 
                              : (mov.timestamp.toDate ? mov.timestamp.toDate().toLocaleString() : mov.timestamp.toLocaleString())) 
                          : mov.time}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )) : (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255,255,255,0.4)', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
                <Activity size={32} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                <p style={{ margin: 0, fontWeight: 600 }}>Aún no has registrado movimientos operativos.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ProfileView;
