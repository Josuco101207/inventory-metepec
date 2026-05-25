import React, { useState, useEffect } from 'react';
import { Bell, X, RefreshCw, Clock, CheckCircle, XCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { useApproval } from '../context/ApprovalContext';
import { APPROVAL_STATUS } from '../context/ApprovalContext';
import ApprovalStatusBadge from './ApprovalStatusBadge';
import './ApprovalNotificationPanel.css';

const ApprovalNotificationPanel = ({ isOpen, onClose, onRequestAction }) => {
  const { requests, loading, fetchMyRequests } = useApproval();
  const [filter, setFilter] = useState('all'); // all, pending, completed

  useEffect(() => {
    if (isOpen) {
      fetchMyRequests();
    }
  }, [isOpen, fetchMyRequests]);

  const filteredRequests = requests.filter(req => {
    if (filter === 'all') return true;
    if (filter === 'pending') return req.status === APPROVAL_STATUS.PENDING;
    if (filter === 'completed') return 
      req.status === APPROVAL_STATUS.APPROVED || 
      req.status === APPROVAL_STATUS.REJECTED || 
      req.status === APPROVAL_STATUS.EXPIRED;
    return true;
  });

  const handleRefresh = async () => {
    await fetchMyRequests();
  };

  const handleRequestClick = (request) => {
    if (onRequestAction) {
      onRequestAction(request);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="approval-notification-panel-overlay" onClick={onClose}>
      <div className="approval-notification-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="approval-panel-header">
          <div className="approval-panel-title">
            <Bell size={20} />
            <h2>Solicitudes de Aprobación</h2>
          </div>
          <button className="approval-panel-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Filters */}
        <div className="approval-panel-filters">
          <button 
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Todas
          </button>
          <button 
            className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
            onClick={() => setFilter('pending')}
          >
            Pendientes
          </button>
          <button 
            className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
            onClick={() => setFilter('completed')}
          >
            Completadas
          </button>
          <button 
            className="refresh-btn"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
        </div>

        {/* Content */}
        <div className="approval-panel-content">
          {loading ? (
            <div className="approval-panel-loading">
              <RefreshCw size={24} className="spin" />
              <span>Cargando solicitudes...</span>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="approval-panel-empty">
              <Bell size={32} />
              <span>No hay solicitudes {filter !== 'all' ? `en esta categoría` : ''}</span>
            </div>
          ) : (
            <div className="approval-panel-list">
              {filteredRequests.map((request) => (
                <div 
                  key={request.id}
                  className="approval-panel-item"
                  onClick={() => handleRequestClick(request)}
                >
                  <div className="approval-item-header">
                    <ApprovalStatusBadge 
                      status={request.status} 
                      size="sm"
                      timestamp={request.completed_at || request.requested_at}
                    />
                    <span className="approval-item-date">
                      {new Date(request.requested_at).toLocaleDateString('es-MX', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>

                  <div className="approval-item-details">
                    <div className="approval-item-info">
                      <span className="approval-item-label">Supervisor:</span>
                      <span className="approval-item-value">
                        {request.metadata?.supervisor_name || 'N/A'}
                      </span>
                    </div>
                    
                    {request.status === APPROVAL_STATUS.REJECTED && request.rejection_reason && (
                      <div className="approval-item-rejection">
                        <span className="approval-item-label">Motivo:</span>
                        <span className="approval-item-value rejection">
                          {request.rejection_reason}
                        </span>
                      </div>
                    )}

                    {request.status === APPROVAL_STATUS.PENDING && (
                      <div className="approval-item-timeout">
                        <Clock size={12} />
                        <span>
                          Expira: {new Date(request.timeout_at).toLocaleTimeString('es-MX', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="approval-item-actions">
                    <button className="approval-item-action-btn">
                      <ExternalLink size={14} />
                      Ver detalles
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApprovalNotificationPanel;