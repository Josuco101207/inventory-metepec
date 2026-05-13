import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import Header from '../components/Header';
import AddItemModal from '../components/AddItemModal';
import { QRCodeSVG } from 'qrcode.react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { 
  Search, Plus, QrCode, ArrowUpRight, ArrowDownLeft, AlertTriangle, 
  Printer, X, Edit3, Trash2, Loader2, Wrench, ScanLine, RotateCcw, Download
} from 'lucide-react';
import { exportToExcel } from '../utils/exportUtils';
import './ToolsView.css';

const getStatusClass = (status) => {
  if (status === 'Prestado') return 'prestado';
  if (status === 'Mantenimiento') return 'mantenimiento';
  return 'disponible';
};

const ToolCard = memo(({ 
  tool, isAdmin, isStaff, canEdit, 
  isSelected, onSelectToggle,
  onEdit, onDelete, onLoan, onReturn, onFault, onRepair, onQR, index
}) => (
  <div 
    className={`tool-card animate-slide-up ${isSelected ? 'is-selected' : ''} ${isStaff ? 'has-selection-mode' : ''}`}
    style={{ animationDelay: `${(index % 10) * 0.05}s` }}
  >
    <div className={`tool-status-ribbon ${getStatusClass(tool.status)}`}></div>
    
    {(isAdmin || canEdit) && (
      <div className="tool-admin-actions">
        <button className="btn-mini-action" onClick={() => onEdit(tool)} title="Editar">
          <Edit3 size={12} />
        </button>
        {isAdmin && (
          <button className="btn-mini-action delete" onClick={() => onDelete(tool.id, tool.name)} title="Eliminar">
            <Trash2 size={12} />
          </button>
        )}
      </div>
    )}

    <div className="tool-card-header">
      {/* Selection Checkbox Custom */}
      {isStaff && tool.status !== 'Prestado' && tool.status !== 'Mantenimiento' && (
        <div className="tool-selection-box" onClick={(e) => { e.stopPropagation(); onSelectToggle(tool.id); }}>
          <div className={`tool-checkbox-custom ${isSelected ? 'checked' : ''}`}>
            {isSelected && <span className="check-mark">✓</span>}
          </div>
        </div>
      )}
      <div className="tool-info">
        <span className="tool-brand">{tool.marca || 'GENÉRICO'}</span>
        <h3 className="tool-name">{tool.name}</h3>
        <p className="tool-model">{tool.modelo || 'Sin modelo'} • <span className="font-mono text-gray-400">{tool.codigo || tool.id.substring(0,6)}</span></p>
        <div className="tool-extra-meta mt-1 text-[10px] uppercase tracking-wider text-gray-400 flex flex-wrap gap-x-3">
          {tool.item_number && <span>Item: {tool.item_number}</span>}
          {tool.serie && <span>S/N: {tool.serie}</span>}
        </div>
      </div>
      <button 
        className="tool-qr-button" 
        onClick={() => onQR(tool)}
        title="Ver Código QR"
      >
        <QrCode />
      </button>
    </div>

    <div>
      <span className={`tool-state-badge ${getStatusClass(tool.status)}`}>
        {tool.status || 'Disponible'}
      </span>
      {tool.observaciones && (
        <div className="tool-note-box mt-2 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-l-4 border-yellow-500">
          <p className="text-[11px] font-medium text-gray-600 dark:text-gray-400 leading-tight">
            <strong>Nota:</strong> {tool.observaciones}
          </p>
        </div>
      )}
    </div>

    {tool.status === 'Prestado' && tool.borrowedBy && (
      <div className="borrower-info">
        <p>Prestado a: <strong>{tool.borrowedBy}</strong></p>
      </div>
    )}

    <div className="tool-actions">
      {isStaff && (
        <>
          {tool.status !== 'Prestado' && tool.status !== 'Mantenimiento' && (
            <button className="btn-tool-action btn-loan" onClick={() => onLoan(tool)}>
              <ArrowUpRight size={16} /> Prestar
            </button>
          )}
          {tool.status === 'Prestado' && (
            <button className="btn-tool-action btn-return" onClick={() => onReturn(tool)}>
              <ArrowDownLeft size={16} /> Devolver
            </button>
          )}
          {tool.status === 'Mantenimiento' && (
            <button className="btn-tool-action btn-return bg-green-500 hover:bg-green-600" onClick={() => onRepair(tool)}>
              <RotateCcw size={16} /> Regresar Almacén
            </button>
          )}
          {tool.status !== 'Mantenimiento' && (
            <button className="btn-tool-action btn-fault" onClick={() => onFault(tool)}>
              <AlertTriangle size={16} /> Falla
            </button>
          )}
        </>
      )}
    </div>
  </div>
));

