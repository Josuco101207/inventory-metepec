import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useInventory } from '../context/InventoryContext';
import { useCategories } from '../context/CategoriesContext';
import {
  Activity, Package, AlertTriangle, Crosshair, Cpu, Hexagon,
  Zap, Radio, Fingerprint, Lock, Unlock, Eye, BarChart2
} from 'lucide-react';
import { CATEGORY_ICONS, categoryToRoute } from '../config/categories';
import { fetchMovementsByDate } from '../storage/supabaseStorage';
import useIsMobile from '../hooks/useIsMobile';
import BottomSheet from './BottomSheet';
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from 'recharts';
import './Dashboard.css';

/* ═══════════════════════════════════════════════════════════════
   HOOKS Y UTILIDADES AVANZADAS
   ═══════════════════════════════════════════════════════════════ */

// 1. Mouse Parallax Tracker
const useMousePosition = () => {
  const [pos, setPos] = useState({ x: 0, y: 0, normX: 0, normY: 0 });
  useEffect(() => {
    const handleMove = (e) => {
      const { innerWidth, innerHeight } = window;
      const x = e.clientX;
      const y = e.clientY;
      // Normalizado de -1 a 1
      setPos({
        x, y,
        normX: (x / innerWidth) * 2 - 1,
        normY: (y / innerHeight) * 2 - 1
      });
    };
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);
  return pos;
};

// 2. Kinetic Decrypt Typography
const DecryptText = ({ text, delay = 0, speed = 40, active = true }) => {
  const [display, setDisplay] = useState('');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*()_+{}|[]<>';
  
  useEffect(() => {
    if (!active) return;
    let iteration = 0;
    const strText = String(text);
    let interval = null;

    const start = () => {
      interval = setInterval(() => {
        setDisplay(strText.split('').map((letter, index) => {
          if(index < iteration) return strText[index];
          return chars[Math.floor(Math.random() * chars.length)];
        }).join(''));
        
        if (iteration >= strText.length) clearInterval(interval);
        iteration += 1 / 3; // Velocidad de desencriptación
      }, speed);
    };

    const timeout = setTimeout(start, delay);
    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, [text, delay, speed, active]);

  return <span className="decrypted-text">{display || text}</span>;
};

// Utilidades para formatear movimientos
const toLocalDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

const actionColors = {
  Entrada: 'var(--zone-arcade)', Salida: 'var(--fly-magenta)',
  Préstamo: 'var(--zone-boliche)', Devolución: 'var(--fly-yellow)',
  Auditoría: 'var(--zone-hachas)', Edición: 'var(--zone-hachas)',
  Alta: 'var(--zone-arcade)', Eliminación: 'var(--fly-magenta)'
};

/* ═══════════════════════════════════════════════════════════════
   COMPONENTES VISUALES HUD
   ═══════════════════════════════════════════════════════════════ */

// El Núcleo de Datos (SVG Radar)
const DataCore = ({ itemsCount, critCount, healthScore }) => {
  return (
    <div className="hud-datacore">
      <div className="hud-core-rings">
        <svg viewBox="0 0 400 400" className="hud-core-svg">
          {/* Anillo externo métrico */}
          <circle cx="200" cy="200" r="180" className="core-ring-outer" />
          <circle cx="200" cy="200" r="180" className="core-ring-outer-dash" strokeDasharray={`10 ${100 - healthScore} 5 20`} />
          
          {/* Anillo de zonas */}
          <circle cx="200" cy="200" r="140" className="core-ring-mid" />
          
          {/* Reactor interno */}
          <circle cx="200" cy="200" r="90" className="core-ring-inner" />
          <polygon points="200,120 270,240 130,240" className="core-triangle" />
          
          {/* Crosshair */}
          <line x1="200" y1="0" x2="200" y2="400" className="core-crosshair" />
          <line x1="0" y1="200" x2="400" y2="200" className="core-crosshair" />
        </svg>
      </div>
      
      <div className="hud-core-data">
        <div className="hud-core-status">
          <Fingerprint size={16} className="core-icon-pulse" />
          <DecryptText text="SYSTEM_ONLINE" delay={500} />
        </div>
        <div className="hud-core-main-val">
          <DecryptText text={itemsCount} delay={1000} speed={20} />
        </div>
        <div className="hud-core-label">ACTIVOS DETECTADOS</div>
        
        <div className="hud-core-health">
          <span>INTEGRIDAD: </span>
          <span style={{ color: healthScore < 80 ? 'var(--zone-hachas)' : 'var(--zone-arcade)'}}>
            <DecryptText text={`${healthScore}%`} delay={1500} />
          </span>
        </div>
      </div>
    </div>
  );
};

// Panel Holográfico
const HoloPanel = ({ title, icon: Icon, children, position, delay = 0, variant = 'default', onClick }) => {
  return (
    <div 
      className={`hud-panel panel-pos-${position} panel-var-${variant}`}
      style={{'--appear-delay': `${delay}ms`}}
      onClick={onClick}
    >
      <div className="hud-panel-frame">
        <div className="hud-panel-corner tl" />
        <div className="hud-panel-corner tr" />
        <div className="hud-panel-corner bl" />
        <div className="hud-panel-corner br" />
        
        <div className="hud-panel-header">
          <div className="panel-title-group">
            {Icon && <Icon size={14} className="panel-icon" />}
            <span className="panel-title"><DecryptText text={title} delay={delay + 300} /></span>
          </div>
          <div className="panel-deco-line" />
        </div>
        
        <div className="hud-panel-content">
          {children}
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD PRINCIPAL
   ═══════════════════════════════════════════════════════════════ */

const Dashboard = () => {
  const { userData, isAdmin } = useAuth();
  const { items, movements, globalStats, loading } = useInventory();
  const { categories: CATEGORIES } = useCategories();
  const navigate = useNavigate();
  const { isMobile } = useIsMobile();
  const mouse = useMousePosition();
  
  const today = toLocalDate(new Date());
  const [dayMovs, setDayMovs] = useState([]);
  const [critModal, setCritModal] = useState(false);
  const [systemReady, setSystemReady] = useState(false);

  // Efecto de encendido del sistema
  useEffect(() => {
    if (!loading) {
      setTimeout(() => setSystemReady(true), 800); // Boot sequence delay
    }
  }, [loading]);

  // Fetch movimientos del día
  useEffect(() => {
    if (!loading) {
      fetchMovementsByDate(today).then(data => setDayMovs(data || []));
    }
  }, [loading, today]);

  // Cálculos de datos
  const lowStock = useMemo(() => items.filter(i => (i.qty||0) <= (i.threshold||0)), [items]);
  const healthScore = useMemo(() => {
    if (!items.length) return 100;
    const criticalRatio = lowStock.length / items.length;
    return Math.max(0, Math.round(100 - (criticalRatio * 200))); // Penarización doble por crítico
  }, [items, lowStock]);

  const catDistribution = useMemo(() => {
    const map = {};
    items.forEach(i => { map[i.category] = (map[i.category]||0) + 1; });
    return Object.entries(map).sort((a,b) => b[1]-a[1]).slice(0,6);
  }, [items]);

  if (loading || !systemReady) {
    return (
      <div className="hud-boot-sequence">
        <div className="boot-terminal">
          <p>{'>'} INICIANDO SISTEMA FLY_EXTREME_OS v3.0</p>
          <p>{'>'} ESTABLECIENDO CONEXIÓN CON SATÉLITE...</p>
          <p className="boot-blink">{'>'} DESENCRIPTANDO NÚCLEO DE DATOS <span className="cursor">_</span></p>
          <div className="boot-bar-container"><div className="boot-bar" /></div>
        </div>
      </div>
    );
  }

  // Parallax transform variables
  const parallaxVars = isMobile ? {} : {
    '--mouse-x': mouse.normX,
    '--mouse-y': mouse.normY
  };

  return (
    <div className="hud-environment" style={parallaxVars}>
      
      {/* Grid espacial y FX */}
      <div className="hud-grid-floor" />
      <div className="hud-vignette" />
      <div className="hud-scanlines" />

      {/* Top Bar HUD */}
      <div className="hud-top-bar">
        <div className="top-bar-left">
          <div className="hud-brand"><Zap size={14} className="brand-zap"/> FLY EXTREME NEXUS</div>
          <div className="hud-auth">
            <Lock size={12} className={isAdmin ? 'auth-admin' : 'auth-user'} />
            <DecryptText text={`USR: ${userData?.name?.toUpperCase() || 'OPERATOR'}`} delay={1000} />
          </div>
        </div>
        <div className="top-bar-right">
          <div className="hud-clock">
            T-{new Date().toLocaleTimeString('en-US', { hour12: false })}
          </div>
          <button className="hud-btn-exit" onClick={() => navigate('/login')}>CERRAR_ENLACE</button>
        </div>
      </div>

      {/* ════ NÚCLEO CENTRAL ════ */}
      <div className="hud-center-stage">
        <DataCore 
          itemsCount={globalStats.items || items.length} 
          critCount={globalStats.critical || lowStock.length}
          healthScore={healthScore}
        />
      </div>

      {/* ════ PANELES HOLOGRÁFICOS ════ */}

      {/* Panel Izquierdo: Zonas de Acceso Rápidp */}
      <HoloPanel title="SISTEMAS_DE_ZONA" icon={Hexagon} position="left" delay={600}>
        <div className="hud-zone-list">
          {CATEGORIES.map((cat, i) => {
            const Icon = CATEGORY_ICONS[cat.iconName] || Package;
            const route = categoryToRoute(cat.title);
            return (
              <button key={cat.id} className="hud-zone-btn" onClick={() => navigate(route)} style={{'--i': i}}>
                <div className="zone-btn-bracket left">[</div>
                <div className="zone-btn-content" style={{color: `var(--zone-${cat.route || cat.iconName})`}}>
                  <Icon size={14} />
                  <span>{cat.shortTitle || cat.title}</span>
                </div>
                <div className="zone-btn-bracket right">]</div>
              </button>
            );
          })}
        </div>
      </HoloPanel>

      {/* Panel Inferior Izquierdo: Gráfico de Flujo */}
      <HoloPanel title="FLUJO_TELEMETRÍA" icon={Activity} position="bottom-left" delay={800}>
        <div className="hud-chart-container">
           {globalStats.activity?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={globalStats.activity}>
                  <defs>
                    <linearGradient id="hudGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#E0DA3C" stopOpacity={0.6}/>
                      <stop offset="100%" stopColor="#DA00A3" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" hide />
                  <Tooltip cursor={{stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1, strokeDasharray: '4 4'}} contentStyle={{backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid #E0DA3C', color: '#fff'}} />
                  <Area type="step" dataKey="movimientos" stroke="#E0DA3C" strokeWidth={2} fill="url(#hudGlow)" />
                </AreaChart>
              </ResponsiveContainer>
           ) : (
             <div className="hud-no-data">SIN SEÑAL</div>
           )}
        </div>
      </HoloPanel>

      {/* Panel Derecho: Feed de Operaciones */}
      <HoloPanel title="OPERACIONES_RECIENTES" icon={Radio} position="right" delay={1000}>
        <div className="hud-feed-container">
          <div className="hud-feed-stats">
            <span className="feed-stat-hl"><DecryptText text={dayMovs.length} delay={1500}/></span> REGISTROS HOY
          </div>
          <div className="hud-feed-scroll">
            {dayMovs.length === 0 ? (
              <div className="hud-no-data">ESPERANDO TRANSMISIÓN...</div>
            ) : (
              dayMovs.slice(0, 15).map((mov, i) => {
                const color = actionColors[mov.action] || 'var(--fly-white)';
                return (
                  <div key={mov.id} className="hud-feed-item" style={{'--i': i}}>
                    <div className="feed-item-line" style={{background: color}} />
                    <div className="feed-item-content">
                      <div className="feed-item-head">
                        <span className="feed-item-action" style={{color}}>[{mov.action.toUpperCase()}]</span>
                        <span className="feed-item-time">{new Date(mov.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit', hour12:false})}</span>
                      </div>
                      <div className="feed-item-name">{mov.item} <span className="feed-item-qty">x{mov.qty}</span></div>
                      <div className="feed-item-user">OP: {mov.user || 'SYS'}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <button className="hud-btn-nav" onClick={() => navigate('/transactions')}>VER_BITÁCORA_COMPLETA {'>'}</button>
        </div>
      </HoloPanel>

      {/* Panel Inferior Derecho: Alertas de Integridad */}
      <HoloPanel 
        title="ALERTAS_DE_INTEGRIDAD" 
        icon={AlertTriangle} 
        position="bottom-right" 
        delay={1200}
        variant={lowStock.length > 0 ? 'alert' : 'default'}
      >
        <div className="hud-alerts-container">
          {lowStock.length === 0 ? (
            <div className="hud-alerts-ok">
              <Cpu size={24} className="alert-ok-icon" />
              <DecryptText text="PARÁMETROS NOMINALES" delay={1800} />
            </div>
          ) : (
            <>
              <div className="hud-alerts-warning">
                <AlertTriangle size={24} className="alert-warn-icon" />
                <span className="alert-warn-text"><DecryptText text={`${lowStock.length} COMPONENTES CRÍTICOS`} delay={1800} /></span>
              </div>
              <div className="hud-alerts-preview">
                {lowStock.slice(0,3).map(item => (
                  <div key={item.id} className="alert-preview-item">
                    <span className="alert-item-name">{item.name}</span>
                    <span className="alert-item-qty">{item.qty}/{item.threshold}</span>
                  </div>
                ))}
              </div>
              <button className="hud-btn-nav alert-btn" onClick={() => setCritModal(true)}>INSPECCIONAR_FALLOS {'>'}</button>
            </>
          )}
        </div>
      </HoloPanel>

      {/* Modal Crítico (HUD Overlay) */}
      {critModal && (
        <div className="hud-overlay">
          <div className="hud-modal-frame">
            <div className="hud-modal-scanline" />
            <div className="hud-modal-header">
              <div className="modal-header-title">
                <AlertTriangle size={18} color="var(--zone-hachas)" />
                <span>INFORME DE VULNERABILIDAD MATERIAL</span>
              </div>
              <button className="hud-btn-close" onClick={() => setCritModal(false)}>[ X ]</button>
            </div>
            <div className="hud-modal-body">
              <table className="hud-data-table">
                <thead>
                  <tr>
                    <th>ACTIVO</th>
                    <th>ZONA</th>
                    <th>NIVEL</th>
                    <th>UMBRAL</th>
                    <th>ACCIÓN</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStock.map(item => (
                    <tr key={item.id}>
                      <td className="data-hl">{item.name}</td>
                      <td>{item.category}</td>
                      <td className="data-warn">{item.qty}</td>
                      <td>{item.threshold}</td>
                      <td>
                        <button className="hud-btn-action" onClick={() => {setCritModal(false); navigate(categoryToRoute(item.category));}}>
                          RESOLVER
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
