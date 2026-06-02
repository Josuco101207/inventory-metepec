import React from 'react';

/**
 * FlyPattern — Fondo geometrico "Bauhaus Dinamico" (Pag. 17-19)
 * Cuartos de circulo y triangulos con opacidad 3-5% sobre FLY_DARK.
 * Alineados a reticula de 14 unidades (Pag. 7).
 *
 * Props:
 *  - opacity: 0.03 a 0.05 (default 0.04)
 *  - fixed: si true, usa position fixed (fondo global)
 *  - zIndex: default 0
 */
const FlyPattern = ({ opacity = 0.04, fixed = false, zIndex = 0 }) => {
  const containerStyle = {
    position: fixed ? 'fixed' : 'absolute',
    inset: 0,
    pointerEvents: 'none',
    overflow: 'hidden',
    zIndex: fixed ? -1 : zIndex,
  };

  // Grid de 14 columnas y 14 filas
  const cols = 14;
  const rows = 14;
  const cellSize = `${100 / cols}%`;

  const shapes = [];
  const palette = ['var(--fly-yellow)', 'var(--fly-magenta)', 'var(--zone-boliche)', 'var(--zone-arcade)', 'var(--zone-hachas)'];

  // Distribucion pseudo-aleatoria pero determinista
  const positions = [
    { c: 1, r: 2, type: 'quarter', rot: 0, size: 2, color: 0 },
    { c: 5, r: 1, type: 'triangle', rot: 45, size: 1.5, color: 1 },
    { c: 10, r: 3, type: 'circle', rot: 0, size: 1, color: 2 },
    { c: 12, r: 6, type: 'quarter', rot: 180, size: 2, color: 3 },
    { c: 2, r: 8, type: 'triangle', rot: 0, size: 2, color: 4 },
    { c: 7, r: 10, type: 'quarter', rot: 90, size: 2, color: 0 },
    { c: 11, r: 11, type: 'circle', rot: 0, size: 1.5, color: 1 },
    { c: 4, r: 5, type: 'quarter', rot: 270, size: 1.5, color: 2 },
    { c: 8, r: 7, type: 'triangle', rot: 180, size: 1, color: 3 },
    { c: 13, r: 13, type: 'quarter', rot: 45, size: 1.5, color: 4 },
  ];

  positions.forEach((p, idx) => {
    const left = `${(p.c / cols) * 100}%`;
    const top = `${(p.r / rows) * 100}%`;
    const width = `${(p.size / cols) * 100}%`;
    const height = `${(p.size / rows) * 100}%`;
    const color = palette[p.color];

    const base = {
      position: 'absolute',
      left,
      top,
      width,
      height,
      opacity,
      transform: `rotate(${p.rot}deg)`,
      transformOrigin: 'center',
    };

    if (p.type === 'quarter') {
      shapes.push(
        <div
          key={idx}
          style={{
            ...base,
            background: color,
            borderTopLeftRadius: '100%',
          }}
        />
      );
    } else if (p.type === 'triangle') {
      shapes.push(
        <div
          key={idx}
          style={{
            ...base,
            width: 0,
            height: 0,
            background: 'transparent',
            borderLeft: `calc(${width} / 2) solid transparent`,
            borderRight: `calc(${width} / 2) solid transparent`,
            borderBottom: `${height} solid ${color}`,
          }}
        />
      );
    } else if (p.type === 'circle') {
      shapes.push(
        <div
          key={idx}
          style={{
            ...base,
            background: color,
            borderRadius: '50%',
          }}
        />
      );
    }
  });

  return (
    <div style={containerStyle} aria-hidden="true">
      {shapes}
    </div>
  );
};

export default FlyPattern;
