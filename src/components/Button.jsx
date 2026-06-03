import React from 'react';

/**
 * Button - Fly Extreme Design System
 *
 * Props:
 *  - variant: 'primary' | 'secondary' | 'ghost' | 'zone-boliche' | 'zone-arcade' | 'zone-hachas' | 'zone-laser'
 *  - size: 'sm' | 'md' | 'lg'
 *  - icon: ReactNode (opcional)
 *  - fullWidth: boolean
 *  - as: 'button' | 'a' (default 'button')
 */
const Button = ({
  variant = 'primary',
  size = 'md',
  icon,
  fullWidth = false,
  children,
  className = '',
  // as: Tag = 'button',
  style,
  ...rest
}) => {
  const variantClass = {
    primary: 'fly-btn-primary',
    secondary: 'fly-btn-secondary',
    ghost: 'fly-btn-ghost',
    'zone-boliche': 'fly-btn-zone-boliche',
    'zone-arcade': 'fly-btn-zone-arcade',
    'zone-hachas': 'fly-btn-zone-hachas',
    'zone-laser': 'fly-btn-zone-laser',
  }[variant] || 'fly-btn-primary';

  const sizeStyles = {
    sm: { padding: '0.5rem 1rem', fontSize: '0.75rem' },
    md: { padding: '0.75rem 1.5rem', fontSize: '0.875rem' },
    lg: { padding: '1rem 2rem', fontSize: '1rem' },
  }[size];

  return (
    <Tag
      className={`fly-btn ${variantClass} ${className}`.trim()}
      style={{
        ...sizeStyles,
        width: fullWidth ? '100%' : undefined,
        ...style,
      }}
      {...rest}
    >
      {icon}
      {children}
    </Tag>
  );
};

export default Button;
