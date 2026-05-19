import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, Activity, Wrench, MoreHorizontal } from 'lucide-react';
import { useCategories } from '../context/CategoriesContext';
import { CATEGORY_ICONS } from '../config/categories';
import { useAuth } from '../context/AuthContext';
import './MobileTabBar.css';

const MobileTabBar = ({ onMorePress }) => {
  const { categories } = useCategories();
  const { isAdmin } = useAuth();

  // Get first category for the Inventario tab
  const firstCat = categories[0];
  const FirstCatIcon = firstCat ? (CATEGORY_ICONS[firstCat.iconName] || Package) : Package;
  const firstCatRoute = firstCat ? firstCat.route : '/';

  return (
    <nav className="ios-tab-bar" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
      <NavLink to="/" end className={({ isActive }) => `ios-tab ${isActive ? 'active' : ''}`}>
        <div className="ios-tab-icon"><LayoutDashboard size={22} /></div>
        <span>Inicio</span>
      </NavLink>

      <NavLink to={firstCatRoute} className={({ isActive }) => `ios-tab ${isActive ? 'active' : ''}`}>
        <div className="ios-tab-icon"><FirstCatIcon size={22} /></div>
        <span>Inventario</span>
      </NavLink>

      <NavLink to="/transactions" className={({ isActive }) => `ios-tab ${isActive ? 'active' : ''}`}>
        <div className="ios-tab-icon"><Activity size={22} /></div>
        <span>Historial</span>
      </NavLink>

      {isAdmin && (
        <NavLink to="/tools" className={({ isActive }) => `ios-tab ${isActive ? 'active' : ''}`}>
          <div className="ios-tab-icon"><Wrench size={22} /></div>
          <span>Herramientas</span>
        </NavLink>
      )}

      <button className="ios-tab" onClick={onMorePress}>
        <div className="ios-tab-icon"><MoreHorizontal size={22} /></div>
        <span>Más</span>
      </button>
    </nav>
  );
};

export default MobileTabBar;