const ToolsView = () => {
  const { items, personnel, addItem, editItem, deleteItem, loanItem, bulkLoanItems, returnItem, reportMaintenance, completeMaintenance, loading } = useInventory();
  const { isAdmin, isStaff, canEditIn, canAddTo, userData } = useAuth();
  const location = useLocation();
  
  const [searchTerm, setSearchTerm] = useState(location.state?.prefillSearch || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);
  const [selectedTool, setSelectedTool] = useState(null);
  const [selectedToolIds, setSelectedToolIds] = useState([]);
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [isBulkLoanModalOpen, setIsBulkLoanModalOpen] = useState(false);
  const [isFaultModalOpen, setIsFaultModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState(null); // null | 'Prestado' | 'Mantenimiento'
  
  // Forms state
  const [borrowerName, setBorrowerName] = useState('');
  const [faultReason, setFaultReason] = useState('');

  // Worker y paginación
  const workerRef = useRef(null);
  const [filteredTools, setFilteredTools] = useState([]);
  const [visibleCount, setVisibleCount] = useState(30);
  const observerTarget = useRef(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 150);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Inicializar Worker
  useEffect(() => {
    workerRef.current = new Worker(new URL('../workers/filterWorker.js', import.meta.url));
    workerRef.current.onmessage = (e) => {
      setFilteredTools(e.data);
      setVisibleCount(30); // Reset scroll on new filter
    };
    return () => workerRef.current.terminate();
  }, []);

  // Postear al worker con debounce
  useEffect(() => {
    if (!workerRef.current || loading) return;
    const filterTimer = setTimeout(() => {
      workerRef.current.postMessage({
        items,
        searchTerm: debouncedSearch,
        categoryTitle: 'Herramientas',
        activeSubcategory: 'TODAS',
        selectedBrand: 'Todas',
        selectedLocation: 'Todas',
        statusFilter: statusFilter
      });
    }, 50);
    return () => clearTimeout(filterTimer);
  }, [items, debouncedSearch, loading, statusFilter]);

  // Intersection Observer para Infinite Scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => Math.min(prev + 30, filteredTools.length));
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );
    
    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }
    
    return () => observer.disconnect();
  }, [filteredTools.length]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full w-full flex-col gap-4">
        <Loader2 className="animate-spin text-blue-500" size={48} />
        <p className="text-gray-500 font-bold">Cargando herramientas...</p>
      </div>
    );
  }

  const userName = userData?.name || userData?.displayName || 'Jonathan';

  const handleDelete = useCallback((id, name) => {
    if (window.confirm(`¿Eliminar la herramienta "${name}" permanentemente?`)) {
      deleteItem(id, userName);
    }
  }, [deleteItem, userName]);

  const handleLoanConfirm = async () => {
    if (!borrowerName) return;
    
    // Si el usuario tenía una selección múltiple y el tool actual está en ella,
    // quizás deberíamos haber usado bulkLoan. Pero si llegó aquí es porque
    // llamó a loanItem directamente.
    await loanItem(selectedTool.id, borrowerName, userName);
    setIsLoanModalOpen(false);
    setBorrowerName('');
  };

  const handleBulkLoanConfirm = async () => {
    if (!borrowerName || selectedToolIds.length === 0) return;
    await bulkLoanItems(selectedToolIds, borrowerName, userName);
    setIsBulkLoanModalOpen(false);
    setBorrowerName('');
    setSelectedToolIds([]); // Limpiar selección tras préstamo
  };

  const toggleToolSelection = useCallback((id) => {
    setSelectedToolIds(prev => 
      prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]
    );
  }, []);

  const handleReturnConfirm = useCallback(async (tool) => {
    if (window.confirm(`¿Confirmar devolución de ${tool.name}?`)) {
      await returnItem(tool.id, userName);
    }
  }, [returnItem, userName]);

  const handleFaultConfirm = async () => {
    if (!faultReason) return;
    await reportMaintenance(selectedTool.id, faultReason, userName);
    setIsFaultModalOpen(false);
    setFaultReason('');
  };

  const handleRepairConfirm = useCallback(async (tool) => {
    if (window.confirm(`¿Confirmar que ${tool.name} ha sido reparada y regresa al almacén?`)) {
      await completeMaintenance(tool.id, userName);
    }
  }, [completeMaintenance, userName]);

  const visibleTools = filteredTools.slice(0, visibleCount);
  const canEditTools = canEditIn('Herramientas');

  return (
    <main className="tools-view animate-fade-in">
      <Header />
      
      <header className="tools-header">
        <div className="tools-title-group">
          <h2>Herramientas</h2>
          <p>Gestión individual y control por Código QR ({filteredTools.length})</p>
        </div>
        
        <div className="tools-actions">
          <div className="search-box-wrapper">
            <Search size={18} />
            <input 
              type="text" 
              placeholder="Buscar por nombre, código o marca..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
          
          <button 
            className={`btn-scan-qr ${statusFilter === 'Prestado' ? 'active-loaned' : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'Prestado' ? null : 'Prestado')}
            title="Filtrar Prestadas"
          >
            <ArrowUpRight size={18} /> {statusFilter === 'Prestado' ? 'Viendo Prestadas' : 'Prestadas'}
          </button>

          <button 
            className={`btn-scan-qr ${statusFilter === 'Mantenimiento' ? 'active-faulty' : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'Mantenimiento' ? null : 'Mantenimiento')}
            title="Filtrar con Falla"
          >
            <AlertTriangle size={18} /> {statusFilter === 'Mantenimiento' ? 'Viendo Fallas' : 'Con Falla'}
          </button>

          <button 
            className="btn-scan-qr"
            onClick={() => setIsScannerOpen(true)}
            title="Escanear QR"
          >
            <ScanLine size={18} /> Escanear
          </button>

          <button 
            className="btn-scan-qr"
            onClick={() => {
              const allTools = items.filter(i => i.category === 'Herramientas');
              exportToExcel(allTools, 'todas_las_herramientas', 'Herramientas');
            }}
            title="Exportar Todo a Excel"
          >
            <Download size={18} /> Exportar
          </button>
          
          {canAddTo('Herramientas') && (
            <button className="btn-primary-tools" onClick={() => { setSelectedTool(null); setIsAddModalOpen(true); }}>
              <Plus size={18} /> Nueva Herramienta
            </button>
          )}
        </div>
      </header>

      {/* Floating Action Bar for Bulk Selection */}
      {selectedToolIds.length > 0 && (
        <div className="bulk-actions-bar animate-slide-up">
          <div className="bulk-info">
            <span className="bulk-count">
              {selectedToolIds.length}
            </span>
            <span className="bulk-text">seleccionadas</span>
          </div>
          
          <div className="bulk-buttons">
            <button 
              className="btn-bulk-cancel"
              onClick={() => setSelectedToolIds([])}
            >
              Cancelar
            </button>
            <button 
              className="btn-bulk-action"
              onClick={() => setIsBulkLoanModalOpen(true)}
            >
              <ArrowUpRight size={16} /> Prestar Lote
            </button>
          </div>
        </div>
      )}

      <section className="tools-grid">
        {visibleTools.map((tool, index) => (
          <ToolCard 
            key={tool.id}
            tool={tool}
            index={index}
            isAdmin={isAdmin}
            isStaff={isStaff}
            canEdit={canEditTools}
            isSelected={selectedToolIds.includes(tool.id)}
            onSelectToggle={toggleToolSelection}
            onEdit={(t) => { setSelectedTool(t); setIsAddModalOpen(true); }}
            onDelete={handleDelete}
            onLoan={(t) => { 
              // Si el item clickeado está en la selección y hay más de uno, ir por lote
              if (selectedToolIds.includes(t.id) && selectedToolIds.length > 1) {
                setIsBulkLoanModalOpen(true);
              } else {
                setSelectedTool(t); 
                setIsLoanModalOpen(true);
              }
            }}
            onReturn={handleReturnConfirm}
            onFault={(t) => { setSelectedTool(t); setIsFaultModalOpen(true); }}
            onRepair={handleRepairConfirm}
            onQR={(t) => { setSelectedTool(t); setIsQRModalOpen(true); }}
          />
        ))}
        {filteredTools.length === 0 && (
          <div className="col-12 text-center py-12 text-gray-400" style={{ gridColumn: '1 / -1' }}>
            <Wrench size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-xl font-bold text-gray-500">No se encontraron herramientas</p>
          </div>
        )}
      </section>
      
      {/* Infinite Scroll Trigger */}
      {visibleCount < filteredTools.length && (
        <div ref={observerTarget} className="flex justify-center py-8">
          <Loader2 className="animate-spin text-blue-500" size={32} />
        </div>
      )}

      <AddItemModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        category="Herramientas"
        initialData={selectedTool}
        onSave={(data) => {
          if (selectedTool) {
            editItem(selectedTool.id, data, userName);
          } else {
            addItem(data, userName);
          }
          setIsAddModalOpen(false);
        }}
      />

      {isQRModalOpen && selectedTool && (
        <div className="modal-overlay">
          <div className="modal-card animate-scale-up qr-modal-content">
            <button className="absolute top-4 right-4 text-gray-400 hover:text-gray-800" onClick={() => setIsQRModalOpen(false)}>
              <X size={24} />
            </button>
            
            <div className="qr-large-wrapper" id="print-qr-section">
              <QRCodeSVG value={selectedTool.codigo || selectedTool.id} size={200} level="H" includeMargin={true} />
            </div>
            
            <h3 className="qr-tool-name">{selectedTool.name}</h3>
            <p className="qr-tool-code">{selectedTool.codigo || selectedTool.id}</p>
            
            <div className="flex gap-4 mt-8 w-full max-w-xs">
              <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={() => window.print()}>
                <Printer size={18} /> Imprimir QR
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoanModalOpen && selectedTool && (
        <div className="modal-overlay">
          <div className="modal-card animate-scale-up">
            <header className="modal-header">
              <h3>
                <ArrowUpRight className="text-blue-500" size={28} />
                Prestar Herramienta
              </h3>
              <p>¿A quién se le entrega <strong>{selectedTool.name}</strong>?</p>
            </header>

            <div className="f-group">
              <label>Nombre del Trabajador</label>
              <input 
                type="text" 
                className="f-input" 
                placeholder="Escribe el nombre aquí..." 
                list="personnel-list"
                value={borrowerName} 
                onChange={(e) => setBorrowerName(e.target.value)} 
                autoFocus
              />
            </div>

            <div className="flex gap-4">
              <button className="btn-apple-secondary flex-1" onClick={() => setIsLoanModalOpen(false)}>Cancelar</button>
              <button className="btn-apple-primary flex-1" onClick={handleLoanConfirm} disabled={!borrowerName}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {isBulkLoanModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card animate-scale-up">
            <header className="modal-header">
              <h3>
                <ArrowUpRight className="text-blue-500" size={28} />
                Préstamo Múltiple
              </h3>
              <p>¿A quién se le entregan las <strong>{selectedToolIds.length}</strong> herramientas seleccionadas?</p>
            </header>

            <div className="f-group">
              <label>Nombre del Trabajador</label>
              <input 
                type="text" 
                className="f-input" 
                placeholder="Escribe el nombre aquí..." 
                list="personnel-list"
                value={borrowerName} 
                onChange={(e) => setBorrowerName(e.target.value)} 
                autoFocus
              />
            </div>

            <div className="flex gap-4">
              <button className="btn-apple-secondary flex-1" onClick={() => setIsBulkLoanModalOpen(false)}>Cancelar</button>
              <button className="btn-apple-primary flex-1" onClick={handleBulkLoanConfirm} disabled={!borrowerName}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {isFaultModalOpen && selectedTool && (
        <div className="modal-overlay">
          <div className="modal-card animate-scale-up">
            <header className="modal-header">
              <h3>
                <AlertTriangle className="text-red-500" size={28} />
                Reportar Falla
              </h3>
              <p>Describe el problema con <strong>{selectedTool.name}</strong></p>
            </header>

            <div className="f-group">
              <label>Detalles del Problema</label>
              <textarea 
                className="f-input h-32 resize-none" 
                placeholder="¿Qué está fallando o qué mantenimiento requiere?" 
                value={faultReason} 
                onChange={(e) => setFaultReason(e.target.value)} 
                autoFocus
              />
            </div>

            <div className="flex gap-4">
              <button className="btn-apple-secondary flex-1" onClick={() => setIsFaultModalOpen(false)}>Cancelar</button>
              <button className="btn-apple-danger flex-1" onClick={handleFaultConfirm} disabled={!faultReason}>Reportar</button>
            </div>
          </div>
        </div>
      )}



      {isScannerOpen && (
        <div className="modal-overlay">
          <div className="modal-card animate-scale-up" style={{ width: '90%', maxWidth: '400px', padding: '1.5rem' }}>
            <header className="modal-header" style={{ position: 'relative', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ScanLine className="text-blue-500" size={24} />
                Escanear Herramienta
              </h3>
              <button 
                style={{ position: 'absolute', right: 0, top: 0 }}
                className="text-gray-400 hover:text-gray-800" 
                onClick={() => setIsScannerOpen(false)}
              >
                <X size={24} />
              </button>
            </header>
            
            <div style={{ borderRadius: '16px', overflow: 'hidden', backgroundColor: '#000', margin: '1rem 0' }}>
              <Scanner 
                onScan={(result) => {
                  if (result && result.length > 0) {
                    const scannedValue = result[0].rawValue;
                    
                    // Buscar la herramienta exacta por código o ID
                    const tool = items.find(i => 
                      i.category === 'Herramientas' && 
                      (i.codigo === scannedValue || i.id === scannedValue)
                    );

                    if (tool) {
                      setSearchTerm(''); // Limpiar filtro para mostrarla
                      setDebouncedSearch('');
                      setIsScannerOpen(false);
                      
                      // Pequeño delay para que el render del filtro se limpie y podamos verla
                      setTimeout(() => {
                        setSelectedTool(tool);
                        // Por defecto, si escanea una disponible, abrir préstamo. 
                        // Si está prestada, abrir devolución o mensaje.
                        if (tool.status === 'Prestado') {
                          handleReturnConfirm(tool);
                        } else if (tool.status === 'Mantenimiento') {
                          alert(`${tool.name} está en mantenimiento.`);
                        } else {
                          setIsLoanModalOpen(true);
                        }
                      }, 100);
                    } else {
                      // Si no la encuentra exacta, al menos filtrar para ver qué hay parecido
                      setSearchTerm(scannedValue);
                      setIsScannerOpen(false);
                    }
                  }
                }} 
              />
            </div>
            <p className="text-center text-gray-500 text-sm font-medium mt-4">
              Apunta la cámara al código QR para identificar la herramienta automáticamente.
            </p>
          </div>
        </div>
      )}
      {/* Global Personnel Datalist for all modals */}
      <datalist id="personnel-list">
        {personnel.map(p => <option key={p.id} value={p.name} />)}
      </datalist>
    </main>
  );
};

export default ToolsView;
