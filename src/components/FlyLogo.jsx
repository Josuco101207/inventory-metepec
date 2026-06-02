import React from 'react';

/**
 * FlyLogo — Logotipo OFICIAL Fly Extreme Sports Park
 * Usa la imagen oficial almacenada en /public/fly-extreme-logo.jpg
 *
 * Respeta:
 *  - Ratio 1:1 del circulo (Pag. 10 - prohibido deformar)
 *  - Area de seguridad basada en altura de "EXTREME" (Pag. 8)
 *
 * Props:
 *  - size: numero en px (default 120)
 *  - glow: bool (default false) - aplica resplandor amarillo
 *  - circular: bool (default false) - recorta como circulo perfecto
 */
const FlyLogo = ({ size = 120, glow = false, circular = false, className = '', style = {} }) => {
  return (
    <div
      className={`fly-logo ${className}`.trim()}
      style={{
        width: size,
        height: size,
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxSizing: 'border-box',
        borderRadius: circular ? '50%' : 0,
        overflow: 'hidden',
        filter: glow ? 'drop-shadow(0 0 16px rgba(224, 218, 60, 0.45)) drop-shadow(0 0 32px rgba(218, 0, 163, 0.25))' : 'none',
        ...style,
      }}
    >
      <img
        src="/fly-extreme-logo.jpg"
        alt="Fly Extreme Sports Park"
        style={{
          width: '108%',
          height: '108%',
          objectFit: 'cover',
          objectPosition: 'center',
          display: 'block',
          aspectRatio: '1 / 1',
        }}
        draggable="false"
      />
    </div>
  );
};

export default FlyLogo;
