import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Bell, User, Wifi, WifiOff, RefreshCw, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useInventory } from '../context/InventoryContext';
import { useCategories } from '../context/CategoriesContext';
import './Header.css';

const Header = () => {
  const { userData, isAdmin } = useAuth();
  const { connectionStatus, items } = useInventory();

  // Reloj en tiempo real
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const { categoryToRoute } = useCategories();
  const navigate = useNavigate();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchRef = useRef(null);

  const userName = userData?.name || userData?.displayName || 'Usuario';
  const userInitials = userName.substring(0, 1).toUpperCase();

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIndex(-1);
  }, [searchQuery]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !items) return [];
    const q = searchQuery.toLowerCase();
    return items.filter(item => {
      const safeMatch = (val) => val && String(val).toLowerCase().includes(q);
      return safeMatch(item.name) || safeMatch(item.codigo) || safeMatch(item.marca) || safeMatch(item.modelo) || safeMatch(item.item_number);
    }).slice(0, 8); // Mostrar top 8
  }, [searchQuery, items]);

  const handleResultClick = (item) => {
    const route = categoryToRoute(item.category);
    navigate(route, { state: { prefillSearch: item.name } });
    setSearchQuery('');
    setIsSearchOpen(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!isSearchOpen || searchResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const targetItem = selectedIndex >= 0 ? searchResults[selectedIndex] : searchResults[0];
      if (targetItem) handleResultClick(targetItem);
    } else if (e.key === 'Escape') {
      setIsSearchOpen(false);
    }
  };

  const getStatusIcon = () => {
    if (connectionStatus === 'online') return <Wifi size={14} className="text-emerald-500" />;
    if (connectionStatus === 'reconnecting') return <RefreshCw size={14} className="text-amber-500 animate-spin" />;
    return <WifiOff size={14} className="text-rose-500" />;
  };

  const getStatusText = () => {
    if (connectionStatus === 'online') return 'En línea';
    if (connectionStatus === 'reconnecting') return 'Sincronizando...';
    return 'Desconectado';
  };

  return (
    <header className="header">
      <div className="search-bar" ref={searchRef}>
        <Search size={18} className="search-icon-svg" />
        <input 
          type="text" 
          placeholder="Buscar materiales, herramientas..." 
          className="search-input"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsSearchOpen(true);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsSearchOpen(true)}
        />
        
        {isSearchOpen && searchQuery.trim() !== '' && (
          <div className="search-results-dropdown animate-slide-up">
            {searchResults.length > 0 ? (
              searchResults.map((item, index) => (
                <button 
                  key={item.id} 
                  className={`search-result-item ${index === selectedIndex ? 'selected' : ''}`}
                  onClick={() => handleResultClick(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="search-result-info">
                    <span className="search-result-name">{item.name}</span>
                    <span className="search-result-category">{item.category || 'General'} {item.marca ? `• ${item.marca}` : ''}</span>
                  </div>
                  <Package size={16} className="text-gray-400" />
                </button>
              ))
            ) : (
              <div className="search-result-no-results">
                No se encontraron resultados para "{searchQuery}"
              </div>
            )}
          </div>
        )}
      </div>

      <div className="header-actions">
        <div className="connection-status-pill">
          <div className={`status-dot ${connectionStatus}`}></div>
          {getStatusIcon()}
          <div className="status-info">
            <span className="status-label">{getStatusText()}</span>
            <span className="last-sync">
              {currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>

        <div className="notification-btn">
          <Bell size={20} />
          <span className="notification-dot"></span>
        </div>
        
        <div className="user-profile">
          <div className="user-info">
            <span className="user-name">{userName}</span>
            <span className="user-role">{isAdmin ? 'Jonathan' : 'Operador'}</span>
          </div>
          <div className="header-avatar">
            {userInitials}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
