import React, { useMemo } from 'react';
import { User, Shield, Clock, TrendingUp, BarChart3, Mail, Calendar, Activity, Package, Zap, Hash, Database, Hexagon, Crosshair, ChevronRight, CheckCircle2 } from 'lucide-react';
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

  // Additional mock metrics for a premium "HUD" feel
  const currentSessionLength = "02:45:10"; 
  const systemIntegrity = "Optimo";

  return (
    <div className="fly-profile-view">
      {/* Fondos de Orbes Fluidos y Grid */}
      <div className="profile-bg-layer">
        <div className="profile-grid-overlay"></div>
        <div className="profile-fluid-bg">
          <div className="profile-orb profile-orb-1" />
          <div className="profile-orb profile-orb-2" />
          <div className="profile-orb profile-orb-3" />
        </div>
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
                  <div className="auth-level">AUTH-LVL: {isAdmin ? 'OMEGA' : 'BETA'}</div>
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
              <span className="log-filter-btn active">Recientes</span>
              <span className="log-filter-btn">Entradas</span>
              <span className="log-filter-btn">Salidas</span>
            </div>
          </div>

          <div className="log-timeline-advanced">
            {myMovements.length > 0 ? myMovements.slice(0, 8).map((mov, idx) => (
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
