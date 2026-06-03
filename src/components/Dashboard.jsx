import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useInventory } from '../context/InventoryContext';

import {
  ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, Tooltip, BarChart, Bar
} from 'recharts';
import {
  Activity, TrendingUp, AlertTriangle, Package, ArrowUpCircle, ArrowDownCircle,
  RefreshCw, User, X, AlertCircle, XCircle, ClipboardCheck, Loader2, Zap,
  Sparkles, Radio, ChevronRight, Clock, Shield, Flame, Eye, ArrowRight
} from 'lucide-react';
import { CATEGORY_ICONS, categoryToRoute } from '../config/categories';
import { useCategories } from '../context/CategoriesContext';

import FlyLogo from './FlyLogo';
import Header from './Header';
import { fetchMovementsByDate } from '../storage/supabaseStorage';
import useIsMobile from '../hooks/useIsMobile';
import BottomSheet from './BottomSheet';
import './Dashboard.css';

/* ═══ Animated Counter ═══ */
const useCounter = (target, dur = 1400) => {
  const [val, setVal] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    if (target === prev.current) return;
    const s = prev.current, d = target - s;
    if (!d) return;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min((now - t0) / dur, 1);
      const e = p === 1 ? 1 : 1 - Math.pow(2, -12 * p);
      setVal(Math.round(s + d * e));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    prev.current = target;
  }, [target, dur]);
  return val;
};

/* ═══ Helpers ═══ */
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
    text = text.replace(/Cambios:\s*(.*)/, (_, p1) => {
      const changes = p1.split(', ').map(c => {
        const parts = c.split(': ');
        if (parts.length === 2) {
          const vals = parts[1].split(' -> ');
          if (vals.length === 2) return `${parts[0]} de ${vals[0].replace(/"/g, '').replace(/null/g, 'nada')} a ${vals[1].replace(/"/g, '').replace(/null/g, 'nada')}`;
        }
        return c.replace(/"/g, '').replace(/null/g, 'nada');
      });
      return `Se modificó: ${changes.join(', ')}`;
    });
  }
  text = text.replace(/Artículo editado \(sin cambios detectados\)/, 'Se editó sin modificar valores');
  text = text.replace(/^\s*\|\s*|\s*\|\s*$/g, '').replace(/\s*\|\s*\|\s*/g, ' | ').trim() || null;
  return { text, facturaUrl, supervisorName, isApproval };
};

const toLocalDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

const actionMap = {
  Entrada:     { color: 'var(--zone-arcade)',  bg: 'rgba(141,198,63,0.12)',  label: 'ENTRADA',  Icon: ArrowUpCircle },
  Salida:      { color: 'var(--fly-magenta)',  bg: 'rgba(218,0,163,0.12)',   label: 'SALIDA',   Icon: ArrowDownCircle },
  Préstamo:    { color: 'var(--zone-boliche)', bg: 'rgba(0,173,239,0.12)',   label: 'PRÉSTAMO', Icon: RefreshCw },
  Devolución:  { color: 'var(--fly-yellow)',   bg: 'rgba(224,218,60,0.12)',  label: 'DEVOL.',   Icon: RefreshCw },
  Auditoría:   { color: 'var(--zone-hachas)', bg: 'rgba(247,148,30,0.12)',  label: 'AUDIT.',   Icon: ClipboardCheck },
  Alta:        { color: 'var(--zone-arcade)',  bg: 'rgba(141,198,63,0.12)',  label: 'ALTA',     Icon: ArrowUpCircle },
  Edición:     { color: 'var(--zone-hachas)', bg: 'rgba(247,148,30,0.12)',  label: 'EDICIÓN',  Icon: ClipboardCheck },
  Eliminación: { color: 'var(--fly-magenta)',  bg: 'rgba(218,0,163,0.12)',   label: 'ELIM.',    Icon: ArrowDownCircle },
};

/* ═══ Tooltip ═══ */
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="fd-tooltip">
      <span className="fd-tooltip-day">{label}</span>
      <div className="fd-tooltip-val"><Activity size={13}/> {payload[0].value} movimientos</div>
    </div>
  );
};

