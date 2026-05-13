import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Wrench, PenTool, Package, Printer, Cpu, Landmark, AlertTriangle, 
  Loader2, Archive, DollarSign, BarChart3, Layers, ArrowUpCircle,
  ArrowDownCircle, Calendar, X, RefreshCw, ClipboardCheck, Activity, User, Zap
} from 'lucide-react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import Header from './Header';
import './Dashboard.css';

const categoryToRoute = (category) => {
  const map = {
    'Tornillería': '/tornilleria', 'Papelería': '/papeleria',
    'Herramientas': '/herramientas', 'Impresión 3D': '/impresion-3d',
    'Electrónica': '/electronica', 'Inventario General': '/general',
    'Almacén Temporal': '/almacen-temporal', 'Parques': '/parques',
  };
  return map[category] || '/general';
};

const toLocalDateString = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const actionColors = {
  Entrada:     { color: '#16a34a', bg: '#f0fff4', Icon: ArrowUpCircle },
  Salida:      { color: '#dc2626', bg: '#fff1f1', Icon: ArrowDownCircle },
  Préstamo:    { color: '#5856d6', bg: '#f0f0ff', Icon: RefreshCw },
  Devolución:  { color: '#0071e3', bg: '#f0f7ff', Icon: RefreshCw },
  Auditoría:   { color: '#ff9500', bg: '#fff8f0', Icon: ClipboardCheck },
  Alta:        { color: '#16a34a', bg: '#f0fdf4', Icon: ArrowUpCircle },
  Edición:     { color: '#ea580c', bg: '#fff7ed', Icon: ClipboardCheck },
  Eliminación: { color: '#dc2626', bg: '#fef2f2', Icon: ArrowDownCircle },
};

