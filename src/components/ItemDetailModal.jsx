import React from 'react';
import { X, Package, Landmark, Tag } from 'lucide-react';
import useIsMobile from '../hooks/useIsMobile';
import BottomSheet from './BottomSheet';
import { useCategories } from '../context/CategoriesContext';

const ItemDetailModal = ({ isOpen, onClose, item, categoryTitle }) => {
  const { isMobile } = useIsMobile();
  const { getCategoryByTitle } = useCategories();

  if (!isOpen || !item) return null;

  const catConfig = getCategoryByTitle(categoryTitle) || {};
  const zoneColor = catConfig?.zone || 'arcade';

  const isCritical = (item.qty || 0) <= (item.threshold || 0);

  const content = (
    <div className="flex flex-col gap-6" style={{ padding: '0 0.5rem' }}>
      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
        {item.foto_url ? (
          <img src={item.foto_url} alt={item.name} style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 16, background: 'rgba(255,255,255,0.05)', flexShrink: 0 }} />
        ) : (
          <div style={{ width: 120, height: 120, borderRadius: 16, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', fontWeight: 800, color: 'rgba(255,255,255,0.2)', flexShrink: 0 }}>
            {item.name ? item.name.charAt(0).toUpperCase() : '?'}
          </div>
        )}
        
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.5rem 0', fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em', color: '#fff', wordWrap: 'break-word' }}>{item.name}</h3>
          {(item.subcategory || item.subcategoria) && (
            <span style={{ display: 'inline-block', padding: '0.2rem 0.6rem', background: 'rgba(255,255,255,0.1)', borderRadius: 100, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: 'rgba(255,255,255,0.8)', marginBottom: '0.5rem' }}>
              {item.subcategory || item.subcategoria}
            </span>
          )}
          {item.descripcion && (
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, wordWrap: 'break-word' }}>
              {item.descripcion}
            </p>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'rgba(255,255,255,0.4)', marginBottom: '0.25rem' }}>
            <Package size={14} /> <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Stock Actual</span>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: isCritical ? 'hsl(var(--danger))' : '#fff' }}>
            {item.qty || 0} <span style={{ fontSize: '0.9rem', opacity: 0.5 }}>{item.unit || 'pz'}</span>
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'rgba(255,255,255,0.4)', marginBottom: '0.25rem' }}>
            <Tag size={14} /> <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Marca / Referencia</span>
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff', wordWrap: 'break-word' }}>
            {item.marca || 'Genérica'} {item.item_number && <span style={{ opacity: 0.5 }}>#{item.item_number}</span>}
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'rgba(255,255,255,0.4)', marginBottom: '0.25rem' }}>
            <Landmark size={14} /> <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Ubicación</span>
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff', wordWrap: 'break-word' }}>
            {item.location || 'General'}
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'rgba(255,255,255,0.4)', marginBottom: '0.25rem' }}>
            <Package size={14} /> <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Mínimo Requerido</span>
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff' }}>
            {item.threshold || 0}
          </div>
        </div>
      </div>

      {item.observaciones && (
        <div style={{ marginTop: '0.5rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px dashed rgba(255,255,255,0.1)' }}>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.25rem' }}>Observaciones</p>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)', wordWrap: 'break-word' }}>{item.observaciones}</p>
        </div>
      )}

      <button className="btn-apple-secondary" onClick={onClose} style={{ marginTop: '1rem', width: '100%' }}>
        Cerrar
      </button>
    </div>
  );

  if (isMobile) {
    return (
      <BottomSheet isOpen={isOpen} onClose={onClose} title="Detalle del Artículo">
        {content}
      </BottomSheet>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className={`modal-card animate-scale-up`} style={{ maxWidth: 520, background: 'rgba(30, 28, 26, 0.98)', border: '1px solid rgba(255,255,255,0.08)' }} onClick={e => e.stopPropagation()}>
        <header className="modal-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: `var(--fly-${zoneColor})` }}>
            <Package size={20} />
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Detalle de Artículo</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={20} /></button>
        </header>
        {content}
      </div>
    </div>
  );
};

export default ItemDetailModal;
