import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useInventory } from '../context/InventoryContext';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import ActionModal from '../components/ActionModal';
import AddItemModal from '../components/AddItemModal';
import ItemDetailModal from '../components/ItemDetailModal';
import Header from '../components/Header';
import FlyPattern from '../components/FlyPattern';
import { 
  Plus, Download, Search, Filter, Loader2, Trash2, Edit3, 
  ClipboardCheck, Activity, Package, AlertTriangle, 
  Landmark, FileImage, X, AlertCircle, Sparkles, PlusCircle, Hexagon
} from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';
import { exportToExcel } from '../utils/exportUtils';
import { useCategories } from '../context/CategoriesContext';
import useIsMobile from '../hooks/useIsMobile';
import MobileInventoryCard from '../components/MobileInventoryCard';
import './InventoryView.css';

/* ── COMPONENTE TARJETA DE ARTÍCULO (NEON ROW) ── */
const NeonItemCard = React.memo(({ item, categoryTitle, isAdmin, isStaff, canEditIn, handlers, zoneColor }) => {
  if (!item) return null;

  const { handleDelete, handleEdit, handleAction, handleAudit, handleViewFactura, handleViewDetail } = handlers;
  const isCritical = (item.qty || 0) <= (item.threshold || 0);
  const isLow = !isCritical && (item.qty || 0) <= (item.threshold || 0) * 2;
  const stockState = isCritical ? 'critical' : isLow ? 'low' : 'optimal';
  const barPct = Math.min(((item.qty || 0) / Math.max((item.threshold || 1) * 3, 1)) * 100, 100);

  return (
    <div className={`fly-neon-card state-${stockState} theme-${zoneColor}`}>
      <div className="neon-card-glow" />
      <div className="neon-card-content">
        
        {/* Sección 1: Identidad (Foto/Nombre) */}
        <div className="neon-identity" onClick={() => handleViewDetail(item)}>
          <div className="neon-avatar-wrap">
            {item.foto_url ? (
              <img src={item.foto_url} alt={item.name} className="neon-avatar-img" />
            ) : (
              <div className="neon-avatar-fallback">
                {item.name ? item.name.charAt(0).toUpperCase() : '?'}
              </div>
            )}
            {isCritical && <div className="neon-critical-pulse" />}
          </div>
          <div className="neon-info">
            <h3 className="neon-name">{item.name || 'Sin nombre'}</h3>
            <p className="neon-desc">{item.descripcion || 'Sin descripción'}</p>
            <div className="neon-tags">
              {(item.subcategory || item.subcategoria) && <span className="n-tag n-sub">{item.subcategory || item.subcategoria}</span>}
              {item.marca && <span className="n-tag n-brand">{item.marca}</span>}
              <span className="n-tag n-loc"><Landmark size={10}/> {item.location || 'Gral'}</span>
            </div>
          </div>
        </div>

        {/* Sección 2: Stock Display Radial/Linear */}
        <div className="neon-stock-display">
          <div className="n-stock-values">
            <div className="n-stock-main">
              <span className={`n-qty text-${stockState}`}>{item.qty ?? 0}</span>
              <span className="n-unit">{item.unit || 'pz'}</span>
            </div>
            <div className="n-stock-min">MÍN: {item.threshold || 0}</div>
          </div>
          <div className="n-stock-visual">
            <div className="n-bar-track">
              <div className={`n-bar-fill fill-${stockState}`} style={{ width: `${barPct}%` }} />
            </div>
          </div>
        </div>

        {/* Sección 3: Acciones Neón */}
        <div className="neon-actions">
          {item.factura_url && (
            <button className="n-btn n-btn-purple" onClick={() => handleViewFactura(item)} title="Ver Factura">
              <FileImage size={16} />
            </button>
          )}
          {(isStaff || canEditIn(categoryTitle)) && (
            <>
              <button className="n-btn n-btn-blue" onClick={() => handleAction(item)} title="Registrar Movimiento">
                <Activity size={16} />
              </button>
              <button className="n-btn n-btn-orange" onClick={() => handleAudit(item)} title="Auditoría Física">
                <ClipboardCheck size={16} />
              </button>
            </>
          )}
          {(isAdmin || canEditIn(categoryTitle)) && (
            <button className="n-btn n-btn-gray" onClick={() => handleEdit(item)} title="Editar Ficha">
              <Edit3 size={16} />
            </button>
          )}
          {isAdmin && (
            <button className="n-btn n-btn-red" onClick={() => handleDelete(item)} title="Eliminar Activo">
              <Trash2 size={16} />
            </button>
          )}
        </div>

      </div>
    </div>
  );
});