const Dashboard = () => {
  const { items, movements, loading, globalStats } = useInventory();
  const { userData, isAdmin } = useAuth();
  const navigate = useNavigate();
  const todayStr = toLocalDateString(new Date());
  const [movDate, setMovDate] = useState(todayStr);
  const [isCriticalModalOpen, setIsCriticalModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const dayMovements = useMemo(() =>
    movements.filter(m => {
      if (!m.timestamp) return false;
      return toLocalDateString(m.timestamp.toDate()) === movDate;
    }),
    [movements, movDate]
  );

  const lowStockItems = useMemo(() => 
    items.filter(item => (item.qty || 0) <= (item.threshold || 0)),
    [items]
  );

  const categories = [
    { id: 'tornilleria', title: 'Tornillería', icon: <Wrench size={22} />, color: '#0071e3', route: '/tornilleria' },
    { id: 'papeleria', title: 'Papelería', icon: <PenTool size={22} />, color: '#ff9500', route: '/papeleria' },
    { id: 'herramientas', title: 'Herramientas', icon: <Package size={22} />, color: '#5856d6', route: '/herramientas' },
    { id: 'impresion', title: 'Impresión 3D', icon: <Printer size={22} />, color: '#af52de', route: '/impresion-3d' },
    { id: 'electronica', title: 'Electrónica', icon: <Cpu size={22} />, color: '#ff2d55', route: '/electronica' },
    { id: 'general', title: 'General', icon: <Layers size={22} />, color: '#8e8e93', route: '/general' },
    { id: 'almacen', title: 'Almacén', icon: <Archive size={22} />, color: '#636366', route: '/almacen-temporal' },
    { id: 'parques', title: 'Parques', icon: <Landmark size={22} />, color: '#34c759', route: '/parques' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen w-full bg-slate-950">
        <Loader2 className="animate-spin text-blue-500" size={48} />
      </div>
    );
  }

  return (
    <div className="dashboard-wrapper">
      <Header />
      
      <header className="dashboard-hero">
        <span className="hero-date">{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        <h1 className="hero-title">Gestión de <br/> <span>Activos.</span></h1>
      </header>

      <section className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon-box" style={{ backgroundColor: '#f0f7ff', color: '#0071e3' }}>
            <Package size={32} />
          </div>
          <div>
            <p className="metric-label">Total Inventario</p>
            <div className="metric-value-row">
               <span className="metric-value">{globalStats.items || 0}</span>
               <span className="metric-unit">Artículos</span>
            </div>
          </div>
        </div>

        <div 
          className="metric-card" 
          onClick={() => setIsCriticalModalOpen(true)}
          style={{ cursor: 'pointer' }}
        >
          <div className="metric-icon-box" style={{ backgroundColor: '#fff1f1', color: '#ff3b30' }}>
            <AlertTriangle size={32} />
          </div>
          <div>
            <p className="metric-label">Stock Crítico</p>
            <div className="metric-value-row">
               <span className="metric-value" style={{ color: '#ff3b30' }}>{globalStats.critical || 0}</span>
               <span className="metric-unit">Alertas</span>
            </div>
          </div>
        </div>
      </section>

      <div className="dashboard-main-grid">
        <div className="chart-card">
          <div className="chart-header">
            <div className="chart-title">
               <h3>Actividad</h3>
               <p>Movimientos semanales (Datos Reales)</p>
            </div>
            <button className="btn-apple-primary flex items-center gap-2" onClick={() => navigate('/analytics')}>
              <BarChart3 size={16} /> Ver Análisis
            </button>
          </div>
          <div style={{ height: '320px', width: '100%' }}>
            {isMounted && globalStats.activity?.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={globalStats.activity}>
                  <defs>
                    <linearGradient id="appleGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0071e3" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#0071e3" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#86868b' }} />
                  <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }} />
                  <Area type="monotone" dataKey="movimientos" stroke="#0071e3" strokeWidth={5} fillOpacity={1} fill="url(#appleGrad)" dot={{ r: 5, fill: '#0071e3', strokeWidth: 3, stroke: '#fff' }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="categories-card">
          <h3 className="categories-title">Secciones</h3>
          <div className="categories-grid">
            {categories.map(cat => (
              <div key={cat.id} className="category-item" onClick={() => navigate(cat.route)}>
                <div className="cat-icon-box" style={{ backgroundColor: `${cat.color}15`, color: cat.color }}>
                  {cat.icon}
                </div>
                <span className="cat-name">{cat.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="dash-movements-card">
        <div className="dash-mov-header">
          <div>
            <h3 className="dash-mov-title">
              <Activity size={18} className="dash-mov-title-icon" />
              Movimientos del día
            </h3>
            <p className="dash-mov-sub">
              {movDate === todayStr ? 'Hoy — en tiempo real' : movDate}
            </p>
          </div>
          <div className="dash-mov-controls">
            <input type="date" className="dash-date-input" value={movDate} max={todayStr} onChange={e => setMovDate(e.target.value)} />
            <button className="dash-ver-todo-btn" onClick={() => navigate('/transactions')}>Ver todo</button>
          </div>
        </div>

        {dayMovements.length === 0 ? (
          <div className="dash-mov-empty">
            <Package size={40} style={{ color: '#cbd5e1' }} />
            <p>Sin movimientos hoy</p>
          </div>
        ) : (
          <div className="dash-mov-list">
            <div className="dash-mov-header-row">
              <span>MOVIMIENTO</span>
              <span>DETALLES</span>
              <span style={{ textAlign: 'center' }}>CANT.</span>
              <span style={{ textAlign: 'right' }}>REGISTRO</span>
            </div>
            {dayMovements.slice(0, 15).map(mov => {
              const cfg = actionColors[mov.action] || { color: '#8e8e93', bg: '#f2f2f7', Icon: Activity };
              const { Icon } = cfg;
              return (
                <div key={mov.id} className="dash-mov-row compact-premium">
                  {/* Col 1: Action + Item */}
                  <div className="mov-col-main">
                    <span className="mov-badge-mini" style={{ color: cfg.color, background: cfg.bg }}>
                      <Icon size={10} /> {mov.action}
                    </span>
                    <div className="mov-item-info">
                      <span className="mov-item-name">{mov.item}</span>
                      <span className="mov-item-sub">{mov.category || 'Gral'} {mov.subcategory ? `• ${mov.subcategory}` : ''}</span>
                    </div>
                  </div>
                  
                  {/* Col 2: Notes */}
                  <div className="mov-col-notes">
                    <span className="mov-note-text">{mov.details || '—'}</span>
                  </div>

                  {/* Col 3: Qty */}
                  <div className="mov-col-qty">
                    <span className="mov-qty-pill">{mov.qty}</span>
                  </div>

                  {/* Col 4: User + Time */}
                  <div className="mov-col-meta">
                    <span className="mov-user-tag">
                      <User size={10} /> {mov.user || 'Jonathan'}
                    </span>
                    <span className="mov-time-tag">
                      {mov.timestamp?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: true})}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isCriticalModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card animate-scale-up crit-modal-card">
            <div className="crit-modal-header">
              <div className="crit-modal-title-group">
                <div className="crit-modal-icon">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="crit-modal-title">Stock Crítico</h3>
                  <p className="crit-modal-subtitle">{lowStockItems.length} artículos por debajo del umbral</p>
                </div>
              </div>
              <button className="crit-modal-close" onClick={() => setIsCriticalModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            {lowStockItems.length === 0 ? (
              <div className="crit-modal-empty">
                <div className="crit-empty-icon">
                  <Zap size={28} />
                </div>
                <h4 className="crit-empty-title">Todo en orden</h4>
                <p className="crit-empty-subtitle">No hay artículos con stock crítico</p>
              </div>
            ) : (
              <div className="crit-modal-list">
                <div className="crit-modal-list-inner">
                  {lowStockItems.slice(0, 500).map(item => (
                    <div key={item.id} className="crit-item-row">
                      <div className="crit-item-info">
                        <span className="crit-item-name">{item.name}</span>
                        <span className="crit-item-cat">{item.category || 'General'}</span>
                      </div>
                      <div className="crit-item-actions">
                        <div className="crit-item-stats">
                          <span className="crit-item-stats-label">Stock / Mín</span>
                          <div className="crit-item-stats-values">
                            <span className="crit-item-qty">{item.qty || 0}</span>
                            <span className="crit-item-thresh">/ {item.threshold || 0}</span>
                            <span className="crit-item-unit">{item.unit || 'PZA'}</span>
                          </div>
                        </div>
                        <button
                          className="crit-item-go-btn"
                          title="Ir a categoría"
                          onClick={() => { setIsCriticalModalOpen(false); navigate(categoryToRoute(item.category)); }}
                        >
                          <Zap size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
