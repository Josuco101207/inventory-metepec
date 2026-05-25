import React, { useState, useEffect, useCallback } from 'react';
import { Search, Shield, ShieldCheck, ChevronDown, ChevronUp, Mail, User, Loader2 } from 'lucide-react';
import { useApproval } from '../context/ApprovalContext';
import './SupervisorSelector.css';

const SupervisorSelector = ({ onSelect, selectedId, disabled = false }) => {
  const { supervisors, loading: loadingSupervisors, fetchSupervisors } = useApproval();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredSupervisors, setFilteredSupervisors] = useState([]);

  const selectedSupervisor = supervisors.find(s => s.id === selectedId);

  // Filtrar supervisores basado en búsqueda
  useEffect(() => {
    if (!searchTerm) {
      setFilteredSupervisors(supervisors);
    } else {
      const term = searchTerm.toLowerCase();
      setFilteredSupervisors(supervisors.filter(s => 
        s.name?.toLowerCase().includes(term) || 
        s.email?.toLowerCase().includes(term)
      ));
    }
  }, [searchTerm, supervisors]);

  // Manejar selección
  const handleSelect = useCallback((supervisor) => {
    onSelect(supervisor.id);
    setIsOpen(false);
    setSearchTerm('');
  }, [onSelect]);

  // Refrescar lista de supervisores
  const handleRefresh = useCallback(async () => {
    await fetchSupervisors();
  }, [fetchSupervisors]);

  // Cargar supervisores al montar
  useEffect(() => {
    if (supervisors.length === 0 && !loadingSupervisors) {
      fetchSupervisors();
    }
  }, [supervisors.length, loadingSupervisors, fetchSupervisors]);

  return (
    <div className="supervisor-selector">
      <label className="supervisor-selector-label">
        <ShieldCheck size={14} />
        Seleccionar Supervisor
        <span className="required">*</span>
      </label>

      <div className={`supervisor-selector-trigger ${disabled ? 'disabled' : ''}`} onClick={() => !disabled && setIsOpen(!isOpen)}>
        {selectedSupervisor ? (
          <div className="supervisor-selected">
            <div className="supervisor-avatar">
              <User size={16} />
            </div>
            <div className="supervisor-info">
              <span className="supervisor-name">{selectedSupervisor.name}</span>
              <span className="supervisor-email">{selectedSupervisor.email}</span>
            </div>
            <div className={`supervisor-role ${selectedSupervisor.role}`}>
              <Shield size={12} />
              {selectedSupervisor.role === 'admin' ? 'Admin' : 'Supervisor'}
            </div>
          </div>
        ) : (
          <div className="supervisor-placeholder">
            <Search size={16} />
            <span>Buscar supervisor...</span>
          </div>
        )}
        {!disabled && (
          <div className="supervisor-chevron">
            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        )}
      </div>

      {isOpen && !disabled && (
        <div className="supervisor-dropdown">
          {/* Barra de búsqueda */}
          <div className="supervisor-search">
            <Search size={14} />
            <input
              type="text"
              placeholder="Buscar por nombre o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Lista de supervisores */}
          <div className="supervisor-list">
            {loadingSupervisors ? (
              <div className="supervisor-loading">
                <Loader2 size={20} className="spin" />
                <span>Cargando supervisores...</span>
              </div>
            ) : filteredSupervisors.length === 0 ? (
              <div className="supervisor-empty">
                <Shield size={20} />
                <span>No se encontraron supervisores con rol admin/supervisor</span>
                <button 
                  className="supervisor-refresh-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRefresh();
                  }}
                >
                  Reintentar
                </button>
              </div>
            ) : (
              filteredSupervisors.map((supervisor) => (
                <div
                  key={supervisor.id}
                  className={`supervisor-item ${selectedId === supervisor.id ? 'selected' : ''}`}
                  onClick={() => handleSelect(supervisor)}
                >
                  <div className="supervisor-item-avatar">
                    <User size={16} />
                  </div>
                  <div className="supervisor-item-info">
                    <span className="supervisor-item-name">{supervisor.name}</span>
                    <span className="supervisor-item-email">
                      <Mail size={12} />
                      {supervisor.email}
                    </span>
                  </div>
                  <div className={`supervisor-item-role ${supervisor.role}`}>
                    <Shield size={12} />
                    {supervisor.role === 'admin' ? 'Admin' : 'Supervisor'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SupervisorSelector;