import React, { useEffect, useRef, useCallback, useState } from 'react';
import { X } from 'lucide-react';
import './BottomSheet.css';

/**
 * Native-feel Bottom Sheet for mobile.
 * - Slide up animation with spring curve
 * - Drag-to-dismiss via touch gestures
 * - Scroll lock on body when open
 * - Safe area support
 */
const BottomSheet = ({ isOpen, onClose, title, children }) => {
  const sheetRef = useRef(null);
  const dragRef = useRef({ startY: 0, currentY: 0, isDragging: false });
  const [isClosing, setIsClosing] = useState(false);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsClosing(false);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 280);
  }, [onClose]);

  // Touch handlers for drag-to-dismiss
  const handleTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    dragRef.current.startY = touch.clientY;
    dragRef.current.isDragging = true;
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!dragRef.current.isDragging || !sheetRef.current) return;
    const touch = e.touches[0];
    const deltaY = touch.clientY - dragRef.current.startY;

    // Only allow dragging down
    if (deltaY > 0) {
      e.preventDefault();
      sheetRef.current.style.transform = `translateY(${deltaY}px)`;
      sheetRef.current.style.transition = 'none';
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!dragRef.current.isDragging || !sheetRef.current) return;
    dragRef.current.isDragging = false;

    const currentTransform = sheetRef.current.style.transform;
    const match = currentTransform.match(/translateY\((\d+(?:\.\d+)?)px\)/);
    const draggedDistance = match ? parseFloat(match[1]) : 0;

    sheetRef.current.style.transition = '';
    sheetRef.current.style.transform = '';

    // Dismiss if dragged more than 120px
    if (draggedDistance > 120) {
      handleClose();
    }
  }, [handleClose]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, handleClose]);

  if (!isOpen && !isClosing) return null;

  return (
    <>
      <div
        className={`bottom-sheet-overlay ${isClosing ? 'bs-closing' : ''}`}
        onClick={handleClose}
      />
      <div
        ref={sheetRef}
        className={`bottom-sheet-container ${isClosing ? 'bs-closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="bs-drag-area"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="bs-drag-handle" />
        </div>

        {title && (
          <div className="bs-header">
            <h3 className="bs-title">{title}</h3>
            <button className="bs-close-btn" onClick={handleClose}>
              <X size={18} />
            </button>
          </div>
        )}

        <div className="bs-content">
          {children}
        </div>
      </div>
    </>
  );
};

export default BottomSheet;
