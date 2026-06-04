import React, { useState, useEffect } from 'react';
import { Bell, User, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useInventory } from '../context/InventoryContext';
import './Header.css';

const Header = () => {
  const { userData, isAdmin } = useAuth();
  const { connectionStatus } = useInventory();

  // Reloj en tiempo real
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const userName = userData?.name || userData?.displayName || 'Usuario';
  const userInitials = userName.substring(0, 1).toUpperCase();

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
      {/* Search bar removed to avoid double-search confusion */}
      <div className="header-spacer" style={{ flex: 1 }}></div>

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
