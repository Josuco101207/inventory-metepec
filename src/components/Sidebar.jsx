import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  Package, PenTool, Cpu, Printer, Landmark,
  LayoutDashboard, Settings, User, LogOut, ShieldCheck, Users, Layers, Archive, History,
  Menu, X, Database, Sparkles, PlusCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import FlyLogo from './FlyLogo';
import { CATEGORY_ICONS } from '../config/categories';
import { useCategories } from '../context/CategoriesContext';
import './Sidebar.css';

const Sidebar = ({ isOpen: externalOpen, onClose: externalClose }) => {
  const { logout, userData, isAdmin } = useAuth();
  const { categories } = useCategories();
  const [internalOpen, setInternalOpen] = useState(false);
  const location = useLocation();

  // Support both internal toggle (hamburger) and external control (MobileTabBar "More")
  const isOpen = externalOpen || internalOpen;
  const closeSidebar = () => {
    setInternalOpen(false);
    if (externalClose) externalClose();
  };

  // Close sidebar on route change (mobile)
  useEffect(() => {
    closeSidebar();
  }, [location.pathname]);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const hasAccess = (viewId) => {
    if (isAdmin) return true;
    const defaultAllowed = ['dashboard', 'profile'];
    if (defaultAllowed.includes(viewId)) return true;
    if (!userData) return false;
    if (!userData.allowedViews) return true;
    return userData.allowedViews.includes(viewId);
  };

  return (
    <>
      <button 
        className={`hamburger-btn ${isOpen ? 'hamburger-open' : ''}`} 
        onClick={() => isOpen ? closeSidebar() : setInternalOpen(true)}
        aria-label="Menu"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {isOpen && (
        <div className="sidebar-overlay" onClick={closeSidebar} />
      )}

      <aside className={`sidebar ${isOpen ? 'sidebar-mobile-open' : ''}`}>
        <div className="sidebar-header" style={{ flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <FlyLogo size={84} glow circular />
          <p style={{ fontSize: 10, color: 'var(--fly-magenta)', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', margin: 0 }}>
            ● {isAdmin ? 'MODO ADMIN' : 'OPERADOR'}
          </p>
        </div>
      
        <nav className="sidebar-nav">
          <p className="sidebar-section-label">Categorías</p>
          <ul>
            {hasAccess('dashboard') && (
              <li>
                <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                  <LayoutDashboard size={20} />
                  <span>Dashboard</span>
                </NavLink>
              </li>
            )}
            {categories.map(cat => {
              if (!hasAccess(cat.viewId)) return null;
              const Icon = CATEGORY_ICONS[cat.iconName] || Package;
              return (
                <li key={cat.id}>
                  <NavLink to={cat.route} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Icon size={20} />
                    <span>{cat.shortTitle}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile-mini sidebar-user-card">
            <div className="avatar-small bg-primary flex items-center justify-center rounded-full shadow-sm" style={{ width: '32px', height: '32px', minWidth: '32px', backgroundColor: '#0071e3', color: '#fff' }}>
              <User size={16} />
            </div>
            <div className="user-details">
              <p className="user-name-text">
                {userData?.name || userData?.displayName || 'Usuario'}
              </p>
              <p className="user-email-text">
                {userData?.email}
              </p>
            </div>
          </div>

          <ul className="mt-4">
            <li>
              <NavLink to="/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <User size={20} />
                <span>Mi Perfil</span>
              </NavLink>
            </li>
            {isAdmin && (
              <>
                <li>
                  <NavLink to="/users" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Users size={20} />
                    <span>Equipo</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/database" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Database size={20} />
                    <span>Base de Datos</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/invoice-ai" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Sparkles size={20} />
                    <span>Carga IA</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/manual-entry" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <PlusCircle size={20} />
                    <span>Ingreso Manual</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Settings size={20} />
                    <span>Ajustes</span>
                  </NavLink>
                </li>
              </>
            )}
            <li>
              <button onClick={logout} className="nav-item logout w-full text-left">
                <LogOut size={20} className="text-danger" />
                <span className="text-danger">Cerrar Sesión</span>
              </button>
            </li>
          </ul>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
