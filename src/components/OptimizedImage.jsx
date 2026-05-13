import React, { useState, useEffect, useRef } from 'react';

/**
 * Componente para cargar imágenes de forma eficiente.
 */
const OptimizedImage = ({ src, alt, className }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef(null);
  const observerRef = useRef(null);

  useEffect(() => {
    if (!imgRef.current) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observerRef.current?.disconnect();
        }
      },
      { rootMargin: '200px' } // Pre-carga con margen generoso para scroll fluido
    );

    observerRef.current.observe(imgRef.current);

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, []);

  // Si no hay src o hay error, no intentar cargar la imagen
  const showImage = isInView && src && !hasError;

  return (
    <div 
      ref={imgRef}
      className={`${className || ''}`}
      style={{ 
        backgroundColor: '#f1f5f9', 
        overflow: 'hidden', 
        position: 'relative',
        minHeight: '40px',
        borderRadius: 'inherit'
      }}
    >
      {showImage && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.3s ease-in-out'
          }}
        />
      )}
      {!isLoaded && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s infinite'
        }} />
      )}
    </div>
  );
};

export default React.memo(OptimizedImage);