/* ── VISTA PRINCIPAL ── */
const InventoryView = ({ categoryTitle }) => {
  const { items, itemsMap, debugErrors, updateStock, addItem, deleteItem, editItem, auditStock, loading, loadCategoryItems } = useInventory();
  const { isAdmin, isStaff, userData, canAddTo, canEditIn } = useAuth();
  const { getCategoryByTitle } = useCategories();
  const { isMobile } = useIsMobile();
  const navigate = useNavigate();
  
  // Modals & State
  const [selectedItem, setSelectedItem] = useState(null);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [facturaModalItem, setFacturaModalItem] = useState(null);
  const [detailModalItem, setDetailModalItem] = useState(null);
  const [activeInvoiceIndex, setActiveInvoiceIndex] = useState(0);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeSubcategory, setActiveSubcategory] = useState('TODAS');
  
  const [filteredItems, setFilteredItems] = useState([]);
  const workerRef = useRef(null);

  // Disparar carga de datos de la categoría si no están cargados
  useEffect(() => {
    toast(`InventoryView mounted/updated for: ${categoryTitle}`);
    if (categoryTitle && loadCategoryItems) {
      loadCategoryItems(categoryTitle);
    }
  }, [categoryTitle, loadCategoryItems]);

  // Worker Initialization
  useEffect(() => {
    workerRef.current = new Worker(new URL('../workers/filterWorker.js', import.meta.url));
    workerRef.current.onmessage = (e) => {
      setFilteredItems(e.data);
    };
    return () => workerRef.current.terminate();
  }, []);

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Trigger Filter
  useEffect(() => {
    if (!workerRef.current) return;
    workerRef.current.postMessage({
      items, searchTerm: debouncedSearch, categoryTitle, activeSubcategory,
      selectedBrand: 'Todas', selectedLocation: 'Todas'
    });
  }, [items, debouncedSearch, categoryTitle, activeSubcategory]);

  const subcategories = useMemo(() => {
    const subs = Array.from(new Set(items.filter(i => i.category === categoryTitle && (i.subcategory || i.subcategoria)).map(i => i.subcategory || i.subcategoria))).sort();
    return ['TODAS', ...subs];
  }, [items, categoryTitle]);

  const handlers = useMemo(() => ({
    handleDelete: (item) => { if (window.confirm(`¿Eliminar "${item.name}" permanentemente?`)) deleteItem(item.id, userData?.name || 'Admin'); },
    handleEdit: (item) => { setSelectedItem(item); setIsAddModalOpen(true); },
    handleAction: (item) => { setSelectedItem(item); setIsStockModalOpen(true); },
    handleAudit: (item) => {
      const physicalQty = prompt(`Conteo físico para "${item.name}":`, item.qty || 0);
      if (physicalQty !== null && !isNaN(physicalQty)) {
        auditStock(item.id, parseInt(physicalQty), userData?.name || 'Admin', 'Auditoría manual desde inventario');
      }
    },
    handleViewFactura: (item) => { setActiveInvoiceIndex(0); setFacturaModalItem(item); },
    handleViewDetail: (item) => { setDetailModalItem(item); },
  }), [deleteItem, auditStock, userData]);

  const stats = useMemo(() => {
    const catItems = items.filter(i => i.category === categoryTitle);
    const critical = catItems.filter(i => (i.qty || 0) <= (i.threshold || 0));
    return { total: catItems.length, filtered: filteredItems.length, critical: critical.length };
  }, [items, filteredItems, categoryTitle]);

  if (loading) return (
    <div className="fly-inventory-loading">
      <Loader2 className="animate-spin" size={60} />
      <p>CARGANDO CORE DE DATOS...</p>
    </div>
  );

  const categoryConfig = getCategoryByTitle(categoryTitle) || {};
  const zoneColor = categoryConfig?.zone || 'arcade';

  const renderFacturaModal = () => {
    if (!facturaModalItem) return null;
    const activeInvoice = facturaModalItem.invoices?.[activeInvoiceIndex] || { url: facturaModalItem.factura_url, label: 'Factura' };
    const isPdf = activeInvoice.url?.toLowerCase().split('?')[0].endsWith('.pdf') || activeInvoice.url?.includes('application/pdf');

    return (
      <div className="modal-overlay" onClick={() => setFacturaModalItem(null)}>
         <div className="modal-card animate-scale-up glass-modal-override" onClick={e => e.stopPropagation()}>
           <header className="glass-modal-header">
              <div className="glass-modal-title">
                <FileImage size={24} className="gm-icon" />
                <div>
                  <h3>Visor de Documentos</h3>
                  <p>{facturaModalItem.name}</p>
                </div>
              </div>
              <div className="glass-modal-actions">
                 <button className="gm-close" onClick={() => setFacturaModalItem(null)}><X size={20}/></button>
              </div>
           </header>
           <div className="glass-modal-body">
              {isPdf ? (
                <iframe src={activeInvoice.url} title="Factura" className="gm-iframe" />
              ) : (
                <img src={activeInvoice.url} alt="Factura" className="gm-img" />
              )}
           </div>
         </div>
      </div>
    );
  };

  if (isMobile) {
    return (
      <div className={`fly-inventory-mobile theme-${zoneColor}`}>
        {/* HEADER FLOTANTE ULTRA PREMIUM */}
        <div className="fm-sticky-header">
          <div className="fm-header-top">
            <h1 className="fm-title">{categoryTitle}</h1>
            <span className="fm-total-badge">{stats.total} Activos</span>
          </div>

          <div className="fm-search-wrap">
            <Search size={18} className="fm-search-icon" />
            <input 
              type="text" 
              placeholder="Buscar activo..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="fm-metrics-scroll">
            <div className="fm-metric-pill">
              <Filter size={14}/> {stats.filtered} Filtrados
            </div>
            <div className={`fm-metric-pill ${stats.critical > 0 ? 'critical' : ''}`}>
              <AlertTriangle size={14}/> {stats.critical} Críticos
            </div>
          </div>
        </div>

        {/* LISTA DE ITEMS */}
        <div className="fm-list-container">
          {subcategories.length > 1 && (
            <div className="fm-subcat-scroll">
              {subcategories.map(sub => (
                <button key={sub} onClick={() => setActiveSubcategory(sub)} className={`fm-subcat-pill ${activeSubcategory === sub ? 'active' : ''}`}>
                  {sub === 'TODAS' ? 'Todos' : sub}
                </button>
              ))}
            </div>
          )}
          
          {filteredItems.length > 0 ? (
            <div className="fm-cards" style={{ height: 'calc(100vh - 200px)' }}>
              <Virtuoso
                data={filteredItems}
                itemContent={(index, item) => (
                  <div style={{ paddingBottom: '0.75rem' }}>
                    <MobileInventoryCard
                      item={item}
                      categoryTitle={categoryTitle}
                      isAdmin={isAdmin}
                      isStaff={isStaff}
                      canEditIn={canEditIn}
                      handlers={handlers}
                      zoneColor={zoneColor}
                    />
                  </div>
                )}
              />
            </div>
          ) : (
            <div className="fm-empty">
              <Package size={48} className="fm-empty-icon"/>
              <p>No se encontraron activos</p>
            </div>
          )}
          
          {/* Paginación removida ya que Virtuoso maneja la virtualización dinámicamente sin necesidad de infinite scroll DOM */}
        </div>

        {/* FLOATING ACTION BAR (FAB) */}
        <div className="fm-fab-container">
          <button className="fm-fab fm-fab-export" onClick={() => exportToExcel(filteredItems, `inv_${categoryTitle}`, categoryTitle)}>
            <Download size={20} />
          </button>
          {canAddTo(categoryTitle) && (
            <>
              <button className="fm-fab fm-fab-add" onClick={() => navigate('/manual-entry', { state: { category: categoryTitle } })}>
                <Plus size={24} />
              </button>
              <button className="fm-fab fm-fab-main" onClick={() => navigate('/invoice-ai')}>
                <Sparkles size={24} />
              </button>
            </>
          )}
        </div>

        {/* MODALES */}
        <ActionModal isOpen={isStockModalOpen} onClose={() => setIsStockModalOpen(false)} item={selectedItem} onConfirm={(id, qty, details) => { updateStock(id, qty, userData?.name || 'Operador', details); setIsStockModalOpen(false); }} />
        <AddItemModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} category={categoryTitle} initialData={selectedItem} onSave={async (data) => { if (selectedItem) await editItem(selectedItem.id, data, userData?.name || 'Operador'); else await addItem({ ...data, category: categoryTitle }, userData?.name || 'Operador'); setIsAddModalOpen(false); }} />
        <ItemDetailModal isOpen={!!detailModalItem} onClose={() => setDetailModalItem(null)} item={detailModalItem} categoryTitle={categoryTitle} />
        {renderFacturaModal()}
      </div>
    );
  }

  // DESKTOP VIEW
  return (
    <div className={`fly-inventory-view theme-${zoneColor}`}>
      <Header />

      <section className="neon-hero">
        <div className="fluid-bg-container">
          <div className="fluid-orb orb-1" />
          <div className="fluid-orb orb-2" />
          <div className="fluid-overlay" />
        </div>
        <div className="neon-hero-content">
          <div className="iv-header-zone">
            <div className="iv-title-block">
              <div className="iv-title-badge">
                <Package size={14} className="iv-title-icon" />
                <span>{categoryTitle}</span>
              </div>
              <h1 className="iv-main-title">{categoryTitle}</h1>
              <p className="iv-subtitle">BASE DE DATOS OPERATIVA Y EN LÍNEA</p>
            </div>
          </div>
        </div>
      </section>

      <section className="neon-metrics-row">
        <div className="glass-metric">
          <div className="glass-icon-wrap"><Package size={24} /></div>
          <div className="glass-data">
            <span className="g-val">{stats.total}</span>
            <span className="g-lbl">TOTAL ACTIVOS</span>
          </div>
        </div>
        <div className="glass-metric">
          <div className="glass-icon-wrap"><Filter size={24} /></div>
          <div className="glass-data">
            <span className="g-val">{stats.filtered}</span>
            <span className="g-lbl">FILTRADOS</span>
          </div>
        </div>
        <div className={`glass-metric ${stats.critical > 0 ? 'g-alert' : ''}`}>
          <div className="glass-icon-wrap"><AlertTriangle size={24} /></div>
          <div className="glass-data">
            <span className="g-val">{stats.critical}</span>
            <span className="g-lbl">STOCK CRÍTICO</span>
          </div>
        </div>
      </section>

      <section className="neon-controls">
        <div className="neon-search-box">
          <Search size={18} className="ns-icon" />
          <input 
            type="text" 
            placeholder="Buscar por nombre, código o marca..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="neon-actions-group">
          <button className="glass-btn" onClick={() => exportToExcel(filteredItems, `inv_${categoryTitle}_filtrado`, categoryTitle)}>
            <Download size={16} /> EXPORTAR
          </button>
          {canAddTo(categoryTitle) && (
            <>
              <button className="glass-btn primary-ai" onClick={() => navigate('/invoice-ai')}>
                <Sparkles size={16} /> FACTURA IA
              </button>
              <button className="glass-btn primary-manual" onClick={() => navigate('/manual-entry', { state: { category: categoryTitle } })}>
                <PlusCircle size={16} /> MANUAL
              </button>
            </>
          )}
        </div>
      </section>
      
        {debugErrors && debugErrors.length > 0 && (
          <div style={{
            background: '#ff000033', border: '1px solid red', color: 'red',
            padding: '12px', marginBottom: '16px', borderRadius: '8px',
            fontSize: '12px', fontFamily: 'monospace',
            opacity: pageTransition ? 0 : 1,
            transform: pageTransition ? 'translateY(10px)' : 'translateY(0)',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
            <strong>DEBUG ERRORS ({debugErrors.length}):</strong>
            <ul>
              {debugErrors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
            <p>itemsMap keys: {Object.keys(itemsMap || {}).length}</p>
          </div>
        )}

      {subcategories.length > 1 && (
        <section className="neon-subcat-row">
          {subcategories.map(sub => (
            <button
              key={sub}
              onClick={() => setActiveSubcategory(sub)}
              className={`neon-pill ${activeSubcategory === sub ? 'active' : ''}`}
            >
              {sub === 'TODAS' ? 'MOSTRAR TODO' : sub}
            </button>
          ))}
        </section>
      )}

      <section className="neon-inventory-list">
        {filteredItems.length > 0 ? (
          <div className="neon-cards-container">
            <Virtuoso
              useWindowScroll
              data={filteredItems}
              itemContent={(index, item) => (
                <div style={{ paddingBottom: '0.75rem' }}>
                  <NeonItemCard
                    item={item}
                    categoryTitle={categoryTitle}
                    isAdmin={isAdmin}
                    isStaff={isStaff}
                    canEditIn={canEditIn}
                    handlers={handlers}
                    zoneColor={zoneColor}
                  />
                </div>
              )}
            />
          </div>
        ) : (
          <div className="neon-empty-state">
            <Package size={64} className="n-empty-icon" />
            <h3>NO SE DETECTARON ACTIVOS</h3>
            <p>Modifica los filtros o realiza una nueva búsqueda.</p>
          </div>
        )}


      </section>

      <ActionModal isOpen={isStockModalOpen} onClose={() => setIsStockModalOpen(false)} item={selectedItem} onConfirm={(id, qty, details) => { updateStock(id, qty, userData?.name || 'Operador', details); setIsStockModalOpen(false); }} />
      <AddItemModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} category={categoryTitle} initialData={selectedItem} onSave={async (data) => { if (selectedItem) await editItem(selectedItem.id, data, userData?.name || 'Operador'); else await addItem({ ...data, category: categoryTitle }, userData?.name || 'Operador'); setIsAddModalOpen(false); }} />
      <ItemDetailModal isOpen={!!detailModalItem} onClose={() => setDetailModalItem(null)} item={detailModalItem} categoryTitle={categoryTitle} />
      {renderFacturaModal()}
    </div>
  );
};

export default InventoryView;
