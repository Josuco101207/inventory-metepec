import React, { useState, useEffect, useCallback } from 'react';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import { useCategories } from '../context/CategoriesContext';
import { ArrowUpCircle, ArrowDownCircle, RefreshCw, ClipboardCheck, HandMetal, Calendar, Loader2, X, Users, Activity, Download, AlertTriangle } from 'lucide-react';
import Header from '../components/Header';
import FlyPattern from '../components/FlyPattern';
import { useNavigate } from 'react-router-dom';
import { exportToExcel } from '../utils/exportUtils';
import { fetchMovementsByDate } from '../storage/supabaseStorage';
import useIsMobile from '../hooks/useIsMobile';
import './TransactionsView.css';

const parseMovDetails = (details) => {
  if (!details) return { text: null, facturaUrl: null, supervisorName: null, isApproval: false };
  const urlMatch = details.match(/factura_url:(https?:\/\/\S+)/);
  const facturaUrl = urlMatch ? urlMatch[1] : null;
  const supervisorMatch = details.match(/autorizado_por:([^|]+)/);
  const supervisorName = supervisorMatch ? supervisorMatch[1].trim() : null;
  const isApproval = /approval_id:/.test(details);
  const text = details
    .replace(/\s*\|?\s*item_id:[\w-]+/g, '')
    .replace(/\s*\|?\s*factura_url:https?:\/\/\S+/g, '')
    .replace(/\s*\|?\s*factura_id:[\w-]+/g, '')
    .replace(/\s*\|?\s*approval_id:[\w-]+/g, '')
    .replace(/\s*\|?\s*supervisor_id:[\w-]+/g, '')
    .replace(/\s*\|?\s*autorizado_por:[^|]+/g, '')
    .replace(/^\s*\|\s*|\s*\|\s*$/g, '')
    .replace(/\s*\|\s*\|\s*/g, ' | ')
    .trim() || null;
  return { text, facturaUrl, supervisorName, isApproval };
};

const actionConfig = {
  Entrada:     { label: 'Entrada',    color: '#34c759', bg: 'rgba(52,199,89,0.12)', icon: ArrowUpCircle },
  Salida:      { label: 'Salida',     color: '#ff3b30', bg: 'rgba(255,59,48,0.12)', icon: ArrowDownCircle },
  Préstamo:    { label: 'Préstamo',   color: '#5856d6', bg: 'rgba(88,86,214,0.12)', icon: HandMetal },
  Devolución:  { label: 'Devolución', color: '#0071e3', bg: 'rgba(0,113,227,0.12)', icon: RefreshCw },
  Auditoría:   { label: 'Auditoría',  color: '#ff9500', bg: 'rgba(255,149,0,0.12)', icon: ClipboardCheck },
  Alta:        { label: 'Alta',       color: '#16a34a', bg: 'rgba(22,163,74,0.12)',  icon: ArrowUpCircle },
  'Eliminación Masiva': { label: 'Elim. Masiva', color: '#dc2626', bg: 'rgba(220,38,38,0.12)', icon: AlertTriangle },
  Edición:     { label: 'Edición',    color: '#ea580c', bg: 'rgba(234,88,12,0.12)', icon: ClipboardCheck },
  Eliminación: { label: 'Eliminación',color: '#dc2626', bg: 'rgba(220,38,38,0.12)', icon: ArrowDownCircle },
  Anulación:   { label: 'Anulación',  color: '#64748b', bg: 'rgba(100,116,139,0.12)', icon: X },
  'Falla/Manto':{ label: 'Falla/Manto', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: AlertTriangle },
};

const getActionConfig = (action) =>
  actionConfig[action] || { label: action, color: '#8e8e93', bg: 'rgba(142,142,147,0.12)', icon: Activity };

