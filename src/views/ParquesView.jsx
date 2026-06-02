import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import Header from '../components/Header';
import ActionModal from '../components/ActionModal';
import AddItemModal from '../components/AddItemModal';
import { 
  Plus, Download, Upload, Search, Loader2, Trash2, Edit3, 
  ClipboardCheck, X, FileSpreadsheet, Filter, ChevronDown, 
  Activity, Package, AlertTriangle
} from 'lucide-react';
import { exportToExcel } from '../utils/exportUtils';
import { processParquesExcel } from '../utils/importUtils';
import { toast } from 'sonner';
// Eliminada virtualización compleja para máxima compatibilidad
import './ToolsView.css'; 
import './ParquesView.css';

const TableRow = memo(({ 
  item, index, isAdmin, isStaff, canEdit, 
  onEdit, onDelete, onAction, onAudit 
}) => {
  if (!item) return null;

  const isCritical = (item.qty || 0) <= (item.threshold || 0);
  const isLow = !isCritical && (item.qty || 0) <= (item.threshold || 0) * 2;
  const stockClass = isCritical ? 'critical' : isLow ? 'low' : 'ok';

  return (
    <div className="parques-grid-row parques-data-row">
      {/* Artículo / Sede */}
      <div className="parques-cell-art">
        <div className="parques-avatar">
          {item.name ? item.name.charAt(0).toUpperCase() : '?'}
        </div>
        <div className="parques-item-info">
          <span className="parques-item-name">{item.name || 'Sin nombre'}</span>
          <div className="parques-item-tags">
            <span className="parques-tag parques-tag-blue">{item.subcategory || 'General'}</span>
            <span className="parques-tag parques-tag-gray">{item.marca || 'N/A'}</span>
          </div>
        </div>
      </div>

      {/* Stock Actual */}
      <div className="parques-cell-stock">
        <div className="parques-stock-row">
          <span className={`parques-stock-num stock-${stockClass}`}>
            {item.qty || 0}
          </span>
          <span className="parques-stock-unit">{item.unit || 'pz'}</span>
        </div>
        <div className="parques-stock-bar-bg">
          <div 
            className={`parques-stock-bar bar-${stockClass}`}
            style={{ width: `${Math.min(((item.qty || 0) / Math.max((item.threshold || 1) * 3, 1)) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Referencia (Mínimo) */}
      <div className="parques-cell-ref">
        <span className="parques-badge-min">Mín: {item.threshold || 0}</span>
      </div>

      {/* Acciones */}
      <div className="parques-cell-act">
        {isStaff && (
          <>
            <button className="parques-btn parques-btn-blue" onClick={() => onAction(item)} title="Movimiento">
              <Activity size={15} />
            </button>
            <button className="parques-btn parques-btn-orange" onClick={() => onAudit(item)} title="Auditar">
              <ClipboardCheck size={15} />
            </button>
          </>
        )}
        {(isAdmin || canEdit) && (
          <button className="parques-btn parques-btn-gray" onClick={() => onEdit(item)} title="Editar">
            <Edit3 size={15} />
          </button>
        )}
        {isAdmin && (
          <button className="parques-btn parques-btn-red" onClick={() => onDelete(item.id, item.name)} title="Eliminar">
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  );
});

const ParquesView = () => {
  const { items, updateStock, addItem, deleteItem, editItem, bulkAddItems, auditStock, loading } = useInventory();
  const { isAdmin, isStaff, userData, canAddTo, canEditIn } = useAuth();
  const location = useLocation();
  
  const [searchTerm, setSearchTerm] = useState(location.state?.prefillSearch || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);
  const [activeSubcategory, setActiveSubcategory] = useState('TODAS');
  
  const [selectedItem, setSelectedItem] = useState(null);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [physicalCount, setPhysicalCount] = useState('');
  const [auditReason, setAuditReason] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);

  const workerRef = useRef(null);
  const [filteredItems, setFilteredItems] = useState([]);

  const [visibleCount, setVisibleCount] = useState(40);
  const observerTarget = useRef(null);

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

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 150);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    workerRef.current = new Worker(new URL('../workers/filterWorker.js', import.meta.url));
    workerRef.current.onmessage = (e) => {
      setFilteredItems(e.data);
      setVisibleCount(40); // Reset al filtrar
    };
    return () => workerRef.current.terminate();
  }, []);

  useEffect(() => {
    if (!workerRef.current || loading) return;
    workerRef.current.postMessage({
      items,
      searchTerm: debouncedSearch,
      categoryTitle: 'Parques',
      activeSubcategory,
      selectedBrand: 'Todas',
      selectedLocation: 'Todas'
    });
  }, [items, debouncedSearch, activeSubcategory, loading]);

  const subcategories = useMemo(() => {
    const parks = items.filter(i => i.category === 'Parques');
    return ['TODAS', ...new Set(parks.map(i => i.subcategory || 'Sin Sede'))];
  }, [items]);

  const handleExport = () => {
    exportToExcel(filteredItems, `parques_${activeSubcategory}`, `Parques - ${activeSubcategory}`);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const result = await processParquesExcel(file);
      await bulkAddItems(result.items);
      setImportSummary(result.summary);
      toast.success('Importación completada');
    } catch (error) {
      toast.error('Error: ' + error.message);
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  const userName = userData?.name || userData?.displayName || 'Admin';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full w-full flex-col gap-4">
        <Loader2 className="animate-spin text-blue-500" size={48} />
        <p className="text-gray-500 font-bold">Cargando inventario de Parques...</p>
      </div>
    );
  }

  return (
    <main className="tools-view animate-fade-in relative min-h-screen p-8 flex flex-col">
      <Header />
      
      <header className="tools-header mb-8">
        <div className="tools-title-group">
          <h2>Parques</h2>
          <p>Control de suministros por sede ({filteredItems.length})</p>
        </div>
        
        <div className="tools-actions">
          <div className="search-box-wrapper">
            <Search size={18} />
            <input 
              type="text" 
              placeholder="Buscar artículo..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
          
          <button className="btn-scan-qr" onClick={handleExport}>
            <Download size={18} /> Exportar
          </button>

          {isAdmin && (
            <label className="btn-scan-qr cursor-pointer">
              {isImporting ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />} Importar
              <input type="file" className="hidden" onChange={handleImport} />
            </label>
          )}
          
          {canAddTo('Parques') && (
            <button className="btn-primary-tools" onClick={() => { setSelectedItem(null); setIsAddModalOpen(true); }}>
              <Plus size={18} /> Nuevo
            </button>
          )}
        </div>
      </header>

      {subcategories.length > 1 && (
        <div className="subcat-nav-wrapper">
          <button 
            className="subcat-nav-btn left" 
            onClick={() => {
              const el = document.querySelector('.subcat-pills');
              el.scrollBy({ left: -200, behavior: 'smooth' });
            }}
          >
            <ChevronDown size={20} style={{ transform: 'rotate(90deg)' }} />
          </button>
          
          <div className="subcat-pills scrollbar-hide">
            {subcategories.map(sub => (
              <button
                key={sub}
                onClick={() => setActiveSubcategory(sub)}
                className={`pill ${activeSubcategory === sub ? 'active' : ''}`}
              >
                {sub === 'TODAS' ? 'Todas las Sedes' : sub}
              </button>
            ))}
          </div>

          <button 
            className="subcat-nav-btn right" 
            onClick={() => {
              const el = document.querySelector('.subcat-pills');
              el.scrollBy({ left: 200, behavior: 'smooth' });
            }}
          >
            <ChevronDown size={20} style={{ transform: 'rotate(-90deg)' }} />
          </button>
        </div>
      )}

      <div className="parques-container">
        <div className="parques-grid-row parques-header-row">
          <div>Artículo / Sede</div>
          <div style={{ textAlign: 'center' }}>Stock Actual</div>
          <div style={{ textAlign: 'center' }}>Referencia</div>
          <div style={{ textAlign: 'right' }}>Acciones</div>
        </div>
        
        <div className="parques-body">
          {filteredItems.length > 0 ? (
            <>
              {filteredItems.slice(0, visibleCount).map((item, index) => (
                <TableRow 
                  key={item.id}
                  item={item}
                  index={index}
                  isAdmin={isAdmin}
                  isStaff={isStaff}
                  canEdit={canEditIn('Parques')}
                  onEdit={(item) => { setSelectedItem(item); setIsAddModalOpen(true); }}
                  onDelete={(id, name) => { if (window.confirm(`¿Eliminar ${name}?`)) deleteItem(id, userName); }}
                  onAction={(item) => { setSelectedItem(item); setIsStockModalOpen(true); }}
                  onAudit={(item) => { setSelectedItem(item); setIsAuditModalOpen(true); }}
                />
              ))}
              
              {visibleCount < filteredItems.length && (
                <div ref={observerTarget} className="flex justify-center py-10">
                  <Loader2 className="animate-spin text-blue-500" size={32} />
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4 py-20">
              <Package size={64} className="opacity-10" />
              <p className="font-bold text-xl opacity-30">No se encontraron artículos</p>
            </div>
          )}
        </div>
      </div>

      <ActionModal 
        isOpen={isStockModalOpen} 
        onClose={() => setIsStockModalOpen(false)} 
        item={selectedItem} 
        onConfirm={(id, qty, details) => {
          updateStock(id, qty, userName, details);
          setIsStockModalOpen(false);
          toast.success('Movimiento registrado');
        }}
      />

      <AddItemModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        category="Parques"
        initialData={selectedItem}
        onSave={(data) => {
          if (selectedItem) editItem(selectedItem.id, data, userName);
          else addItem(data, userName);
          setIsAddModalOpen(false);
          toast.success(selectedItem ? 'Artículo actualizado' : 'Artículo creado');
        }}
      />

      {isAuditModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card animate-scale-up max-w-sm">
            <header className="modal-header">
              <h3>
                <ClipboardCheck className="text-orange-500" size={28} />
                Auditoría Física
              </h3>
              <p>Sincroniza el stock real de <strong>{selectedItem.name}</strong></p>
            </header>
            
            <div className="f-group">
              <label>Cantidad Física en Estante</label>
              <input type="number" className="f-input" value={physicalCount} onChange={(e) => setPhysicalCount(e.target.value)} autoFocus />
            </div>
            <div className="f-group">
              <label>Motivo del Ajuste</label>
              <textarea className="f-input h-24" value={auditReason} onChange={(e) => setAuditReason(e.target.value)} placeholder="Ej: Error en conteo anterior..." />
            </div>
            
            <div className="flex gap-4">
              <button className="btn-apple-secondary flex-1" onClick={() => setIsAuditModalOpen(false)}>Cancelar</button>
              <button className="btn-apple-primary flex-1" onClick={() => {
                auditStock(selectedItem.id, parseInt(physicalCount), userName, auditReason);
                setIsAuditModalOpen(false);
                setPhysicalCount('');
                setAuditReason('');
                toast.success('Auditoría completada');
              }} disabled={!physicalCount || !auditReason.trim()}>Guardar Ajuste</button>
            </div>
          </div>
        </div>
      )}

      {importSummary && (
        <div className="modal-overlay">
          <div className="modal-card animate-scale-up max-w-lg">
            <header className="modal-header">
              <div className="flex justify-between items-center w-full">
                <h3>Resumen de Importación</h3>
                <button onClick={() => setImportSummary(null)}><X size={24} /></button>
              </div>
            </header>
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
              {importSummary.map((sheet, i) => (
                <div key={i} className="flex justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                  <span className="font-bold">{sheet.sheet}</span>
                  <span className="text-blue-500 font-black">{sheet.count} items</span>
                </div>
              ))}
            </div>
            <button className="btn-apple-primary w-full mt-8" onClick={() => setImportSummary(null)}>Entendido</button>
          </div>
        </div>
      )}
    </main>
  );
};

export default ParquesView;
