import React from 'react';
import { User, Shield, Clock, TrendingUp, BarChart3, Mail, Calendar, Activity, Package, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useInventory } from '../context/InventoryContext';
import FlyPattern from '../components/FlyPattern';
import './ProfileView.css';

const ProfileView = () => {
  const { userData, isAdmin } = useAuth();
  const { movements, items } = useInventory();

  const myMovements = movements.filter(m => m.user === (userData?.name || userData?.displayName || userData?.email));
  const myActionsCount = myMovements.length;

  return (
    <div className="fly-profile-view">
      <FlyPattern fixed opacity={0.04} />
      
      <div className="fly-profile-container">
        
        {/* Profile Header */}
        <div className="fly-profile-header">
          <div className="fly-profile-bg-accent"></div>
          
          <div className="fly-profile-avatar-wrapper">
            <div className="fly-profile-avatar">
              <User size={48} />
            </div>
          </div>
          
          <h1 className="fly-profile-name">{userData?.name || userData?.displayName || 'Usuario'}</h1>
          
          <div className="fly-profile-email">
            <Mail size={14} />
            {userData?.email}
          </div>
          
          <div className={`fly-profile-role ${isAdmin ? 'fly-role-admin' : ''}`}>
            <Shield size={14} />
            {userData?.role || 'Usuario'}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="fly-profile-stats">
          <div className="fly-stat-card">
            <div className="fly-stat-icon fly-stat-blue">
              <Activity size={20} />
            </div>
            <div className="fly-stat-content">
              <span className="fly-stat-value">{myActionsCount}</span>
              <span className="fly-stat-label">Mis Movimientos</span>
            </div>
          </div>
          
          <div className="fly-stat-card">
            <div className="fly-stat-icon fly-stat-green">
              <Package size={20} />
            </div>
            <div className="fly-stat-content">
              <span className="fly-stat-value">{items.length}</span>
              <span className="fly-stat-label">SKUs Totales</span>
            </div>
          </div>
          
          <div className="fly-stat-card">
            <div className="fly-stat-icon fly-stat-purple">
              <Zap size={20} />
            </div>
            <div className="fly-stat-content">
              <span className="fly-stat-value">100%</span>
              <span className="fly-stat-label">Estado Activo</span>
            </div>
          </div>
        </div>

        {/* Activity Section */}
        <div className="fly-profile-section">
          <div className="fly-section-header">
            <div>
              <h2 className="fly-section-title">Actividad Reciente</h2>
              <p className="fly-section-sub">Tus últimos movimientos en el sistema</p>
            </div>
            <div className="fly-section-icon">
              <Clock size={24} />
            </div>
          </div>
          
          <div className="fly-activity-list">
            {myMovements.length > 0 ? myMovements.slice(0, 5).map(mov => (
              <div key={mov.id} className="fly-activity-item">
                <div 
                  className={`fly-activity-dot ${mov.action === 'Entrada' ? 'fly-dot-green' : 'fly-dot-red'}`}
                ></div>
                <div className="fly-activity-content">
                  <p className="fly-activity-action">{mov.action}: {mov.item}</p>
                  <p className="fly-activity-date">
                    <Calendar size={12} />
                    {mov.timestamp ? (typeof mov.timestamp === 'string' ? new Date(mov.timestamp).toLocaleString() : (mov.timestamp.toDate ? mov.timestamp.toDate().toLocaleString() : mov.timestamp.toLocaleString())) : mov.time}
                  </p>
                </div>
              </div>
            )) : (
              <div className="fly-empty-activity">
                <Activity size={32} />
                <p>Aún no has registrado movimientos</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="fly-profile-section">
          <div className="fly-section-header">
            <div>
              <h2 className="fly-section-title">Métricas del Sistema</h2>
              <p className="fly-section-sub">Estadísticas generales del inventario</p>
            </div>
            <div className="fly-section-icon">
              <BarChart3 size={24} />
            </div>
          </div>
          
          <div className="fly-metrics-grid">
            <div className="fly-metric-card">
              <span className="fly-metric-label">Total Artículos</span>
              <span className="fly-metric-value">{items.length}</span>
            </div>
            <div className="fly-metric-card">
              <span className="fly-metric-label">Movimientos Totales</span>
              <span className="fly-metric-value">{movements.length}</span>
            </div>
            <div className="fly-metric-card">
              <span className="fly-metric-label">Estado del Sistema</span>
              <span className="fly-metric-value fly-status-online">EN LÍNEA</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ProfileView;
