import React, { useMemo, useState } from 'react';
import { User, Shield, Clock, TrendingUp, BarChart3, Mail, Calendar, Activity, Package, Zap, Hash, Database, Hexagon, Crosshair, ChevronRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useInventory } from '../context/InventoryContext';
import { useCategories } from '../context/CategoriesContext';
import useIsMobile from '../hooks/useIsMobile';
import './ProfileView.css';

const ProfileView = () => {
  const { userData, isAdmin } = useAuth();
  const { movements, items, connectionStatus } = useInventory();
  const { categories } = useCategories();
  const { isMobile } = useIsMobile();

  // Compute metrics
  const myMovements = useMemo(() => 
    movements.filter(m => m.user === (userData?.name || userData?.displayName || userData?.email)),
  [movements, userData]);
  
  const [logFilter, setLogFilter] = useState('Recientes');
  const [dateFilter, setDateFilter] = useState('');

  const filteredMovements = useMemo(() => {
    let filtered = myMovements;

    if (logFilter === 'Entradas') {
      filtered = filtered.filter(m => m.action === 'Entrada' || m.action === 'Alta');
    } else if (logFilter === 'Salidas') {
      filtered = filtered.filter(m => m.action === 'Salida');
    }

    if (dateFilter) {
      filtered = filtered.filter(m => {
        const movDate = m.timestamp 
          ? (typeof m.timestamp === 'string' 
              ? new Date(m.timestamp)
              : (m.timestamp.toDate ? m.timestamp.toDate() : new Date(m.timestamp))) 
          : new Date(m.time);
          
        if (isNaN(movDate.getTime())) return true;
        
        // Format to local date string (YYYY-MM-DD)
        const localDate = new Date(movDate.getTime() - (movDate.getTimezoneOffset() * 60000))
                            .toISOString().split('T')[0];
        return localDate === dateFilter;
      });
    }

    return filtered;
  }, [myMovements, logFilter, dateFilter]);

  const myActionsCount = myMovements.length;
  const progressPercent = movements.length > 0 ? Math.min(100, Math.round((myActionsCount / movements.length) * 100)) : 0;
  const totalTables = categories.filter(c => c.tableName).length;

  // Additional mock metrics for a premium "HUD" feel
  const currentSessionLength = "02:45:10"; 
  const systemIntegrity = "Optimo";

  if (isMobile) {
    return (
      <div className="fly-profile-mobile">
        <div className="fpm-sticky-header">
          <div className="fpm-header-top">
            <h1 className="fpm-title">Perfil</h1>
            <div className={`fpm-status-badge ${connectionStatus === 'online' ? 'online' : 'offline'}`}>
              <div className="status-dot"></div>
              {connectionStatus === 'online' ? 'Conectado' : 'Desconectado'}
            </div>
          </div>
        </div>

        <div className="fpm-content">
          {/* USER INFO CARD */}
          <div className="fpm-user-card">
            <div className="fpm-avatar-wrap">
              <User size={40} className="fpm-avatar-icon"/>
            </div>
            <div className="fpm-user-info">
              <h2 className="fpm-user-name">{userData?.name || userData?.displayName || 'Usuario Fly'}</h2>
              <span className="fpm-user-role">{userData?.role || 'Operador Central'}</span>
              <span className="fpm-user-email">{userData?.email || 'usuario@flyextreme.com'}</span>
            </div>
            {isAdmin && <Shield size={24} className="fpm-admin-icon" />}
          </div>

          {/* QUICK STATS */}
          <div className="fpm-quick-stats">
            <div className="fpm-stat-box">
              <Clock size={16} className="fpm-stat-icon txt-magenta" />
              <div className="fpm-stat-data">
                <span className="fpm-stat-val">{currentSessionLength}</span>
                <span className="fpm-stat-lbl">SESIÓN</span>
              </div>
            </div>
            <div className="fpm-stat-box">
              <CheckCircle2 size={16} className="fpm-stat-icon txt-cyan" />
              <div className="fpm-stat-data">
                <span className="fpm-stat-val">{systemIntegrity}</span>
                <span className="fpm-stat-lbl">SISTEMA</span>
              </div>
            </div>
          </div>

          {/* METRICS CARDS */}
          <div className="fpm-metrics">
            <div className="fpm-metric-card">
              <div className="fpm-mc-header">
                <TrendingUp size={16} className="txt-yellow" />
                <span>ÍNDICE DE OPERACIONES</span>
              </div>
              <div className="fpm-mc-body">
                <span className="fpm-mc-main">{myActionsCount}</span>
                <span className="fpm-mc-sub">MOVIMIENTOS</span>
              </div>
              <div className="fpm-mc-progress">
                <div className="fpm-mc-bar bg-yellow" style={{width: `${progressPercent}%`}}></div>
              </div>
            </div>

            <div className="fpm-metric-card">
              <div className="fpm-mc-header">
                <Package size={16} className="txt-cyan" />
                <span>BASE DE DATOS SKU</span>
              </div>
              <div className="fpm-mc-body">
                <span className="fpm-mc-main">{items.length}</span>
                <span className="fpm-mc-sub">ACTIVOS</span>
              </div>
            </div>

            <div className="fpm-metric-card">
              <div className="fpm-mc-header">
                <Database size={16} className="txt-magenta" />
                <span>ESTRUCTURA LÓGICA</span>
              </div>
              <div className="fpm-mc-body">
                <span className="fpm-mc-main">{totalTables}</span>
                <span className="fpm-mc-sub">TABLAS</span>
              </div>
            </div>
          </div>

          {/* BITÁCORA */}
          <div className="fpm-logs-section">
            <div className="fpm-logs-header">
              <h3>Bitácora Reciente</h3>
              <div className="fpm-log-filters">
                <span className={`fpm-log-fbtn ${logFilter === 'Recientes' ? 'active' : ''}`} onClick={() => setLogFilter('Recientes')}>Todos</span>
                <span className={`fpm-log-fbtn ${logFilter === 'Entradas' ? 'active' : ''}`} onClick={() => setLogFilter('Entradas')}>Ent</span>
                <span className={`fpm-log-fbtn ${logFilter === 'Salidas' ? 'active' : ''}`} onClick={() => setLogFilter('Salidas')}>Sal</span>
              </div>
            </div>

            <div className="fpm-log-list">
              {filteredMovements.length > 0 ? filteredMovements.slice(0, 5).map((mov, idx) => (
                <div key={mov.id || idx} className="fpm-log-item">
                  <div className={`fpm-log-dot action-${mov.action}`}></div>
                  <div className="fpm-log-content">
                    <div className="fpm-log-top">
                      <span className="fpm-log-name">{mov.item}</span>
                      <span className="fpm-log-time">
                        {mov.timestamp 
                          ? (typeof mov.timestamp === 'string' 
                              ? new Date(mov.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
                              : (mov.timestamp.toDate ? mov.timestamp.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : mov.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}))) 
                          : mov.time}
                      </span>
                    </div>
                    <div className="fpm-log-bot">
                      <span className={`fpm-log-action action-${mov.action}`}>{mov.action}</span>
                      {mov.qty && <span className="fpm-log-qty">{mov.qty} uds</span>}
                    </div>
                  </div>
                </div>
              )) : (
                <div className="fpm-log-empty">No hay registros.</div>
              )}
            </div>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="fly-profile-view">
      {/* Fondos de Orbes Fluidos y Grid */}
      <div className="profile-bg-layer">
        <div className="profile-grid-overlay"></div>
      </div>
      
      <div className="fly-profile-container">
        
        {/* TOP HERO SECTION */}
        <div className="profile-hero-section">
          <div className="profile-id-card-3d">
            <div className="id-card-glow-border"></div>
            <div className="id-card-content">
              
              <div className="profile-avatar-container">
                <div className="profile-avatar-rings">
                  <div className="ring ring-1"></div>
                  <div className="ring ring-2"></div>
                  <div className="ring ring-3"></div>
                </div>
                <div className="profile-avatar">
                  <User size={64} strokeWidth={1} />
                </div>
                <div className="status-indicator online">
                  <div className="status-ping"></div>
                </div>
              </div>
              
              <div className="profile-info-advanced">
                <div className="profile-header-top">
                  <div className={`profile-role-badge ${isAdmin ? 'admin' : ''}`}>
                    <Shield size={14} />
                    <span>{userData?.role || 'Operador Central'}</span>
                  </div>
                </div>
                
                <h1 className="profile-name-glitch" data-text={userData?.name || userData?.displayName || 'Usuario Fly'}>
                  {userData?.name || userData?.displayName || 'Usuario Fly'}
                </h1>
                
                <div className="profile-meta-grid">
                  <div className="meta-box">
                    <Mail size={14} className="meta-icon" />
                    <div className="meta-text">
                      <span className="meta-label">ID ENLACE</span>
                      <span className="meta-val">{userData?.email || 'usuario@flyextreme.com'}</span>
                    </div>
                  </div>
                  <div className="meta-box">
                    <Activity size={14} className="meta-icon" />
                    <div className="meta-text">
                      <span className="meta-label">STATUS RED</span>
                      <span className="meta-val" style={{ color: connectionStatus === 'online' ? '#00f0ff' : '#ff3b30' }}>
                        {connectionStatus === 'online' ? 'SINCRONIZADO' : 'OFFLINE'}
                      </span>
                    </div>
                  </div>
                  <div className="meta-box">
                    <Clock size={14} className="meta-icon" />
                    <div className="meta-text">
                      <span className="meta-label">SESIÓN ACTIVA</span>
                      <span className="meta-val">{currentSessionLength}</span>
                    </div>
                  </div>
                  <div className="meta-box">
                    <CheckCircle2 size={14} className="meta-icon" />
                    <div className="meta-text">
                      <span className="meta-label">SISTEMA</span>
                      <span className="meta-val">{systemIntegrity}</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* MIDDLE SECTION: HUD STATS */}
        <div className="profile-stats-grid">
          {/* Main Contribution Card */}
          <div className="hud-metric-card primary-card">
            <div className="metric-header">
              <div className="metric-title-group">
                <div className="metric-icon-box yellow"><TrendingUp size={18} /></div>
                <h3>Índice de Operaciones</h3>
              </div>
              <div className="metric-badge">GLOBAL: {progressPercent}%</div>
            </div>
            
            <div className="metric-body-flex">
              <div className="metric-main-val">
                <span className="value">{myActionsCount}</span>
                <span className="sub">movimientos</span>
              </div>
              <div className="circular-progress-container">
                <svg className="circular-chart" viewBox="0 0 36 36">
                  <path className="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path className="circle-fill yellow" strokeDasharray={`${progressPercent}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
                <div className="circle-content">{progressPercent}%</div>
              </div>
            </div>
            <div className="metric-footer">De un total de {movements.length} movimientos en la red.</div>
          </div>

          {/* Database Coverage Card */}
          <div className="hud-metric-card">
            <div className="metric-header">
              <div className="metric-title-group">
                <div className="metric-icon-box cyan"><Package size={18} /></div>
                <h3>Base de Datos SKU</h3>
              </div>
            </div>
            <div className="metric-body-block">
              <div className="digital-counter">{items.length}</div>
              <div className="metric-progress-linear">
                <div className="linear-fill cyan" style={{ width: '100%' }}></div>
              </div>
            </div>
            <div className="metric-footer">Ítems activos registrados.</div>
          </div>

          {/* Architecture Card */}
          <div className="hud-metric-card">
            <div className="metric-header">
              <div className="metric-title-group">
                <div className="metric-icon-box magenta"><Database size={18} /></div>
                <h3>Estructura Lógica</h3>
              </div>
            </div>
            <div className="metric-body-block">
              <div className="digital-counter">{totalTables}</div>
              <div className="metric-progress-linear">
                <div className="linear-fill magenta" style={{ width: '100%' }}></div>
              </div>
            </div>
            <div className="metric-footer">Categorías y tablas mapeadas.</div>
          </div>
        </div>

        {/* BOTTOM SECTION: MISSION LOG */}
        <div className="profile-mission-log">
          <div className="log-header">
            <div className="log-title">
              <Hexagon size={24} className="log-icon-spin" />
              <h2>Bitácora del Sistema</h2>
            </div>
            <div className="log-filters">
              <input 
                type="date" 
                className="log-date-picker" 
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                title="Filtrar por fecha"
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: 'var(--fly-white)',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  marginRight: '12px',
                  outline: 'none',
                  fontSize: '0.85rem'
                }}
              />
              <span className={`log-filter-btn ${logFilter === 'Recientes' ? 'active' : ''}`} onClick={() => setLogFilter('Recientes')}>Recientes</span>
              <span className={`log-filter-btn ${logFilter === 'Entradas' ? 'active' : ''}`} onClick={() => setLogFilter('Entradas')}>Entradas</span>
              <span className={`log-filter-btn ${logFilter === 'Salidas' ? 'active' : ''}`} onClick={() => setLogFilter('Salidas')}>Salidas</span>
            </div>
          </div>

          <div className="log-timeline-advanced">
            {filteredMovements.length > 0 ? filteredMovements.slice(0, 8).map((mov, idx) => (
              <div key={mov.id || idx} className="advanced-log-entry">
                <div className="log-connector">
                  <div className={`log-node action-${mov.action}`}>
                    <Crosshair size={12} />
                  </div>
                  <div className="log-line"></div>
                </div>
                
                <div className="log-card-holographic">
                  <div className="log-card-header">
                    <div className="log-action-type">
                      <span className={`action-badge action-${mov.action}`}>{mov.action}</span>
                    </div>
                    <div className="log-timestamp">
                      {mov.timestamp 
                        ? (typeof mov.timestamp === 'string' 
                            ? new Date(mov.timestamp).toLocaleString() 
                            : (mov.timestamp.toDate ? mov.timestamp.toDate().toLocaleString() : mov.timestamp.toLocaleString())) 
                        : mov.time}
                    </div>
                  </div>
                  <div className="log-card-body">
                    <h4 className="log-item-name">{mov.item}</h4>
                    <div className="log-details-grid">
                      {mov.qty && (
                        <div className="log-stat">
                          <span className="stat-label">CANTIDAD</span>
                          <span className="stat-value">{mov.qty}</span>
                        </div>
                      )}
                      {mov.details && (
                        <div className="log-stat full-width">
                          <span className="stat-label">DETALLES</span>
                          <span className="stat-value">{mov.details}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )) : (
              <div className="empty-log-state">
                <div className="empty-log-icon">
                  <Activity size={48} />
                </div>
                <h3>Sin Registros Operativos</h3>
                <p>El sistema está a la espera de sus primeros movimientos.</p>
              </div>
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default ProfileView;