/* ═══════════════════════════════════════════════
   DASHBOARD COMPONENT
   ═══════════════════════════════════════════════ */
const Dashboard = () => {
  const { userData, isAdmin } = useAuth();
  const { items, movements, loading, deleteItemsWithInvalidCategories, globalStats } = useInventory();
  const { categories: CATEGORIES } = useCategories();
  const navigate = useNavigate();
  const today = toLocalDate(new Date());
  const [movDate, setMovDate] = useState(today);
  const [dayMovsRemote, setDayMovsRemote] = useState(null);
  const [loadingMov, setLoadingMov] = useState(false);
  const [critModal, setCritModal] = useState(false);
  const [legacyWarn, setLegacyWarn] = useState(null);
  const [mounted, setMounted] = useState(false);
  const { isMobile } = useIsMobile();

  const cItems = useCounter(globalStats.items || items.length || 0);
  const cMovs  = useCounter(globalStats.movements || movements.length || 0);
  const cCrit  = useCounter(globalStats.critical || 0);

  useEffect(() => { setMounted(true); }, []);

  // Legacy categories check
  useEffect(() => {
    if (!loading && items.length > 0) {
      const valid = CATEGORIES.map(c => c.title);
      const bad = items.filter(i => !valid.includes(i.category));
      if (bad.length > 0) {
        const cats = [...new Set(bad.map(i => i.category))];
        setLegacyWarn({ count: bad.length, categories: cats, message: `${bad.length} artículos con categorías inválidas: ${cats.join(', ')}` });
      } else setLegacyWarn(null);
    }
  }, [items, loading]);

  // Movements loader
  const loadMov = useCallback(async (d) => {
    setLoadingMov(true);
    try { setDayMovsRemote(await fetchMovementsByDate(d)); }
    catch { setDayMovsRemote(null); }
    finally { setLoadingMov(false); }
  }, []);

  useEffect(() => { loadMov(movDate); }, [movDate, loadMov]);
  useEffect(() => { if (movDate === today) loadMov(today); }, [movements.length, today]);

  const dayMovs = dayMovsRemote ?? movements.filter(m => {
    if (!m.timestamp) return false;
    const ts = typeof m.timestamp === 'string' ? new Date(m.timestamp) : m.timestamp.toDate ? m.timestamp.toDate() : new Date(m.timestamp);
    return toLocalDate(ts) === movDate;
  });

  const lowStock = useMemo(() => items.filter(i => (i.qty||0) <= (i.threshold||0)), [items]);

  const zones = CATEGORIES.map(cat => ({
    ...cat,
    Icon: CATEGORY_ICONS[cat.iconName] || Package,
  }));

  // Stats for today
  const todayCount = useMemo(() => movements.filter(m => {
    if (!m.timestamp) return false;
    const ts = typeof m.timestamp === 'string' ? new Date(m.timestamp) : m.timestamp.toDate ? m.timestamp.toDate() : new Date(m.timestamp);
    return toLocalDate(ts) === today;
  }).length, [movements, today]);

  // Category distribution
  const catDistribution = useMemo(() => {
    const map = {};
    items.forEach(i => { map[i.category] = (map[i.category]||0) + 1; });
    return Object.entries(map)
      .sort((a,b) => b[1]-a[1])
      .slice(0,5)
      .map(([name, count]) => ({ name: name.split(' ')[0], count }));
  }, [items]);

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Buenos días' : now.getHours() < 19 ? 'Buenas tardes' : 'Buenas noches';

  /* ═══ LOADING ═══ */
  if (loading) {
    return (
      <div className="fd-loading">
        <div className="fd-loading-spinner">
          <div className="fd-loading-ring" />
          <div className="fd-loading-ring fd-loading-ring--2" />
          <FlyLogo size={48} glow circular />
        </div>
        <p className="fd-loading-text">INICIANDO SISTEMA</p>
        <div className="fd-loading-bar"><div className="fd-loading-bar-inner" /></div>
      </div>
    );
  }

  return (
    <div className="fd">
      {/* Ambient */}
      <div className="fd-noise" aria-hidden="true" />
      <div className="fd-orb fd-orb--1" aria-hidden="true" />
      <div className="fd-orb fd-orb--2" aria-hidden="true" />

      {!isMobile && <Header />}

      {/* Legacy warning */}
      {legacyWarn && (
        <div className="fd-warn">
          <AlertCircle size={18} />
          <span>{legacyWarn.message}</span>
          <button onClick={() => { deleteItemsWithInvalidCategories(CATEGORIES.map(c=>c.title), userData?.name||'Admin'); setLegacyWarn(null); }}>Eliminar</button>
          <button className="fd-warn-x" onClick={() => setLegacyWarn(null)}><XCircle size={16}/></button>
        </div>
      )}

      {/* ═══════════ BENTO GRID ═══════════ */}
      <div className="fd-bento">

        {/* ── CARD: Identity / Hero ── */}
        <div className="fd-card fd-card--hero">
          <div className="fd-hero-orb" aria-hidden="true" />
          <div className="fd-hero-top">
            <div className="fd-live"><span className="fd-live-dot" /> EN VIVO</div>
            <span className="fd-hero-date">
              {now.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()}
            </span>
          </div>
          <div className="fd-hero-body">
            <p className="fd-hero-greeting">{greeting},</p>
            <h1 className="fd-hero-name">{(userData?.name || 'Operador').split(' ')[0]}</h1>
          </div>
          <div className="fd-hero-bottom">
            <FlyLogo size={36} circular glow />
            <div className="fd-hero-meta">
              <span className="fd-hero-role">{isAdmin ? 'ADMINISTRADOR' : 'OPERADOR'}</span>
              <span className="fd-hero-system">FLY EXTREME · INVENTARIO</span>
            </div>
          </div>
        </div>

        {/* ── CARD: Total Assets ── */}
        <div className="fd-card fd-card--stat fd-card--stat-yellow">
          <div className="fd-stat-glow" aria-hidden="true" />
          <div className="fd-stat-header">
            <Package size={20} />
            <span>ACTIVOS</span>
          </div>
          <div className="fd-stat-number">{cItems}</div>
          <div className="fd-stat-footer">
            <span>artículos registrados</span>
            <div className="fd-stat-trend fd-stat-trend--up"><TrendingUp size={12}/> activo</div>
          </div>
        </div>

        {/* ── CARD: Movements ── */}
        <div className="fd-card fd-card--stat fd-card--stat-magenta">
          <div className="fd-stat-glow" aria-hidden="true" />
          <div className="fd-stat-header">
            <Activity size={20} />
            <span>MOVIMIENTOS</span>
          </div>
          <div className="fd-stat-number">{cMovs}</div>
          <div className="fd-stat-footer">
            <span>actividad total</span>
            <div className="fd-stat-chip"><Sparkles size={11}/> {todayCount} hoy</div>
          </div>
        </div>

        {/* ── CARD: Critical Stock ── */}
        <div className="fd-card fd-card--stat fd-card--stat-alert" onClick={() => setCritModal(true)} role="button" tabIndex={0}>
          <div className="fd-stat-glow" aria-hidden="true" />
          {(globalStats.critical || lowStock.length) > 0 && <div className="fd-stat-pulse" />}
          <div className="fd-stat-header">
            <AlertTriangle size={20} />
            <span>CRÍTICO</span>
          </div>
          <div className="fd-stat-number">{cCrit}</div>
          <div className="fd-stat-footer">
            <span>bajo umbral</span>
            <div className="fd-stat-chip fd-stat-chip--alert"><Eye size={11}/> ver</div>
          </div>
        </div>

        {/* ── CARD: Activity Chart ── */}
        <div className="fd-card fd-card--chart">
          <div className="fd-card-head">
            <div>
              <h2 className="fd-card-title">Actividad Semanal</h2>
              <p className="fd-card-subtitle">Flujo de movimientos</p>
            </div>
            <div className="fd-card-badge"><Activity size={14}/> LIVE</div>
          </div>
          <div className="fd-chart-wrap">
            {mounted && globalStats.activity?.length > 0 ? (
              <ResponsiveContainer width="99%" height={250}>
                <AreaChart data={globalStats.activity}>
                  <defs>
                    <linearGradient id="cg1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#E0DA3C" stopOpacity={0.3}/>
                      <stop offset="100%" stopColor="#DA00A3" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize:10, fontWeight:800, fill:'rgba(255,255,255,0.4)', letterSpacing:'0.08em'}} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="movimientos" stroke="#E0DA3C" strokeWidth={2.5} fill="url(#cg1)" dot={{r:4, fill:'#E0DA3C', strokeWidth:2, stroke:'#252220'}} activeDot={{r:7, fill:'#DA00A3', stroke:'#fff', strokeWidth:2}} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="fd-chart-empty">
                <Activity size={32}/>
                <p>Sin datos de actividad</p>
              </div>
            )}
          </div>
        </div>

        {/* ── CARD: Category Distribution ── */}
        <div className="fd-card fd-card--distro">
          <div className="fd-card-head">
            <div>
              <h2 className="fd-card-title">Distribución</h2>
              <p className="fd-card-subtitle">Top categorías</p>
            </div>
          </div>
          <div className="fd-distro-bars">
            {catDistribution.length > 0 ? catDistribution.map((c, i) => (
              <div key={c.name} className="fd-distro-item" style={{'--delay': `${i*80}ms`}}>
                <div className="fd-distro-label">
                  <span>{c.name}</span>
                  <span className="fd-distro-count">{c.count}</span>
                </div>
                <div className="fd-distro-track">
                  <div className="fd-distro-fill" style={{width: `${Math.min((c.count / (catDistribution[0]?.count || 1)) * 100, 100)}%`, '--bar-i': i}} />
                </div>
              </div>
            )) : <p className="fd-chart-empty-text">Sin datos</p>}
          </div>
        </div>

        {/* ── CARD: Quick Access Zones ── */}
        <div className="fd-card fd-card--zones">
          <div className="fd-card-head">
            <div>
              <h2 className="fd-card-title">Secciones</h2>
              <p className="fd-card-subtitle">{zones.length} categorías</p>
            </div>
          </div>
          <div className="fd-zones-list">
            {zones.map((z, i) => {
              const ZIcon = z.Icon;
              return (
                <button key={z.id} className={`fd-zone fd-zone--${z.zone}`} onClick={() => navigate(z.route)} style={{'--zi': i}}>
                  <div className="fd-zone-icon"><ZIcon size={18} /></div>
                  <span className="fd-zone-name">{z.shortTitle || z.title}</span>
                  <ChevronRight size={14} className="fd-zone-arrow" />
                </button>
              );
            })}
          </div>
        </div>

        {/* ── CARD: Movements Feed ── */}
        <div className="fd-card fd-card--feed">
          <div className="fd-card-head">
            <div>
              <h2 className="fd-card-title">
                {movDate === today ? <><span className="fd-live-dot fd-live-dot--sm"/> Movimientos en Vivo</> : `Movimientos · ${movDate}`}
              </h2>
              <p className="fd-card-subtitle">{dayMovs.length} registros</p>
            </div>
            <div className="fd-feed-controls">
              <input type="date" className="fd-date-input" value={movDate} max={today} onChange={e => setMovDate(e.target.value)} />
              <button className="fd-btn-ghost" onClick={() => navigate('/transactions')}>Ver todo <ArrowRight size={14}/></button>
            </div>
          </div>

          {loadingMov ? (
            <div className="fd-feed-empty"><Loader2 size={28} className="fd-spin"/><p>Cargando...</p></div>
          ) : dayMovs.length === 0 ? (
            <div className="fd-feed-empty">
              <Package size={36}/>
              <p>Sin movimientos</p>
              <span>No hay actividad registrada en esta fecha</span>
            </div>
          ) : (
        <div className="fd-feed-list">
              {dayMovs.slice(0, 12).map((mov, idx) => {
                const cfg = actionMap[mov.action] || { color:'var(--fly-white)', bg:'rgba(255,255,255,0.05)', label:mov.action, Icon:Activity };
                const { Icon } = cfg;
                const ts = mov.timestamp?.toDate ? mov.timestamp.toDate() : new Date(mov.timestamp);
                const { text, supervisorName, isApproval } = parseMovDetails(mov.details);
                return (
                  <div key={mov.id} className="fd-feed-row" style={{'--fi': idx}}>
                    <div className="fd-feed-icon" style={{background: cfg.bg, color: cfg.color}}>
                      <Icon size={16}/>
                    </div>
                    <div className="fd-feed-body">
                      <div className="fd-feed-top">
                        <span className="fd-feed-name">{mov.item}</span>
                        <span className="fd-feed-qty" style={{background: cfg.bg, color: cfg.color}}>{mov.qty}</span>
                      </div>
                      <div className="fd-feed-mid">
                        <span className="fd-feed-tag" style={{color: cfg.color}}>{cfg.label}</span>
                        <span className="fd-feed-cat">{mov.category || 'GRAL'}</span>
                        {supervisorName && <span className="fd-feed-supervisor">👤 {supervisorName}</span>}
                        {isApproval && <span className="fd-feed-approved">✓</span>}
                      </div>
                      {text && <p className="fd-feed-detail">{text}</p>}
                    </div>
                    <div className="fd-feed-time">
                      <span>{ts.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', hour12:true})}</span>
                      <span className="fd-feed-user">{mov.user || userData?.name || 'Sistema'}</span>
                    </div>
                  </div>
                );
              })}
              {dayMovs.length > 12 && (
                <button className="fd-feed-more" onClick={() => navigate('/transactions')}>
                  +{dayMovs.length - 12} más <ArrowRight size={14}/>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══ CRITICAL MODAL ═══ */}
      {isMobile ? (
        <BottomSheet isOpen={critModal} onClose={() => setCritModal(false)} title="STOCK CRÍTICO">
          {lowStock.length === 0 ? (
            <div style={{textAlign:'center', padding:'2rem 1rem', opacity:0.6}}>
              <Zap size={32} style={{margin:'0 auto 10px'}}/><h4>TODO EN ORDEN</h4>
              <p style={{fontSize:'0.85rem'}}>No hay artículos con stock crítico</p>
            </div>
          ) : (
            <div className="fd-crit-list">
              {lowStock.slice(0,500).map(item => (
                <div key={item.id} className="fd-crit-row">
                  <div className="fd-crit-info">
                    <span className="fd-crit-name">{item.name}</span>
                    <span className="fd-crit-cat">{item.category || 'GENERAL'}</span>
                  </div>
                  <div className="fd-crit-right">
                    <span className="fd-crit-qty">{item.qty||0}</span>
                    <span className="fd-crit-sep">/</span>
                    <span className="fd-crit-thresh">{item.threshold||0}</span>
                    <button className="fd-crit-go" onClick={() => {setCritModal(false); navigate(categoryToRoute(item.category));}}>
                      <Zap size={13}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </BottomSheet>
      ) : critModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setCritModal(false)}>
          <div className="modal-card fd-crit-modal">
            <div className="fd-crit-header">
              <div className="fd-crit-header-left">
                <div className="fd-crit-icon-wrap"><AlertTriangle size={20}/></div>
                <div>
                  <h3>Stock Crítico</h3>
                  <p>{lowStock.length} artículos bajo umbral</p>
                </div>
              </div>
              <button className="fd-crit-close" onClick={() => setCritModal(false)}><X size={18}/></button>
            </div>
            {lowStock.length === 0 ? (
              <div className="fd-crit-empty"><Zap size={28}/><h4>Todo en orden</h4><p>No hay artículos con stock crítico</p></div>
            ) : (
              <div className="fd-crit-list">
                {lowStock.slice(0,500).map(item => (
                  <div key={item.id} className="fd-crit-row">
                    <div className="fd-crit-info">
                      <span className="fd-crit-name">{item.name}</span>
                      <span className="fd-crit-cat">{item.category || 'GENERAL'}</span>
                    </div>
                    <div className="fd-crit-right">
                      <span className="fd-crit-qty">{item.qty||0}</span>
                      <span className="fd-crit-sep">/</span>
                      <span className="fd-crit-thresh">{item.threshold||0}</span>
                      <span className="fd-crit-unit">{item.unit||'PZA'}</span>
                      <button className="fd-crit-go" onClick={() => {setCritModal(false); navigate(categoryToRoute(item.category));}}>
                        <Zap size={13}/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
