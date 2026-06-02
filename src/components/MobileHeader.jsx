import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Package, X } from 'lucide-react';
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
  const { connectionStatus, items } = useInventory();
  const { categories, categoryToRoute } = useCategories();
  const location = useLocation();
  const navigate = useNavigate();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef(null);

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

  // Focus search input when opened
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isSearchOpen]);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !items) return [];
    const q = searchQuery.toLowerCase();
    return items.filter(item => {
      const safeMatch = (val) => val && String(val).toLowerCase().includes(q);
      return safeMatch(item.name) || safeMatch(item.codigo) || safeMatch(item.marca) || safeMatch(item.modelo);
    }).slice(0, 12);
  }, [searchQuery, items]);

  const handleResultClick = (item) => {
    const route = categoryToRoute(item.category);
    navigate(route, { state: { prefillSearch: item.name } });
    setSearchQuery('');
    setIsSearchOpen(false);
  };

  return (
    <>
      <header className="mobile-header">
        <div className="mh-left">
          <div className={`mh-status-dot ${connectionStatus || 'online'}`} />
          <h1 className="mh-title">{pageTitle}</h1>
        </div>

        <div className="mh-right">
          <button
            className="mh-search-btn"
            onClick={() => setIsSearchOpen(true)}
            aria-label="Buscar"
          >
            <Search size={18} />
          </button>
          <div className="mh-avatar">{userInitial}</div>
        </div>
      </header>

      {/* Search overlay */}
      {isSearchOpen && (
        <>
          <div className="mh-search-overlay">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar materiales, herramientas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
            />
            <button
              className="mh-search-cancel"
              onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }}
            >
              Cancelar
            </button>
          </div>

          {searchQuery.trim() && (
            <div className="mh-search-results">
              {searchResults.length > 0 ? (
                searchResults.map(item => (
                  <button
                    key={item.id}
                    className="mh-search-result-item"
                    onClick={() => handleResultClick(item)}
                  >
                    <Package size={18} style={{ opacity: 0.4, flexShrink: 0 }} />
                    <div className="mh-sr-info">
                      <span className="mh-sr-name">{item.name}</span>
                      <span className="mh-sr-cat">
                        {item.category || 'General'}{item.marca ? ` · ${item.marca}` : ''}
                      </span>
                    </div>
                  </button>
                ))
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
                  Sin resultados para "{searchQuery}"
                </div>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
};

export default MobileHeader;
