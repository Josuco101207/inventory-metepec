import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useInventory } from '../context/InventoryContext';
import { useTheme } from '../context/ThemeContext';
import {
  ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip
} from 'recharts';
import {
  Activity, TrendingUp, AlertTriangle, Package, ArrowUpRight, ArrowUpCircle, ArrowDownCircle,
  Warehouse, History, RotateCcw, RefreshCw, Search, Filter,
  LayoutDashboard, BarChart3, Settings, User, LogOut, Menu, X,
  Wrench, PenTool, Printer, Cpu, Layers, Archive, Landmark,
  AlertCircle, XCircle, ClipboardCheck, Loader2, Zap, Sparkles, Radio
} from 'lucide-react';
import { CATEGORY_ICONS, categoryToRoute } from '../config/categories';
import { useCategories } from '../context/CategoriesContext';
import { toast } from 'sonner';
import FlyPattern from './FlyPattern';
import FlyLogo from './FlyLogo';
import Header from './Header';
import { fetchMovementsByDate } from '../storage/supabaseStorage';
import useIsMobile from '../hooks/useIsMobile';
import BottomSheet from './BottomSheet';
import './Dashboard.css';

// ═══ Animated Counter Hook ═══
const useAnimatedCounter = (target, duration = 1200) => {
  const [count, setCount] = useState(0);
  const prevTarget = useRef(0);
  
  useEffect(() => {
    if (target === prevTarget.current) return;
    const start = prevTarget.current;
    const diff = target - start;
    if (diff === 0) return;
    
    const startTime = performance.now();
    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(Math.round(start + diff * eased));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    prevTarget.current = target;
  }, [target, duration]);
  
  return count;
};

// Limpia IDs técnicos del texto y extrae metadata estructurada
const parseMovDetails = (details) => {
  if (!details) return { text: null, facturaUrl: null, supervisorName: null, isApproval: false };
  const urlMatch = details.match(/(?:factura_url:|factura:\s*)(https?:\/\/\S+)/i);
  const facturaUrl = urlMatch ? urlMatch[1] : null;
  const supervisorMatch = details.match(/autorizado_por:([^|]+)/);
  const supervisorName = supervisorMatch ? supervisorMatch[1].trim() : null;
  const isApproval = /approval_id:/.test(details);
  
  let text = details
    .replace(/\s*\|?\s*_originalValues:\{[^}]*\}/g, '')
    .replace(/\s*\|?\s*item_id:[\w-]+/g, '')
    .replace(/\s*\|?\s*(?:factura_url:|factura:\s*)https?:\/\/\S+/gi, '')
    .replace(/\s*\|?\s*factura_id:[\w-]+/g, '')
    .replace(/\s*\|?\s*approval_id:[\w-]+/g, '')
    .replace(/\s*\|?\s*supervisor_id:[\w-]+/g, '')
    .replace(/\s*\|?\s*autorizado_por:[^|]+/g, '');

  if (text.includes('Cambios:')) {
    text = text.replace(/Cambios:\s*(.*)/, (match, p1) => {
      const changes = p1.split(', ').map(change => {
        const parts = change.split(': ');
        if (parts.length === 2) {
          const field = parts[0];
          const vals = parts[1].split(' -> ');
          if (vals.length === 2) {
            const oldVal = vals[0].replace(/"/g, '').replace(/null/g, 'nada');
            const newVal = vals[1].replace(/"/g, '').replace(/null/g, 'nada');
            return `${field} de ${oldVal} a ${newVal}`;
          }
        }
        return change.replace(/"/g, '').replace(/null/g, 'nada');
      });
      return `Se modificó: ${changes.join(', ')}`;
    });
  }

  text = text.replace(/Artículo editado \(sin cambios detectados\)/, 'Se editó el artículo sin modificar valores');

  text = text
    .replace(/^\s*\|\s*|\s*\|\s*$/g, '')
    .replace(/\s*\|\s*\|\s*/g, ' | ')
    .trim() || null;
    
  return { text, facturaUrl, supervisorName, isApproval };
};

const toLocalDateString = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Acciones con colores Fly (solo yellow/magenta/zonas, segun manual Pag. 10)
const actionColors = {
  Entrada:     { color: 'var(--zone-arcade)',   label: 'ENTRADA',  Icon: ArrowUpCircle },
  Salida:      { color: 'var(--fly-magenta)',   label: 'SALIDA', Icon: ArrowDownCircle },
  Préstamo:    { color: 'var(--zone-boliche)',  label: 'PRÉSTAMO', Icon: RefreshCw },
  Devolución:  { color: 'var(--fly-yellow)',    label: 'DEVOLUCIÓN', Icon: RefreshCw },
  Auditoría:   { color: 'var(--zone-hachas)',   label: 'AUDITORÍA', Icon: ClipboardCheck },
  Alta:        { color: 'var(--zone-arcade)',   label: 'ALTA', Icon: ArrowUpCircle },
  Edición:     { color: 'var(--zone-hachas)',   label: 'EDICIÓN', Icon: ClipboardCheck },
  Eliminación: { color: 'var(--fly-magenta)',   label: 'ELIMINACIÓN', Icon: ArrowDownCircle },
};

// ═══ Custom Tooltip Component ═══
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="fly-chart-tooltip">
      <span className="fly-chart-tooltip-label">{label}</span>
      <span className="fly-chart-tooltip-value">
        <Activity size={14} /> {payload[0].value} movimientos
      </span>
    </div>
  );
};

