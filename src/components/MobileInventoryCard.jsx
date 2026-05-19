import React, { useState, useCallback } from 'react';
import { MoreVertical, Activity, ClipboardCheck, Edit3, Trash2, FileImage, Landmark } from 'lucide-react';
import BottomSheet from './BottomSheet';
import './MobileInventoryCard.css';

/**
 * Mobile-optimized inventory item card.
 * Replaces the dense table row on mobile viewports.
 * Actions are accessible via a "more" bottom sheet.
 */
const MobileInventoryCard = React.memo(({ item, zoneColor, isAdmin, isStaff, canEditIn, categoryTitle, handlers }) => {
  const [actionsOpen, setActionsOpen] = useState(false);

  if (!item) return null;

  const isCritical = (item.qty || 0) <= (item.threshold || 0);
  const isLow = !isCritical && (item.qty || 0) <= (item.threshold || 0) * 2;
  const stockClass = isCritical ? 'critical' : isLow ? 'low' : 'ok';
  const barPct = Math.min(((item.qty || 0) / Math.max((item.threshold || 1) * 3, 1)) * 100, 100);

  const avatarClass = `mic-avatar mic-avatar-${zoneColor || 'arcade'}`;

  const handleAction = useCallback((fn) => {
    setActionsOpen(false);
    // Small delay so the bottom sheet closes smoothly before triggering action
    setTimeout(() => fn(item), 300);
  }, [item]);

  const hasActions = (isStaff || canEditIn(categoryTitle)) || isAdmin;

  return (
    <>
      <div className={`mic-card ${isCritical ? 'mic-critical' : ''}`}>
        {/* Top: Avatar + Name + More */}
        <div className="mic-top">
          <div className={avatarClass}>
            {item.name ? item.name.charAt(0).toUpperCase() : '?'}
          </div>
          <div className="mic-info">
            <span className="mic-name">{item.name || 'Sin nombre'}</span>
            <div className="mic-tags">
              {item.subcategory && <span className="mic-tag mic-tag-sub">{item.subcategory}</span>}
              {item.marca && <span className="mic-tag mic-tag-brand">{item.marca}</span>}
              {item.location && (
                <span className="mic-tag mic-tag-location">
                  <Landmark size={9} style={{ marginRight: 3, verticalAlign: '-1px' }} />
                  {item.location}
                </span>
              )}
            </div>
          </div>
          {hasActions && (
            <button className="mic-more-btn" onClick={() => setActionsOpen(true)} aria-label="Acciones">
              <MoreVertical size={20} />
            </button>
          )}
        </div>

        {/* Stock row */}
        <div className="mic-stock-row">
          <div className="mic-stock-info">
            <span className="mic-stock-label">Stock disponible</span>
            <div className="mic-stock-value">
              <span className={`mic-stock-num stock-${stockClass}`}>{item.qty ?? 0}</span>
              <span className="mic-stock-unit">{item.unit || 'pz'}</span>
            </div>
          </div>
          <div className="mic-bar-wrap">
            <span className="mic-bar-label">Mín: {item.threshold || 0}</span>
            <div className="mic-bar-bg">
              <div className={`mic-bar-fill stock-${stockClass}`} style={{ width: `${barPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Actions Bottom Sheet */}
      <BottomSheet
        isOpen={actionsOpen}
        onClose={() => setActionsOpen(false)}
        title={item.name || 'Acciones'}
      >
        <div className="mic-actions-list">
          {item.factura_url && (
            <>
              <button className="mic-action-item" onClick={() => handleAction(handlers.handleViewFactura)}>
                <div className="mic-action-icon purple"><FileImage size={20} /></div>
                <span className="mic-action-label">Ver Factura</span>
              </button>
              <div className="mic-action-divider" />
            </>
          )}

          {(isStaff || canEditIn(categoryTitle)) && (
            <>
              <button className="mic-action-item" onClick={() => handleAction(handlers.handleAction)}>
                <div className="mic-action-icon blue"><Activity size={20} /></div>
                <span className="mic-action-label">Movimiento de Stock</span>
              </button>
              <button className="mic-action-item" onClick={() => handleAction(handlers.handleAudit)}>
                <div className="mic-action-icon orange"><ClipboardCheck size={20} /></div>
                <span className="mic-action-label">Auditar Stock</span>
              </button>
              <div className="mic-action-divider" />
            </>
          )}

          {(isAdmin || canEditIn(categoryTitle)) && (
            <button className="mic-action-item" onClick={() => handleAction(handlers.handleEdit)}>
              <div className="mic-action-icon gray"><Edit3 size={20} /></div>
              <span className="mic-action-label">Editar Artículo</span>
            </button>
          )}

          {isAdmin && (
            <button className="mic-action-item" onClick={() => handleAction(handlers.handleDelete)}>
              <div className="mic-action-icon red"><Trash2 size={20} /></div>
              <span className="mic-action-label">Eliminar Artículo</span>
            </button>
          )}
        </div>
      </BottomSheet>
    </>
  );
});

export default MobileInventoryCard;
