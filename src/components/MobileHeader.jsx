import React, { useMemo, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useInventory } from '../context/InventoryContext';
import { useCategories } from '../context/CategoriesContext';
import './MobileHeader.css';

/**
 * Route-to-title mapping for the mobile header.
 * Category routes are resolved dynamically from CategoriesContext.
 */
const STATIC_ROUTES = {
  '/': 'Dashboard',
  '/transactions': 'Historial',
  '/parques': 'Parques',
  '/analytics': 'Analytics',
  '/tools': 'Herramientas',
  '/invoices': 'Facturas',
  '/invoice-ai': 'Carga IA',
  '/manual-entry': 'Ingreso Manual',
  '/settings': 'Ajustes',
  '/profile': 'Mi Perfil',
  '/users': 'Equipo',
  '/database': 'Base de Datos',
};

const MobileHeader = () => {
  const { userData } = useAuth();
  const { connectionStatus } = useInventory();
  const { categories } = useCategories();
  const location = useLocation();

  // Resolve page title from route
  const pageTitle = useMemo(() => {
    const path = location.pathname;

    // Check static routes
    if (STATIC_ROUTES[path]) return STATIC_ROUTES[path];

    // Check category routes
    const cat = categories.find(c => c.route === path);
    if (cat) return cat.shortTitle || cat.title;

    return 'Dicrejart';
  }, [location.pathname, categories]);

  const userName = userData?.name || userData?.displayName || 'U';
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <>
      <header className="mobile-header">
        <div className="mh-left">
          <div className={`mh-status-dot ${connectionStatus || 'online'}`} />
          <h1 className="mh-title">{pageTitle}</h1>
        </div>

        <div className="mh-right">
          <div className="mh-avatar">{userInitial}</div>
        </div>
      </header>
    </>
  );
};

export default MobileHeader;
