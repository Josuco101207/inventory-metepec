/**
 * ═══════════════════════════════════════════════════════════════
 * FLY EXTREME — CATEGORIAS DE INVENTARIO
 * Fuente unica de verdad. NO duplicar listas en otros archivos.
 * ═══════════════════════════════════════════════════════════════
 *
 * Cada categoria define:
 *  - id:       slug interno usado para rutas y permisos (sin acentos, kebab-case)
 *  - title:    nombre visible en UI
 *  - shortTitle: version corta para sidebar / mobile (max 14 chars)
 *  - route:    path React Router (deriva de id, pero explicito para claridad)
 *  - viewId:   ID usado en `allowedViews` del sistema de permisos
 *  - iconName: nombre del icono Lucide (mapping resuelto en CATEGORY_ICONS)
 *  - zone:     color de zona segun manual Fly (boliche/arcade/hachas/laser/yellow/magenta)
 */

import {
  PenTool, Gift, Cpu, Cookie, Shirt, Trophy,
  Server, Gamepad2, Megaphone, Settings,
} from 'lucide-react';

export const CATEGORIES = [
  {
    id: 'insumos',
    title: 'Insumos y Papelería',
    shortTitle: 'Insumos',
    route: '/insumos',
    viewId: 'insumos',
    iconName: 'PenTool',
    zone: 'arcade',
  },
  {
    id: 'repuestos-arcades',
    title: 'Repuestos Arcades',
    shortTitle: 'Repuestos',
    route: '/repuestos-arcades',
    viewId: 'repuestos-arcades',
    iconName: 'Settings',
    zone: 'arcade',
  },
  {
    id: 'premios',
    title: 'Premios y Juguetes',
    shortTitle: 'Premios',
    route: '/premios',
    viewId: 'premios',
    iconName: 'Gift',
    zone: 'yellow',
  },
  {
    id: 'electronica',
    title: 'Electrónica y Gadgets',
    shortTitle: 'Electrónica',
    route: '/electronica',
    viewId: 'electronica',
    iconName: 'Cpu',
    zone: 'laser',
  },
  {
    id: 'alimentos',
    title: 'Alimentos y Dulcería',
    shortTitle: 'Alimentos',
    route: '/alimentos',
    viewId: 'alimentos',
    iconName: 'Cookie',
    zone: 'hachas',
  },
  {
    id: 'textiles',
    title: 'Textiles y Uniformes',
    shortTitle: 'Textiles',
    route: '/textiles',
    viewId: 'textiles',
    iconName: 'Shirt',
    zone: 'boliche',
  },
  {
    id: 'souvenirs',
    title: 'Cristalería y Souvenirs',
    shortTitle: 'Souvenirs',
    route: '/souvenirs',
    viewId: 'souvenirs',
    iconName: 'Trophy',
    zone: 'yellow',
  },
  {
    id: 'ti',
    title: 'Infraestructura y TI',
    shortTitle: 'Infra & TI',
    route: '/ti',
    viewId: 'ti',
    iconName: 'Server',
    zone: 'boliche',
  },
  {
    id: 'juegos',
    title: 'Juegos y Entretenimiento',
    shortTitle: 'Juegos',
    route: '/juegos',
    viewId: 'juegos',
    iconName: 'Gamepad2',
    zone: 'laser',
  },
  {
    id: 'publicidad',
    title: 'Promocionales',
    shortTitle: 'Promocionales',
    route: '/promocionales',
    viewId: 'promocionales',
    iconName: 'Megaphone',
    zone: 'arcade',
  },
];

// Mapa nombre -> componente Lucide para evitar imports duplicados
export const CATEGORY_ICONS = {
  PenTool, Gift, Cpu, Cookie, Shirt, Trophy,
  Server, Gamepad2, Megaphone, Settings,
};

// ═══ HELPERS ═══

/** Lista de strings con todos los titles (para selects, filtros) */
export const ALL_CATEGORY_TITLES = CATEGORIES.map(c => c.title);

/** Lista de viewIds para permisos */
export const ALL_CATEGORY_VIEW_IDS = CATEGORIES.map(c => c.viewId);

/** Mapea title -> route */
export const categoryToRoute = (categoryTitle) => {
  const cat = CATEGORIES.find(c => c.title === categoryTitle);
  if (cat) return cat.route;
  // Fallback para datos legacy (categorias viejas)
  return '/insumos';
};

/** Mapea title -> viewId (para sistema de permisos) */
export const categoryToViewId = (categoryTitle) => {
  const cat = CATEGORIES.find(c => c.title === categoryTitle);
  return cat?.viewId || null;
};

/** Obtiene la categoria completa por viewId */
export const getCategoryByViewId = (viewId) => {
  return CATEGORIES.find(c => c.viewId === viewId) || null;
};

/** Obtiene la categoria completa por title */
export const getCategoryByTitle = (title) => {
  return CATEGORIES.find(c => c.title === title) || null;
};

/**
 * Mapeo de categorias VIEJAS -> NUEVAS para migracion de items existentes.
 * Si un item tiene una categoria legacy, se reasigna automaticamente.
 */
export const LEGACY_CATEGORY_MAP = {
  'Tornillería': 'Herramientas y Mantenimiento',
  'Papelería': 'Insumos y Papelería',
  'Papelería e Insumos': 'Insumos y Papelería',
  'Herramientas': 'Herramientas y Mantenimiento',
  'Impresión 3D': 'Infraestructura y TI',
  'Electrónica': 'Electrónica y Gadgets',
  'Inventario General': 'Insumos y Papelería',
  'Almacén Temporal': 'Insumos y Papelería',
  'Parques': 'Juegos y Entretenimiento',
};

/** Migra el nombre de categoria si es legacy, sino lo deja igual */
export const migrateCategoryName = (oldName) => {
  return LEGACY_CATEGORY_MAP[oldName] || oldName;
};
