import React, { useState, useMemo } from 'react';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import { useCategories } from '../context/CategoriesContext';
import { ArrowUpCircle, ArrowDownCircle, RefreshCw, ClipboardCheck, HandMetal, Calendar, Search, Loader2, X, Users, Activity, Download, AlertTriangle } from 'lucide-react';
import Header from '../components/Header';
import FlyPattern from '../components/FlyPattern';
import { useNavigate } from 'react-router-dom';
import { exportToExcel } from '../utils/exportUtils';
import './TransactionsView.css';

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

  const todayStr = toLocalDateString(new Date());
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      if (!m.timestamp) return false;
      const movDate = toLocalDateString(new Date(m.timestamp));
      if (movDate !== selectedDate) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const match = [m.item, m.action, m.details, m.user, m.category]
          .some(v => (v || '').toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [movements, selectedDate, searchTerm]);

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
      <Header />
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
      <section className="fly-inventory-metrics">
        <div className="fly-metric-card fly-metric-arcade">
          <div className="fly-metric-icon-wrap"><Activity size={24} /></div>
          <div className="fly-metric-data">
            <span className="fly-metric-label">TOTAL</span>
            <span className="fly-metric-value">{totalToday}</span>
            <span className="fly-metric-foot">MOVIMIENTOS</span>
          </div>
          <div className="fly-metric-shape" />
        </div>
        <div className="fly-metric-card fly-metric-arcade">
          <div className="fly-metric-icon-wrap"><ArrowUpCircle size={24} /></div>
          <div className="fly-metric-data">
            <span className="fly-metric-label">ENTRADAS</span>
            <span className="fly-metric-value">{entries}</span>
            <span className="fly-metric-foot">ALTAS / INGRESOS</span>
          </div>
          <div className="fly-metric-shape" />
        </div>
        <div className="fly-metric-card fly-metric-alert">
          <div className="fly-metric-icon-wrap"><ArrowDownCircle size={24} /></div>
          <div className="fly-metric-data">
            <span className="fly-metric-label">SALIDAS</span>
            <span className="fly-metric-value">{exits}</span>
            <span className="fly-metric-foot">BAJAS / EGRESOS</span>
          </div>
          <div className="fly-metric-shape" />
        </div>
      </section>

      {/* ═══ SEARCH & ACTIONS ═══ */}
      <section className="fly-inventory-actions" style={{ opacity: 1, visibility: 'visible' }}>
        <div className="fly-search-wrapper">
          <Search size={18} className="fly-search-icon" />
          <input
            type="text"
            className="fly-search-input"
            placeholder="Buscar movimiento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="fly-action-buttons" style={{ opacity: 1, visibility: 'visible' }}>
          <div className="fly-btn fly-btn-secondary" style={{ position: 'relative', overflow: 'hidden' }}>
            <Calendar size={16} />
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
            <button className="fly-btn fly-btn-secondary" onClick={() => setSelectedDate(todayStr)}>
              <RefreshCw size={16} /> Hoy
            </button>
          )}
          <button className="fly-btn fly-btn-secondary" onClick={() => exportToExcel(filteredMovements, `transacciones_${selectedDate}`, 'Transacciones')}>
            <Download size={16} /> Exportar
          </button>
        </div>
      </section>

      {/* ═══ TABLE ═══ */}
      <div className="invt-container animate-slide-up">
        <div className="invt-grid-row invt-header-row">
          <div className="invt-cell-art">ACCIÓN / ARTÍCULO</div>
          <div className="invt-cell-details">DETALLE / RESPONSABLE</div>
          <div className="invt-cell-time">FECHA Y HORA</div>
          <div className="invt-cell-act">ACCIONES</div>
        </div>

        <div className="invt-body scrollbar-hide">
          {loading ? (
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
                    <span className="invt-detail-text">{mov.details || 'Sin detalles adicionales'}</span>
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
