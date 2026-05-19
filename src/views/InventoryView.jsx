import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import ActionModal from '../components/ActionModal';
import AddItemModal from '../components/AddItemModal';
import Header from '../components/Header';
import FlyPattern from '../components/FlyPattern';
import FlyLogo from '../components/FlyLogo';
import { 
  Plus, Download, Upload, Search, Filter, Loader2, Trash2, Edit3, 
  ClipboardCheck, Activity, Layers, Printer, ChevronDown, Landmark,
  RotateCcw, HandMetal, Package, AlertTriangle, PenTool, Box,
  ArrowUpCircle, ArrowDownCircle, TrendingUp, AlertCircle, XCircle, PlusCircle
} from 'lucide-react';
import { exportToExcel } from '../utils/exportUtils';
// Import de Excel deshabilitado: entradas solo vía Carga IA de Facturas
// import { processInventoryExcel } from '../utils/importUtils';
import { toast } from 'sonner';
import { useCategories } from '../context/CategoriesContext';
import { useNavigate } from 'react-router-dom';
import './InventoryView.css';

/**
 * Componente de Fila Optimizado para react-window v2.
 * Recibe props directamente (no via data).
 */
const InventoryRow = React.memo(({ item, index, categoryTitle, isAdmin, isStaff, canEditIn, handlers }) => {
  if (!item) return null;

  const { handleDelete, handleEdit, handleAction, handleAudit } = handlers;

  const isCritical = (item.qty || 0) <= (item.threshold || 0);
  const isLow = !isCritical && (item.qty || 0) <= (item.threshold || 0) * 2;
  const stockClass = isCritical ? 'critical' : isLow ? 'low' : 'ok';

  return (
    <div className="invt-grid-row invt-data-row">
      {/* Name + Meta */}
      <div className="invt-cell-art">
        <div className="invt-avatar">
          {item.name ? item.name.charAt(0).toUpperCase() : '?'}
        </div>
        <div className="invt-item-info">
          <span className="invt-item-name">{item.name || 'Sin nombre'}</span>
          <div className="invt-item-tags">
            {item.subcategory && <span className="invt-tag invt-tag-blue">{item.subcategory}</span>}
            {item.marca && <span className="invt-tag invt-tag-gray">{item.marca}</span>}
            {item.item_number && <span className="invt-tag invt-tag-mono">#{item.item_number}</span>}
          </div>
        </div>
      </div>

      {/* Stock */}
      <div className="invt-cell-stock">
        <div className="invt-stock-row">
          <span className={`invt-stock-num stock-${stockClass}`}>{item.qty || 0}</span>
          <span className="invt-stock-unit">{item.unit || 'pz'}</span>
        </div>
        <div className="invt-stock-bar-bg">
          <div 
            className={`invt-stock-bar bar-${stockClass}`}
            style={{ width: `${Math.min(((item.qty || 0) / Math.max((item.threshold || 1) * 3, 1)) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Referencia (Location + Min) */}
      <div className="invt-cell-ref">
        <span className="invt-badge-min">Mín: {item.threshold || 0}</span>
        <div className="invt-loc-text">
          <Landmark size={12} className="invt-loc-icon" />
          {item.location || 'General'}
        </div>
      </div>

      {/* Actions */}
      <div className="invt-cell-act">
        {(isStaff || canEditIn(categoryTitle)) && (
          <>
            <button className="invt-btn invt-btn-blue" onClick={() => handleAction(item)} title="Movimiento">
              <Activity size={15} />
            </button>
            <button className="invt-btn invt-btn-orange" onClick={() => handleAudit(item)} title="Auditar">
              <ClipboardCheck size={15} />
            </button>
          </>
        )}
        {(isAdmin || canEditIn(categoryTitle)) && (
          <button className="invt-btn invt-btn-gray" onClick={() => handleEdit(item)} title="Editar">
            <Edit3 size={15} />
          </button>
        )}
        {isAdmin && (
          <button className="invt-btn invt-btn-red" onClick={() => handleDelete(item)} title="Eliminar">
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  );
});

const SECONDARY_BTN_STYLE = {
  opacity: 1,
  visibility: 'visible',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  height: '48px',
  padding: '0 1rem',
  background: 'rgba(60, 60, 65, 0.95)',
  color: '#FFFFFF',
  border: '1.5px solid rgba(255, 255, 255, 0.3)',
  borderRadius: 'var(--radius-button)',
  fontFamily: 'var(--font-heading)',
  fontWeight: 800,
  fontSize: '0.75rem',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
};

const InventoryView = ({ categoryTitle }) => {
  const { items, personnel, updateStock, addItem, deleteItem, editItem, loanItem, returnItem, auditStock, loading } = useInventory();
  const { isAdmin, isStaff, userData, canAddTo, canEditIn } = useAuth();
  const { getCategoryByTitle } = useCategories();
  const location = useLocation();
  const navigate = useNavigate();
  const [visibleCount, setVisibleCount] = useState(40);
  const observerTarget = useRef(null);
  
  // Estados de UI
  const [selectedItem, setSelectedItem] = useState(null);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(location.state?.prefillSearch || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);
  const [activeSubcategory, setActiveSubcategory] = useState('TODAS');
  const [selectedBrand, setSelectedBrand] = useState('Todas');
  const [selectedLocation, setSelectedLocation] = useState('Todas');
  
  // Estado para items filtrados (vía Worker)
  const [filteredItems, setFilteredItems] = useState([]);
  const [isFiltering, setIsFiltering] = useState(false);
  const workerRef = useRef(null);

  // Infinite Scroll Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => Math.min(prev + 40, filteredItems.length));
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [filteredItems.length]);

  // Inicializar Worker (solo una vez)
  useEffect(() => {
    workerRef.current = new Worker(new URL('../workers/filterWorker.js', import.meta.url));
    workerRef.current.onmessage = (e) => {
      setFilteredItems(e.data);
      setVisibleCount(40); // Reset al filtrar
      setIsFiltering(false);
    };
    return () => workerRef.current.terminate();
  }, []);

  // Debounce search term to avoid excessive worker calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Disparar filtrado cuando cambian los criterios (con pequeño debounce para evitar saturación)
  useEffect(() => {
    if (!workerRef.current) return;
    
    const filterTimer = setTimeout(() => {
      setIsFiltering(true);
      workerRef.current.postMessage({
        items,
        searchTerm: debouncedSearch,
        categoryTitle,
        activeSubcategory,
        selectedBrand,
        selectedLocation
      });
    }, 50); // Mínimo delay para agrupar actualizaciones rápidas de Firestore
    
    return () => clearTimeout(filterTimer);
  }, [items, debouncedSearch, categoryTitle, activeSubcategory, selectedBrand, selectedLocation]);

  const subcategories = useMemo(() => [
    'TODAS', 
    ...new Set(items.filter(i => i.category === categoryTitle && i.subcategory).map(i => i.subcategory))
  ].sort(), [items, categoryTitle]);

  // Handlers estables para evitar re-renders en filas virtualizadas
  const handlers = useMemo(() => ({
    handleDelete: (item) => { if (window.confirm(`¿Eliminar "${item.name}"?`)) deleteItem(item.id, userData?.name || 'Admin'); },
    handleEdit: (item) => { setSelectedItem(item); setIsAddModalOpen(true); },
    handleAction: (item) => { setSelectedItem(item); setIsStockModalOpen(true); },
    handleAudit: (item) => {
      const physicalQty = prompt(`Conteo físico para "${item.name}":`, item.qty || 0);
      if (physicalQty !== null && !isNaN(physicalQty)) {
        auditStock(item.id, parseInt(physicalQty), userData?.name || 'Admin', 'Auditoría manual desde inventario');
      }
    },
    handleLoan: (item) => { setSelectedItem(item); },
    handleReturn: async (item) => { if (window.confirm(`¿Devolución de ${item.name}?`)) await returnItem(item.id, userData?.name || 'Admin'); }
  }), [deleteItem, returnItem, auditStock, userData]);

  const rowData = useMemo(() => ({
    items: filteredItems,
    categoryTitle,
    isAdmin,
    isStaff,
    canEditIn,
    handlers
  }), [filteredItems, categoryTitle, isAdmin, isStaff, canEditIn, handlers]);

  // Stats summary
  const stats = useMemo(() => {
    const catItems = items.filter(i => i.category === categoryTitle);
    const critical = catItems.filter(i => (i.qty || 0) <= (i.threshold || 0));
    return { total: catItems.length, filtered: filteredItems.length, critical: critical.length };
  }, [items, filteredItems, categoryTitle]);

  if (loading) return (
    <div className="fly-inventory-loading">
      <FlyPattern fixed opacity={0.05} />
      <Loader2 className="fly-loader" size={48} />
      <p className="fly-loading-label">CARGANDO INVENTARIO</p>
    </div>
  );

  const categoryConfig = getCategoryByTitle(categoryTitle) || {};
  const zoneColor = categoryConfig?.zone || 'arcade';

  return (
    <div className="fly-inventory-view">
      <Header />

      <FlyPattern fixed opacity={0.04} />

      {/* ═══ HERO SECTION ═══ */}
      <section className="fly-inventory-hero">
        <div className="fly-hero-bg-accent" />
        <div className="fly-inventory-hero-content">
          <div className="fly-hero-top">
            <span className="fly-hero-badge">● {categoryTitle.toUpperCase()}</span>
            <span className="fly-hero-badge fly-badge-secondary">{stats.total} ARTÍCULOS</span>
          </div>
          <h1 className="fly-hero-title">
            <span className="fly-hero-kicker">INVENTARIO</span>
            <span className="fly-hero-name">{categoryTitle.toUpperCase()}</span>
          </h1>
          <p className="fly-hero-sub">
            CONTROL DE SUMINISTROS <span className={`fly-accent-${zoneColor}`}>FLY EXTREME</span> — 
            GESTIÓN TOTAL DE ACTIVOS
          </p>
        </div>
      </section>

      {/* ═══ METRICS ROW ═══ */}
      <section className="fly-inventory-metrics">
        <div className={`fly-metric-card fly-metric-${zoneColor}`}>
          <div className="fly-metric-icon-wrap">
            <Package size={24} />
          </div>
          <div className="fly-metric-data">
            <span className="fly-metric-label">TOTAL ARTÍCULOS</span>
            <span className="fly-metric-value">{stats.total}</span>
            <span className="fly-metric-foot">REGISTRADOS</span>
          </div>
          <div className="fly-metric-shape" />
        </div>

        <div className={`fly-metric-card fly-metric-${zoneColor}`}>
          <div className="fly-metric-icon-wrap">
            <Filter size={24} />
          </div>
          <div className="fly-metric-data">
            <span className="fly-metric-label">FILTRADOS</span>
            <span className="fly-metric-value">{stats.filtered}</span>
            <span className="fly-metric-foot">VISUALIZADOS</span>
          </div>
          <div className="fly-metric-shape" />
        </div>

        <div 
          className="fly-metric-card fly-metric-alert"
          style={{ cursor: 'default' }}
        >
          <div className="fly-metric-icon-wrap">
            <AlertTriangle size={24} />
          </div>
          <div className="fly-metric-data">
            <span className="fly-metric-label">STOCK CRÍTICO</span>
            <span className="fly-metric-value">{stats.critical}</span>
            <span className="fly-metric-foot">REQUIERE ATENCIÓN</span>
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
            placeholder="Buscar artículo..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="fly-action-buttons" style={{ opacity: 1, visibility: 'visible' }}>
          <button 
            className="fly-btn fly-btn-secondary" 
            onClick={() => exportToExcel(filteredItems, `inv_${categoryTitle}_filtrado`, categoryTitle)}
            style={SECONDARY_BTN_STYLE}
          >
            <Filter size={16} />
            <span>Exportar Filtrados</span>
          </button>

          <button 
            className="fly-btn fly-btn-secondary" 
            onClick={() => {
              const allItems = items.filter(i => i.category === categoryTitle);
              exportToExcel(allItems, `inv_${categoryTitle}_total`, categoryTitle);
            }}
            style={SECONDARY_BTN_STYLE}
          >
            <Download size={16} />
            <span>Exportar Todo</span>
          </button>

          {canAddTo(categoryTitle) && (
            <>
              <button 
                className={`fly-btn fly-btn-primary fly-btn-${zoneColor}`} 
                onClick={() => navigate('/invoice-ai')}
                style={{ opacity: 1, visibility: 'visible', display: 'flex' }}
              >
                <Sparkles size={16} />
                <span>Entrada vía Factura IA</span>
              </button>
              <button 
                className={`fly-btn fly-btn-primary fly-btn-${zoneColor}`} 
                onClick={() => navigate('/manual-entry')}
                style={{ opacity: 1, visibility: 'visible', display: 'flex' }}
              >
                <PlusCircle size={16} />
                <span>Ingreso Manual</span>
              </button>
            </>
          )}
        </div>
      </section>

      {subcategories.length > 1 && (
        <section className="fly-inventory-subcats">
          <button 
            className="fly-subcat-nav left" 
            onClick={() => {
              const el = document.querySelector('.fly-subcat-pills');
              el.scrollBy({ left: -200, behavior: 'smooth' });
            }}
          >
            <ChevronDown size={20} style={{ transform: 'rotate(90deg)' }} />
          </button>
          
          <div className="fly-subcat-pills">
            {subcategories.map(sub => (
              <button
                key={sub}
                onClick={() => setActiveSubcategory(sub)}
                className={`fly-subcat-pill ${activeSubcategory === sub ? 'active' : ''}`}
              >
                {sub === 'TODAS' ? 'Todas las Categorías' : sub}
              </button>
            ))}
          </div>

          <button 
            className="fly-subcat-nav right" 
            onClick={() => {
              const el = document.querySelector('.fly-subcat-pills');
              el.scrollBy({ left: 200, behavior: 'smooth' });
            }}
          >
            <ChevronDown size={20} style={{ transform: 'rotate(-90deg)' }} />
          </button>
        </section>
      )}

      {isFiltering && (
        <div className="fly-inventory-loading-overlay">
          <Loader2 className="animate-spin" size={32} />
        </div>
      )}

      {/* ═══ ITEMS LIST ═══ */}
      <section className="fly-inventory-list-wrap">
        {filteredItems.length > 0 ? (
          <>
            <div className="fly-list-header">
              <span className="fly-lh-name">ARTÍCULO</span>
              <span className="fly-lh-sub">SUBCATEGORÍA</span>
              <span className="fly-lh-brand">MARCA</span>
              <span className="fly-lh-location">UBICACIÓN</span>
              <span className="fly-lh-stock">STOCK</span>
              <span className="fly-lh-min">MÍN</span>
              <span className="fly-lh-bar">NIVEL</span>
              <span className="fly-lh-actions">ACCIONES</span>
            </div>

            {filteredItems.slice(0, visibleCount).map((item) => {
              const isCritical = (item.qty || 0) <= (item.threshold || 0);
              const isLow = !isCritical && (item.qty || 0) <= (item.threshold || 0) * 2;
              const statusClass = isCritical ? 'critical' : isLow ? 'low' : 'ok';
              const barPct = Math.min(((item.qty || 0) / Math.max((item.threshold || 1) * 3, 1)) * 100, 100);

              return (
                <div key={item.id} className={`fly-list-row fly-list-row-${zoneColor} ${isCritical ? 'fly-row-critical' : ''}`}>
                  <div className="fly-lr-name">
                    <div className={`fly-lr-avatar fly-lravatar-${zoneColor}`}>
                      {item.name ? item.name.charAt(0).toUpperCase() : '?'}
                    </div>
                    <span className="fly-lr-nametext">{item.name || 'Sin nombre'}</span>
                  </div>
                  <span className="fly-lr-sub">{item.subcategory || '—'}</span>
                  <span className="fly-lr-brand">{item.marca || '—'}</span>
                  <div className="fly-lr-location">
                    <Landmark size={11} />
                    <span>{item.location || 'General'}</span>
                  </div>
                  <span className={`fly-lr-stock ${statusClass}`}>{item.qty ?? 0} <em>{item.unit || 'pz'}</em></span>
                  <span className="fly-lr-min">{item.threshold || 0}</span>
                  <div className="fly-lr-bar">
                    <div className="fly-stock-bar-bg">
                      <div className={`fly-stock-bar ${statusClass}`} style={{ width: `${barPct}%` }} />
                    </div>
                  </div>
                  <div className="fly-lr-actions">
                    {(isStaff || canEditIn(categoryTitle)) && (
                      <>
                        <button className="fly-action-btn fly-action-blue" onClick={() => handlers.handleAction(item)} title="Movimiento"><Activity size={14} /></button>
                        <button className="fly-action-btn fly-action-orange" onClick={() => handlers.handleAudit(item)} title="Auditar"><ClipboardCheck size={14} /></button>
                      </>
                    )}
                    {(isAdmin || canEditIn(categoryTitle)) && (
                      <button className="fly-action-btn fly-action-gray" onClick={() => handlers.handleEdit(item)} title="Editar"><Edit3 size={14} /></button>
                    )}
                    {isAdmin && (
                      <button className="fly-action-btn fly-action-red" onClick={() => handlers.handleDelete(item)} title="Eliminar"><Trash2 size={14} /></button>
                    )}
                  </div>
                </div>
              );
            })}

            {visibleCount < filteredItems.length && (
              <div ref={observerTarget} className="fly-inventory-loadmore">
                <Loader2 className="animate-spin" size={32} />
              </div>
            )}
          </>
        ) : (
          <div className="fly-inventory-empty">
            <Package size={64} />
            <p className="fly-empty-title">No se encontraron artículos</p>
            <p className="fly-empty-sub">Intenta con otros filtros de búsqueda</p>
          </div>
        )}
      </section>

      <ActionModal 
        isOpen={isStockModalOpen} onClose={() => setIsStockModalOpen(false)} item={selectedItem}
        personnel={personnel}
        onConfirm={(id, qty, details) => { updateStock(id, qty, userData?.name || 'Jonathan', details); setIsStockModalOpen(false); }}
      />

      <AddItemModal 
        isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} category={categoryTitle} initialData={selectedItem}
        onSave={async (data) => { if (selectedItem) await editItem(selectedItem.id, data, userData?.name || 'Jonathan'); else await addItem({ ...data, category: categoryTitle }, userData?.name || 'Jonathan'); setIsAddModalOpen(false); }}
      />
    </div>
  );
};

export default InventoryView;