const toLocalDateString = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const TransactionsView = () => {
  const { movements, loading, annulMovement } = useInventory();
  const { isAdmin, userData } = useAuth();
  const { categoryToRoute } = useCategories();
  const navigate = useNavigate();
  const { isMobile } = useIsMobile();

  const todayStr = toLocalDateString(new Date());
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [dayMovements, setDayMovements] = useState([]);
  const [loadingDay, setLoadingDay] = useState(false);

  const loadDayMovements = useCallback(async (dateStr) => {
    setLoadingDay(true);
    try {
      const data = await fetchMovementsByDate(dateStr);
      setDayMovements(data);
    } catch (err) {
      console.error('[Transactions] fetchMovementsByDate error:', err);
      setDayMovements([]);
    } finally {
      setLoadingDay(false);
    }
  }, []);

  useEffect(() => {
    loadDayMovements(selectedDate);
  }, [selectedDate, loadDayMovements]);

  // Refresh today when realtime pushes new movements
  useEffect(() => {
    if (selectedDate === todayStr) loadDayMovements(todayStr);
  }, [movements.length, todayStr]);

  const filteredMovements = dayMovements;

  const handleArticleClick = (movement) => {
    const route = categoryToRoute(movement.category);
    if (route && route !== '/') navigate(route, { state: { prefillSearch: movement.item } });
  };

  const isToday = selectedDate === todayStr;

  // Stats
  const totalToday = filteredMovements.length;
  const entries = filteredMovements.filter(m => m.action === 'Entrada' || m.action === 'Alta').length;
  const exits = filteredMovements.filter(m => m.action === 'Salida' || m.action === 'Eliminación').length;

  return (
    <div className="fly-inventory-view">
      {!isMobile && <Header />}
      <FlyPattern fixed opacity={0.04} />

      {/* ═══ HERO SECTION ═══ */}
      <section className="fly-inventory-hero">
        <div className="fly-hero-bg-accent" />
        <div className="fly-inventory-hero-content">
          <div className="fly-hero-top">
            <span className="fly-hero-badge">● TRANSACCIONES</span>
            <span className="fly-hero-badge fly-badge-secondary">{totalToday} REGISTROS</span>
          </div>
          <h1 className="fly-hero-title">
            <span className="fly-hero-kicker">HISTORIAL</span>
            <span className="fly-hero-name">TRANSACCIONES</span>
          </h1>
          <p className="fly-hero-sub">
            {isToday
              ? <>MOVIMIENTOS DE HOY — <span className="fly-accent-arcade">TIEMPO REAL</span></>
              : <>MOVIMIENTOS DEL {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}</>
            }
          </p>
        </div>
      </section>

      {/* ═══ METRICS ROW ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
        {[
          { label: 'TOTAL', value: totalToday, foot: 'MOVIMIENTOS', Icon: Activity, accent: 'var(--fly-yellow)' },
          { label: 'ENTRADAS', value: entries, foot: 'ALTAS / INGRESOS', Icon: ArrowUpCircle, accent: '#8dc63f' },
          { label: 'SALIDAS', value: exits, foot: 'BAJAS / EGRESOS', Icon: ArrowDownCircle, accent: '#f97316' },
        ].map(({ label, value, foot, Icon, accent }) => (
          <div key={label} style={{ background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: `${accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={22} color={accent} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.15em', color: accent, textTransform: 'uppercase' }}>{label}</span>
              <span style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--fly-white)', lineHeight: 1, letterSpacing: '-0.03em' }}>{value}</span>
              <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{foot}</span>
            </div>
            <div style={{ position: 'absolute', right: -10, bottom: -10, width: 70, height: 70, borderRadius: '50%', background: `${accent}11` }} />
          </div>
        ))}
      </div>

      {/* ═══ ACTIONS ═══ */}
      <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="fly-btn fly-btn-secondary" style={{ position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
          <Calendar size={15} />
          <span>{isToday ? 'Hoy' : selectedDate}</span>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            max={todayStr}
            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
          />
        </div>
        {!isToday && (
          <button className="fly-btn fly-btn-secondary" style={{ flexShrink: 0 }} onClick={() => setSelectedDate(todayStr)}>
            <RefreshCw size={15} /> Hoy
          </button>
        )}
        <button className="fly-btn fly-btn-secondary" style={{ flexShrink: 0 }} onClick={() => exportToExcel(filteredMovements, `transacciones_${selectedDate}`, 'Transacciones')}>
          <Download size={15} /> Exportar
        </button>
      </div>

      {/* ═══ TABLE ═══ */}
      <div className="invt-container animate-slide-up">
        <div className="invt-grid-row invt-header-row">
          <div className="invt-cell-art">ACCIÓN / ARTÍCULO</div>
          <div className="invt-cell-details">DETALLE / RESPONSABLE</div>
          <div className="invt-cell-time">FECHA Y HORA</div>
          <div className="invt-cell-act">ACCIONES</div>
        </div>

        <div className="invt-body scrollbar-hide">
          {loadingDay ? (
            <div className="fly-empty-state">
              <Loader2 className="animate-spin" size={40} />
              <p>SINCRONIZANDO MOVIMIENTOS...</p>
            </div>
          ) : filteredMovements.length > 0 ? (
            filteredMovements.map((mov, index) => {
              const cfg = getActionConfig(mov.action);
              const Icon = cfg.icon;
              const movDate = mov.timestamp ? new Date(mov.timestamp) : null;

              return (
                <div key={mov.id || index} className="invt-grid-row invt-data-row">
                  <div className="invt-cell-art">
                    <div className="invt-avatar" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                      <Icon size={20} />
                    </div>
                    <div className="invt-item-info">
                      <span className="invt-action-label" style={{ color: cfg.color }}>{cfg.label}</span>
                      <span className="invt-item-name" onClick={() => handleArticleClick(mov)} style={{ cursor: 'pointer' }}>
                        {mov.item}
                      </span>
                      <span className="invt-item-cat">{mov.category || 'General'}</span>
                    </div>
                  </div>

                  <div className="invt-cell-details">
                    {(() => { const { text, facturaUrl, supervisorName, isApproval } = parseMovDetails(mov.details); return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
                        <span className="invt-detail-text" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>{text || 'Sin detalles adicionales'}</span>
                        {supervisorName && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.65rem', fontWeight: 700, color: '#a78bfa', background: 'rgba(167,139,250,0.12)', padding: '2px 8px', borderRadius: 6, flexShrink: 0, letterSpacing: '0.03em' }}>
                            👤 {supervisorName}
                          </span>
                        )}
                        {isApproval && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.6rem', fontWeight: 800, color: '#34d399', background: 'rgba(52,211,153,0.12)', padding: '2px 8px', borderRadius: 6, flexShrink: 0, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                            ✓ Aprobado
                          </span>
                        )}
                        {facturaUrl && !facturaUrl.toLowerCase().endsWith('.pdf') && (
                          <a href={facturaUrl} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0 }}>
                            <img src={facturaUrl} alt="factura" style={{ width: 40, height: 30, objectFit: 'cover', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', display: 'block' }} onError={e => { e.target.style.display = 'none'; e.target.parentElement.style.display = 'none'; }} />
                          </a>
                        )}
                        {facturaUrl && facturaUrl.toLowerCase().endsWith('.pdf') && (
                          <a href={facturaUrl} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: '#a78bfa', textDecoration: 'none' }}>📄 PDF</a>
                        )}
                      </div>
                    ); })()}
                    <div className="invt-detail-meta">
                      <div className="invt-user-tag">
                        <Users size={12} />
                        <span>{mov.user || 'Admin'}</span>
                      </div>
                      {mov.qty > 0 && <span className="invt-qty-badge">{mov.qty} uds</span>}
                    </div>
                  </div>

                  <div className="invt-cell-time">
                    <span className="invt-time-date">{movDate?.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    <span className="invt-time-hour">{movDate?.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                  </div>

                  <div className="invt-cell-act">
                    {isAdmin && !mov.annulled && mov.action !== 'Anulación' && (
                      <button
                        className="invt-btn-annul"
                        title="Anular Movimiento"
                        onClick={() => {
                          if (window.confirm(`¿Anular movimiento de "${mov.item}"? Se revertirá el stock.`)) {
                            annulMovement(mov.id, userData?.name || 'Admin');
                          }
                        }}
                      >
                        <X size={18} />
                      </button>
                    )}
                    {mov.annulled && <span className="invt-badge-annulled">ANULADO</span>}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="fly-empty-state">
              <Activity size={56} strokeWidth={1.2} />
              <p>NO HAY REGISTROS PARA ESTA FECHA</p>
              <span style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '-0.5rem' }}>Selecciona otra fecha o realiza un movimiento</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransactionsView;