const Dashboard = () => {
  const { userData, isAdmin, logout } = useAuth();
  const { items, movements, loading, syncInventory, deleteItemsWithInvalidCategories, globalStats } = useInventory();
  const { categories: CATEGORIES } = useCategories();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  const todayStr = toLocalDateString(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchRef = useRef(null);
  const [movDate, setMovDate] = useState(todayStr);
  const [dayMovementsRemote, setDayMovementsRemote] = useState(null);
  const [loadingDayMov, setLoadingDayMov] = useState(false);
  const [showCriticalStock, setShowCriticalStock] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [legacyCategoriesWarning, setLegacyCategoriesWarning] = useState(null);
  const [isCriticalModalOpen, setIsCriticalModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { isMobile } = useIsMobile();

  // Animated counters for metrics
  const animatedItems = useAnimatedCounter(globalStats.items || items.length || 0);
  const animatedMovements = useAnimatedCounter(globalStats.movements || movements.length || 0);
  const animatedCritical = useAnimatedCounter(globalStats.critical || 0);

  useEffect(() => { setIsMounted(true); }, []);

  // Check for items with invalid categories (not in the 10 new categories)
  useEffect(() => {
    if (!loading && items.length > 0) {
      const validCategories = CATEGORIES.map(c => c.title);
      const invalidItems = items.filter(item => !validCategories.includes(item.category));
      if (invalidItems.length > 0) {
        const invalidCats = [...new Set(invalidItems.map(item => item.category))];
        setLegacyCategoriesWarning({
          count: invalidItems.length,
          categories: invalidCats,
          message: `${invalidItems.length} artículos tienen categorías inválidas: ${invalidCats.join(', ')}`
        });
      } else {
        setLegacyCategoriesWarning(null);
      }
    }
  }, [items, loading]);

  // Load movements for selected date directly from Supabase
  const loadDayMovements = useCallback(async (dateStr) => {
    setLoadingDayMov(true);
    try {
      const data = await fetchMovementsByDate(dateStr);
      setDayMovementsRemote(data);
    } catch (err) {
      console.error('[Dashboard] fetchMovementsByDate error:', err);
      setDayMovementsRemote(null);
    } finally {
      setLoadingDayMov(false);
    }
  }, []);

  useEffect(() => {
    loadDayMovements(movDate);
  }, [movDate, loadDayMovements]);

  // Also refresh today's movements when realtime pushes new ones
  useEffect(() => {
    if (movDate === todayStr) {
      loadDayMovements(todayStr);
    }
  }, [movements.length, todayStr]);

  const dayMovements = dayMovementsRemote ?? movements.filter(m => {
    if (!m.timestamp) return false;
    const ts = typeof m.timestamp === 'string' ? new Date(m.timestamp) : m.timestamp.toDate ? m.timestamp.toDate() : new Date(m.timestamp);
    return toLocalDateString(ts) === movDate;
  });

  const lowStockItems = useMemo(() => 
    items.filter(item => (item.qty || 0) <= (item.threshold || 0)),
    [items]
  );

  // ZONAS segun Manual Fly Extreme (Pag. 35) aplicadas a categorias
  const zones = CATEGORIES.map(cat => {
    const Icon = CATEGORY_ICONS[cat.iconName] || Package;
    return {
      id: cat.id,
      title: cat.title,
      icon: <Icon size={28} />,
      zone: cat.zone,
      route: cat.route,
    };
  });

  // Calculate quick stats for hero
  const todayMovCount = useMemo(() => {
    return movements.filter(m => {
      if (!m.timestamp) return false;
      const ts = typeof m.timestamp === 'string' ? new Date(m.timestamp) : m.timestamp.toDate ? m.timestamp.toDate() : new Date(m.timestamp);
      return toLocalDateString(ts) === todayStr;
    }).length;
  }, [movements, todayStr]);

  if (loading) {
    return (
      <div className="fly-loading-screen">
        <div className="fly-loading-rings">
          <div className="fly-loading-ring fly-loading-ring-1" />
          <div className="fly-loading-ring fly-loading-ring-2" />
          <div className="fly-loading-ring fly-loading-ring-3" />
        </div>
        <FlyLogo size={64} glow circular />
        <Loader2 className="fly-loader" size={32} />
        <p className="fly-loading-label">CARGANDO INVENTARIO</p>
        <div className="fly-loading-bar">
          <div className="fly-loading-bar-fill" />
        </div>
      </div>
    );
  }

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'BUENOS DIAS' : now.getHours() < 19 ? 'BUENAS TARDES' : 'BUENAS NOCHES';
  const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });

  return (
    <div className="fly-dashboard">
      {/* ═══ AMBIENT ORBS ═══ */}
      <div className="fly-dashboard-orb fly-dashboard-orb-1" aria-hidden="true" />
      <div className="fly-dashboard-orb fly-dashboard-orb-2" aria-hidden="true" />
      <div className="fly-dashboard-orb fly-dashboard-orb-3" aria-hidden="true" />
      <div className="fly-dashboard-grid-overlay" aria-hidden="true" />

      {!isMobile && <Header />}

      {/* ═══ LEGACY CATEGORY WARNING ═══ */}
      {legacyCategoriesWarning && (
        <div className="fly-legacy-warning">
          <div className="fly-legacy-warning-content">
            <div className="fly-legacy-warning-icon">
              <AlertCircle size={24} />
            </div>
            <div className="fly-legacy-warning-text">
              <h4>Migración de Categorías Requerida</h4>
              <p>{legacyCategoriesWarning.message}. Se recomienda editar estos artículos para asignarles las nuevas categorías.</p>
            </div>
            <div className="fly-legacy-warning-actions">
              <button
                className="fly-legacy-warning-delete"
                onClick={() => {
                  deleteItemsWithInvalidCategories(CATEGORIES.map(c => c.title), userData?.name || 'Admin');
                  setLegacyCategoriesWarning(null);
                }}
              >
                Eliminar {legacyCategoriesWarning.count} artículos
              </button>
              <button
                className="fly-legacy-warning-dismiss"
                onClick={() => setLegacyCategoriesWarning(null)}
              >
                <XCircle size={20} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ HERO SECTION ═══ */}
      <section className="fly-hero-section">
        <div className="fly-hero-bg-accent" />
        <div className="fly-hero-bg-accent-2" aria-hidden="true" />
        <div className="fly-hero-content">
          <div className="fly-hero-top">
            <span className="fly-hero-badge">
              <span className="fly-pulse-dot" /> LIVE · {now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}
            </span>
            <span className="fly-hero-time-badge">
              <Radio size={12} /> {timeStr.toUpperCase()}
            </span>
          </div>
          <h1 className="fly-hero-title">
            <span className="fly-hero-kicker">{greeting},</span>
            <span className="fly-hero-name">{(userData?.name || 'OPERADOR').toUpperCase()}</span>
          </h1>
          <p className="fly-hero-sub">
            CENTRO DE CONTROL <span className="fly-accent-yellow">FLY EXTREME</span> — 
            GESTION TOTAL DE ACTIVOS &amp; SUMINISTROS
          </p>
          <div className="fly-hero-quick-stats">
            <div className="fly-hero-stat">
              <Sparkles size={14} />
              <span><strong>{todayMovCount}</strong> movimientos hoy</span>
            </div>
            <div className="fly-hero-stat">
              <Package size={14} />
              <span><strong>{items.length}</strong> artículos activos</span>
            </div>
            {lowStockItems.length > 0 && (
              <div className="fly-hero-stat fly-hero-stat--alert">
                <AlertTriangle size={14} />
                <span><strong>{lowStockItems.length}</strong> stock crítico</span>
              </div>
            )}
          </div>
        </div>
        <div className="fly-hero-glow" aria-hidden="true" />
      </section>

      {/* ═══ METRICS / STATS ═══ */}
      <section className="fly-metrics-row">
        <div className="fly-metric-card fly-metric-yellow fly-metric-card--animated fly-shimmer" style={{'--stagger': 0}}>
          <div className="fly-metric-icon-wrap">
            <div className="fly-stat-ring fly-stat-ring--yellow" />
            <Package size={24} />
          </div>
          <div className="fly-metric-data">
            <span className="fly-metric-label">TOTAL ACTIVOS</span>
            <span className="fly-metric-value">{animatedItems}</span>
            <span className="fly-metric-foot">ARTICULOS REGISTRADOS</span>
          </div>
          <div className="fly-metric-shape" />
        </div>

        <div className="fly-metric-card fly-metric-magenta fly-metric-card--animated fly-shimmer" style={{'--stagger': 1}}>
          <div className="fly-metric-icon-wrap">
            <div className="fly-stat-ring fly-stat-ring--magenta" />
            <TrendingUp size={24} />
          </div>
          <div className="fly-metric-data">
            <span className="fly-metric-label">MOVIMIENTOS</span>
            <span className="fly-metric-value">{animatedMovements}</span>
            <span className="fly-metric-foot">ACTIVIDAD REGISTRADA</span>
          </div>
          <div className="fly-metric-shape" />
        </div>

        <div 
          className="fly-metric-card fly-metric-alert fly-metric-card--animated fly-shimmer"
          style={{'--stagger': 2}}
          onClick={() => setIsCriticalModalOpen(true)}
          role="button"
          tabIndex={0}
        >
          <div className="fly-metric-icon-wrap">
            <div className="fly-stat-ring fly-stat-ring--alert" />
            <AlertTriangle size={24} />
          </div>
          <div className="fly-metric-data">
            <span className="fly-metric-label">STOCK CRITICO</span>
            <span className="fly-metric-value">{animatedCritical}</span>
            <span className="fly-metric-foot">REQUIERE ATENCION →</span>
          </div>
          <div className="fly-metric-shape" />
          {(globalStats.critical || lowStockItems.length) > 0 && (
            <div className="fly-metric-alert-pulse" aria-hidden="true" />
          )}
        </div>
      </section>

      {/* ═══ MAIN GRID: CHART + ZONES ═══ */}
      <section className="fly-main-grid">
        {/* Chart card */}
        <div className="fly-chart-card">
          <div className="fly-chart-card-glow" aria-hidden="true" />
          <div className="fly-card-header">
            <div>
              <h2 className="fly-card-title">
                <Activity size={20} style={{ verticalAlign: '-4px', marginRight: 8 }} />
                ACTIVIDAD
              </h2>
              <p className="fly-card-sub">FLUJO SEMANAL DE MOVIMIENTOS</p>
            </div>
          </div>
          <div className="fly-chart-body">
            {isMounted && globalStats.activity?.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={globalStats.activity}>
                  <defs>
                    <linearGradient id="flyChartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#E0DA3C" stopOpacity={0.35}/>
                      <stop offset="50%" stopColor="#DA00A3" stopOpacity={0.15}/>
                      <stop offset="100%" stopColor="#E0DA3C" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="flyLineGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#E0DA3C"/>
                      <stop offset="50%" stopColor="#DA00A3"/>
                      <stop offset="100%" stopColor="#E0DA3C"/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fontWeight: 900, fill: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em' }} 
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="movimientos" 
                    stroke="url(#flyLineGrad)" 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#flyChartGrad)" 
                    dot={{ r: 5, fill: '#E0DA3C', strokeWidth: 3, stroke: '#252220' }} 
                    activeDot={{ r: 8, fill: '#DA00A3', strokeWidth: 3, stroke: '#fff' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="fly-chart-empty">
                <div className="fly-chart-empty-icon">
                  <Activity size={40} />
                </div>
                <p>SIN DATOS DE ACTIVIDAD</p>
                <span className="fly-chart-empty-hint">Los datos aparecerán cuando registres movimientos</span>
              </div>
            )}
          </div>
        </div>

        {/* Zones grid */}
        <div className="fly-zones-card">
          <div className="fly-card-header">
            <div>
              <h2 className="fly-card-title">
                <Layers size={20} style={{ verticalAlign: '-4px', marginRight: 8 }} />
                SECCIONES
              </h2>
              <p className="fly-card-sub">ACCESO RAPIDO A ZONAS</p>
            </div>
          </div>
          <div className="fly-zones-grid">
            {zones.map((z, idx) => (
              <button
                key={z.id}
                className={`fly-zone-tile fly-zone-${z.zone} fly-zone-tile--3d`}
                onClick={() => navigate(z.route)}
                style={{'--zone-delay': `${idx * 60}ms`}}
              >
                <div className="fly-zone-icon">{z.icon}</div>
                <span className="fly-zone-title">{z.title.toUpperCase()}</span>
                <div className="fly-zone-corner" />
                <div className="fly-zone-glow" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ MOVIMIENTOS DEL DIA ═══ */}
      <section className="fly-movements-card">
        <div className="fly-card-header">
          <div>
            <h2 className="fly-card-title">
              <Activity size={18} style={{ color: 'var(--fly-yellow)', marginRight: 8, verticalAlign: '-3px' }} />
              MOVIMIENTOS DEL DIA
            </h2>
            <p className="fly-card-sub">
              {movDate === todayStr ? (
                <><span className="fly-pulse-dot fly-pulse-dot--inline" /> EN VIVO · TIEMPO REAL</>
              ) : movDate.toUpperCase()}
            </p>
          </div>
          <div className="fly-card-controls">
            <input 
              type="date" 
              className="fly-date-input" 
              value={movDate} 
              max={todayStr} 
              onChange={e => setMovDate(e.target.value)} 
            />
            <button className="fly-btn fly-btn-secondary" onClick={() => navigate('/transactions')}>
              VER TODO →
            </button>
          </div>
        </div>

        {loadingDayMov ? (
          <div className="fly-mov-empty">
            <Loader2 size={36} className="fly-loader" />
            <p className="fly-mov-empty-title">CARGANDO...</p>
          </div>
        ) : dayMovements.length === 0 ? (
          <div className="fly-mov-empty">
            <div className="fly-mov-empty-icon-wrap">
              <Package size={48} />
            </div>
            <p className="fly-mov-empty-title">SIN MOVIMIENTOS</p>
            <p className="fly-mov-empty-sub">No hay actividad registrada en esta fecha</p>
          </div>
        ) : (
          <div className="fly-mov-list">
            <div className="fly-mov-head">
              <span>MOVIMIENTO</span>
              <span>DETALLES</span>
              <span style={{ textAlign: 'center' }}>CANT.</span>
              <span style={{ textAlign: 'right' }}>REGISTRO</span>
            </div>
            {dayMovements.slice(0, 15).map((mov, idx) => {
              const cfg = actionColors[mov.action] || { color: 'var(--fly-white)', label: mov.action, Icon: Activity };
              const { Icon } = cfg;
              const ts = mov.timestamp?.toDate ? mov.timestamp.toDate() : new Date(mov.timestamp);
              return (
                <div 
                  key={mov.id} 
                  className="fly-mov-row fly-mov-row--stagger" 
                  style={{ '--stagger': idx, '--action-color': cfg.color }}
                >
                  <div className="fly-mov-accent-bar" style={{ background: cfg.color }} />
                  {/* Fila superior: badge+nombre | cantidad */}
                  <div className="fly-mov-top-row">
                    <div className="fly-mov-main">
                      <span className="fly-mov-badge" style={{ color: cfg.color, borderColor: cfg.color }}>
                        <Icon size={10} /> {cfg.label}
                      </span>
                      <div className="fly-mov-info">
                        <span className="fly-mov-name">{mov.item}</span>
                        <span className="fly-mov-cat">
                          {mov.category || 'GRAL'} {mov.subcategory ? `· ${mov.subcategory}` : ''}
                        </span>
                      </div>
                    </div>
                    <div className="fly-mov-qty-wrap">
                      <span className="fly-mov-qty">{mov.qty}</span>
                    </div>
                  </div>
                  {/* Fila inferior: detalle+thumbnail | usuario+hora */}
                  <div className="fly-mov-bottom-row">
                    <div className="fly-mov-notes">
                      {(() => { const { text, facturaUrl, supervisorName, isApproval } = parseMovDetails(mov.details); return (<>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text || '—'}</span>
                        {supervisorName && (
                          <span className="fly-mov-supervisor-badge">
                            👤 {supervisorName}
                          </span>
                        )}
                        {isApproval && (
                          <span className="fly-mov-approval-badge">
                            ✓ Aprobado
                          </span>
                        )}
                        {facturaUrl && !facturaUrl.toLowerCase().split('?')[0].endsWith('.pdf') && (
                          <a href={facturaUrl} target="_blank" rel="noopener noreferrer">
                            <img src={facturaUrl} alt="factura" className="fly-mov-thumb" onError={e => { e.target.style.display = 'none'; e.target.parentElement.style.display = 'none'; }} />
                          </a>
                        )}
                        {facturaUrl && facturaUrl.toLowerCase().split('?')[0].endsWith('.pdf') && (
                          <a href={facturaUrl} target="_blank" rel="noopener noreferrer" className="fly-mov-pdf-link">📄 PDF</a>
                        )}
                      </>); })()}
                    </div>
                    <div className="fly-mov-meta">
                      <span className="fly-mov-user">
                        <User size={10} /> {mov.user || userData?.name || 'SISTEMA'}
                      </span>
                      <span className="fly-mov-time">
                        {ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            {dayMovements.length > 15 && (
              <div className="fly-mov-overflow">
                <button className="fly-btn fly-btn-ghost" onClick={() => navigate('/transactions')}>
                  + {dayMovements.length - 15} movimientos más →
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ═══ MODAL STOCK CRITICO ═══ */}
      {isMobile ? (
        <BottomSheet
          isOpen={isCriticalModalOpen}
          onClose={() => setIsCriticalModalOpen(false)}
          title="STOCK CRÍTICO"
        >
          {lowStockItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', opacity: 0.6 }}>
              <Zap size={32} style={{ margin: '0 auto 10px' }} />
              <h4>TODO EN ORDEN</h4>
              <p style={{ fontSize: '0.85rem' }}>No hay artículos con stock crítico</p>
            </div>
          ) : (
            <div className="fly-modal-list">
              {lowStockItems.slice(0, 500).map(item => (
                <div key={item.id} className="fly-crit-row" style={{ padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="fly-crit-info">
                    <span className="fly-crit-name" style={{ fontSize: '0.95rem', fontWeight: 700, color: 'rgba(255,255,255,0.95)' }}>{item.name}</span>
                    <span className="fly-crit-cat" style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', display: 'block' }}>{item.category || 'GENERAL'}</span>
                  </div>
                  <div className="fly-crit-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                    <div className="fly-crit-stats" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="fly-crit-qty" style={{ fontSize: '1.2rem', fontWeight: 900, color: '#ff3b30' }}>{item.qty || 0}</span>
                      <span className="fly-crit-thresh" style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>/ {item.threshold || 0}</span>
                      <span className="fly-crit-unit" style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>{item.unit || 'PZA'}</span>
                    </div>
                    <button
                      className="fly-btn fly-btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '0.75rem', height: 'auto' }}
                      onClick={() => { setIsCriticalModalOpen(false); navigate(categoryToRoute(item.category)); }}
                    >
                      <Zap size={14} style={{ marginRight: 4 }} /> Ver
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </BottomSheet>
      ) : (
        isCriticalModalOpen && (
          <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setIsCriticalModalOpen(false)}>
            <div className="modal-card fly-critical-modal">
              <div className="fly-modal-header">
                <div className="fly-modal-title-block">
                  <div className="fly-modal-icon">
                    <AlertTriangle size={22} />
                  </div>
                  <div>
                    <h3 className="fly-modal-title">STOCK CRITICO</h3>
                    <p className="fly-modal-sub">{lowStockItems.length} ARTICULOS BAJO UMBRAL</p>
                  </div>
                </div>
                <button className="fly-modal-close" onClick={() => setIsCriticalModalOpen(false)}>
                  <X size={20} />
                </button>
              </div>

              {lowStockItems.length === 0 ? (
                <div className="fly-modal-empty">
                  <div className="fly-modal-empty-icon">
                    <Zap size={32} />
                  </div>
                  <h4>TODO EN ORDEN</h4>
                  <p>No hay articulos con stock critico</p>
                </div>
              ) : (
                <div className="fly-modal-list">
                  {lowStockItems.slice(0, 500).map(item => (
                    <div key={item.id} className="fly-crit-row">
                      <div className="fly-crit-info">
                        <span className="fly-crit-name">{item.name}</span>
                        <span className="fly-crit-cat">{item.category || 'GENERAL'}</span>
                      </div>
                      <div className="fly-crit-actions">
                        <div className="fly-crit-stats">
                          <span className="fly-crit-stats-label">STOCK / MIN</span>
                          <div className="fly-crit-stats-values">
                            <span className="fly-crit-qty">{item.qty || 0}</span>
                            <span className="fly-crit-thresh">/ {item.threshold || 0}</span>
                            <span className="fly-crit-unit">{item.unit || 'PZA'}</span>
                          </div>
                        </div>
                        <button
                          className="fly-crit-go"
                          title="Ir a categoria"
                          onClick={() => { setIsCriticalModalOpen(false); navigate(categoryToRoute(item.category)); }}
                        >
                          <Zap size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
};

export default Dashboard;
