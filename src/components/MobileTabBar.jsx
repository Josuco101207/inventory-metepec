import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, Activity, User, MoreHorizontal } from 'lucide-react';
import { useCategories } from '../context/CategoriesContext';
import { CATEGORY_ICONS } from '../config/categories';
import { useAuth } from '../context/AuthContext';
import './MobileTabBar.css';

const MobileTabBar = ({ onMorePress }) => {
  const { categories } = useCategories();
  const { isAdmin } = useAuth();
  const location = useLocation();

  // Pick first 2 categories for quick access
  const quickCats = categories.slice(0, 2);

  return (
    <nav className="ios-tab-bar">
      <NavLink to="/" end className={({ isActive }) => `ios-tab ${isActive ? 'active' : ''}`}>
        <div className="ios-tab-icon"><LayoutDashboard size={22} /></div>
        <span>Inicio</span>
      </NavLink>

      {quickCats.map(cat => {
        const Icon = CATEGORY_ICONS[cat.iconName] || Package;
        const isActive = location.pathname === cat.route;
        return (
          <NavLink key={cat.id} to={cat.route} className={`ios-tab ${isActive ? 'active' : ''}`}>
            <div className="ios-tab-icon"><Icon size={22} /></div>
            <span>{cat.shortTitle?.substring(0, 7) || cat.title.substring(0, 7)}</span>
          </NavLink>
        );
      })}

      <NavLink to="/transactions" className={({ isActive }) => `ios-tab ${isActive ? 'active' : ''}`}>
        <div className="ios-tab-icon"><Activity size={22} /></div>
        <span>Historial</span>
      </NavLink>

      <button className="ios-tab" onClick={onMorePress}>
        <div className="ios-tab-icon"><MoreHorizontal size={22} /></div>
        <span>Más</span>
      </button>
    </nav>
  );
};

export default MobileTabBar;
