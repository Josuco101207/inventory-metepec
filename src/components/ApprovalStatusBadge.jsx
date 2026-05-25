import React from 'react';
import { Clock, CheckCircle, XCircle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { APPROVAL_STATUS } from '../context/ApprovalContext';
import './ApprovalStatusBadge.css';

const ApprovalStatusBadge = ({ status, size = 'md', showText = true, timestamp = null }) => {
  const statusConfig = {
    [APPROVAL_STATUS.PENDING]: {
      icon: Clock,
      color: 'warning',
      text: 'Pendiente',
      description: 'Esperando aprobación del supervisor'
    },
    [APPROVAL_STATUS.APPROVED]: {
      icon: CheckCircle,
      color: 'success',
      text: 'Aprobado',
      description: 'Aprobado por supervisor'
    },
    [APPROVAL_STATUS.REJECTED]: {
      icon: XCircle,
      color: 'danger',
      text: 'Rechazado',
      description: 'Rechazado por supervisor'
    },
    [APPROVAL_STATUS.EXPIRED]: {
      icon: AlertCircle,
      color: 'muted',
      text: 'Expirado',
      description: 'Tiempo de aprobación terminado'
    },
    [APPROVAL_STATUS.COMPLETED]: {
      icon: CheckCircle2,
      color: 'success',
      text: 'Completado',
      description: 'Salida completada exitosamente'
    }
  };

  const config = statusConfig[status] || statusConfig[APPROVAL_STATUS.PENDING];
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'badge-sm',
    md: 'badge-md',
    lg: 'badge-lg'
  };

  const formatTimestamp = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`approval-status-badge ${sizeClasses[size]} ${config.color}`} title={config.description}>
      <Icon size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />
      {showText && (
        <span className="status-text">
          {config.text}
          {timestamp && (
            <span className="status-timestamp">
              {formatTimestamp(timestamp)}
            </span>
          )}
        </span>
      )}
    </div>
  );
};

export default ApprovalStatusBadge;