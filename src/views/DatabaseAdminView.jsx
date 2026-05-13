import React, { useState, useEffect, useCallback } from 'react';
import { Database, Plus, Trash2, Table2, Columns3, Eye, RefreshCw, ChevronDown, ChevronRight, AlertTriangle, Check, Loader2, X, Type, Hash, Calendar, ToggleLeft, List, Package, Layers } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCategories } from '../context/CategoriesContext';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import FlyPattern from '../components/FlyPattern';
import Header from '../components/Header';
import './DatabaseAdminView.css';

const COLUMN_TYPES = [
  { value: 'text', label: 'Texto', icon: Type, color: '#34c759' },
  { value: 'int4', label: 'Número Entero', icon: Hash, color: '#007aff' },
  { value: 'float8', label: 'Número Decimal', icon: Hash, color: '#5856d6' },
  { value: 'bool', label: 'Sí/No', icon: ToggleLeft, color: '#ff9500' },
  { value: 'timestamptz', label: 'Fecha y Hora', icon: Calendar, color: '#ff2d55' },
  { value: 'jsonb', label: 'JSON / Lista', icon: List, color: '#af52de' },
  { value: 'uuid', label: 'ID Único', icon: Hash, color: '#8e8e93' },
];

const DEFAULT_COLUMNS = [
  { name: 'id', type: 'uuid', isPrimary: true, isNullable: false, defaultValue: 'gen_random_uuid()' },
  { name: 'created_at', type: 'timestamptz', isPrimary: false, isNullable: false, defaultValue: 'now()' },
];

const ZONE_OPTIONS = [
  { value: 'arcade', label: 'Arcade', color: '#8DC63F' },
  { value: 'yellow', label: 'Yellow', color: '#E2FF00' },
  { value: 'laser', label: 'Laser', color: '#00D4FF' },
  { value: 'boliche', label: 'Boliche', color: '#A855F7' },
  { value: 'hachas', label: 'Hachas', color: '#FF6B35' },
  { value: 'magenta', label: 'Magenta', color: '#FF00FF' },
];

const ICON_OPTIONS = [
  'PenTool', 'Gift', 'Cpu', 'Cookie', 'Shirt', 'Trophy',
  'Server', 'Gamepad2', 'Megaphone', 'Settings', 'Package',
  'Wrench', 'Zap', 'ShoppingCart', 'Box', 'Archive',
  'Layers', 'Tag', 'Folder', 'Database',
];

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const rpcCall = async (fnName, params = {}) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No session');
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `RPC ${fnName} failed: ${res.status}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
};

const DatabaseAdminView = () => {
  const { isAdmin, userData, loading: authLoading } = useAuth();
  const { categories, reload: reloadCategories } = useCategories();
  const [tables, setTables] = useState([]);
  const [loadingTables, setLoadingTables] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedTable, setExpandedTable] = useState(null);
  const [tableColumns, setTableColumns] = useState({});
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);

  // New category form
  const [catTitle, setCatTitle] = useState('');
  const [catShortTitle, setCatShortTitle] = useState('');
  const [catIcon, setCatIcon] = useState('Package');
  const [catZone, setCatZone] = useState('arcade');
  const [columns, setColumns] = useState([
    { name: 'name', type: 'text', required: true },
    { name: 'qty', type: 'int4', required: true },
    { name: 'threshold', type: 'int4', required: false },
    { name: 'marca', type: 'text', required: false },
    { name: 'location', type: 'text', required: false },
  ]);

  const fetchTables = useCallback(async () => {
    setLoadingTables(true);
    try {
      const data = await rpcCall('get_public_tables');
      setTables(data || []);
    } catch (err) {
      console.error('Error fetching tables:', err);
      setTables([]);
    } finally {
      setLoadingTables(false);
    }
  }, []);

  const fetchTableColumns = async (tblName) => {
    try {
      const data = await rpcCall('get_table_columns', { p_table_name: tblName });
      setTableColumns(prev => ({ ...prev, [tblName]: data }));
    } catch (err) {
      console.error('Error fetching columns:', err);
    }
  };

  useEffect(() => { fetchTables(); }, [fetchTables]);

  const handleToggleTable = (name) => {
    if (expandedTable === name) {
      setExpandedTable(null);
    } else {
      setExpandedTable(name);
      if (!tableColumns[name]) fetchTableColumns(name);
    }
  };

  // --- Column management ---
  const addColumn = () => {
    setColumns([...columns, { name: '', type: 'text', required: false }]);
  };
  const removeColumn = (i) => setColumns(columns.filter((_, idx) => idx !== i));
  const updateColumn = (i, field, value) => {
    const updated = [...columns];
    updated[i] = { ...updated[i], [field]: value };
    setColumns(updated);
  };

  // --- Generate slug from title ---
  const slugify = (str) => str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  // --- Create category + table ---
  const createCategory = async () => {
    if (!catTitle.trim()) return toast.error('Nombre de categoría requerido');
    const validCols = columns.filter(c => c.name.trim());
    if (validCols.length === 0) return toast.error('Agrega al menos una columna');

    const slug = slugify(catTitle);
    const tableName = 'cat_' + slug.replace(/-/g, '_');
    const route = '/' + slug;
    const shortTitle = catShortTitle.trim() || catTitle.trim().substring(0, 14);

    // Check duplicate
    if (categories.find(c => c.id === slug)) {
      return toast.error('Ya existe una categoría con ese nombre');
    }

    setCreating(true);
    try {
      // 1. Create table via exec_sql
      const colDefs = [
        '"id" uuid PRIMARY KEY DEFAULT gen_random_uuid()',
        '"created_at" timestamptz NOT NULL DEFAULT now()',
        '"updated_at" timestamptz DEFAULT now()',
        ...validCols.map(c => {
          const safeName = c.name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
          let def = `"${safeName}" ${c.type}`;
          if (c.required) def += ' NOT NULL';
          if (c.type === 'int4' && safeName === 'qty') def += ' DEFAULT 0';
          if (c.type === 'int4' && safeName === 'threshold') def += ' DEFAULT 0';
          return def;
        }),
      ];

      let sql = `CREATE TABLE IF NOT EXISTS public."${tableName}" (\n  ${colDefs.join(',\n  ')}\n);`;
      sql += `\nALTER TABLE public."${tableName}" ENABLE ROW LEVEL SECURITY;`;
      sql += `\nCREATE POLICY "auth_select_${tableName}" ON public."${tableName}" FOR SELECT TO authenticated USING (true);`;
      sql += `\nCREATE POLICY "auth_insert_${tableName}" ON public."${tableName}" FOR INSERT TO authenticated WITH CHECK (true);`;
      sql += `\nCREATE POLICY "auth_update_${tableName}" ON public."${tableName}" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);`;
      sql += `\nCREATE POLICY "auth_delete_${tableName}" ON public."${tableName}" FOR DELETE TO authenticated USING (true);`;

      await rpcCall('exec_sql', { query: sql });

      // 2. Insert category row
      const { data: { session } } = await supabase.auth.getSession();
      const insertRes = await fetch(`${supabaseUrl}/rest/v1/categories`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({
          slug,
          title: catTitle.trim(),
          short_title: shortTitle,
          route,
          view_id: slug,
          icon_name: catIcon,
          zone: catZone,
          table_name: tableName,
          schema: JSON.stringify(validCols.map(c => ({
            name: c.name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
            label: c.name.charAt(0).toUpperCase() + c.name.slice(1),
            type: c.type,
          }))),
        }),
      });

      if (!insertRes.ok) {
        const err = await insertRes.json().catch(() => ({}));
        throw new Error(err.message || 'Error insertando categoría');
      }

      toast.success(`Categoría "${catTitle}" creada con tabla "${tableName}"`);
      setShowCreateForm(false);
      setCatTitle('');
      setCatShortTitle('');
      setCatIcon('Package');
      setCatZone('arcade');
      setColumns([
        { name: 'name', type: 'text', required: true },
        { name: 'qty', type: 'int4', required: true },
        { name: 'threshold', type: 'int4', required: false },
        { name: 'marca', type: 'text', required: false },
        { name: 'location', type: 'text', required: false },
      ]);
      reloadCategories();
      fetchTables();
    } catch (err) {
      console.error('Create category error:', err);
      toast.error(err.message || 'Error al crear categoría');
    } finally {
      setCreating(false);
    }
  };

  // --- Delete category + table ---
  const deleteCategory = async (cat) => {
    if (!window.confirm(`¿Eliminar "${cat.title}" y toda su tabla? Esta acción es irreversible.`)) return;
    setDeleting(cat.id);
    try {
      // 1. Drop table
      await rpcCall('exec_sql', { query: `DROP TABLE IF EXISTS public."${cat.tableName}" CASCADE;` });
      // 2. Delete category row
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`${supabaseUrl}/rest/v1/categories?id=eq.${cat.supabaseId}`, {
        method: 'DELETE',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      toast.success(`"${cat.title}" eliminada`);
      reloadCategories();
      fetchTables();
    } catch (err) {
      console.error('Delete error:', err);
      toast.error(err.message || 'Error al eliminar');
    } finally {
      setDeleting(null);
    }
  };

  const getTypeInfo = (type) => COLUMN_TYPES.find(t => t.value === type) || COLUMN_TYPES[0];

  // Wait for auth to load before showing restricted message
  if (authLoading) {
    return (
      <div className="db-admin-restricted">
        <Loader2 size={48} className="animate-spin" style={{ color: 'var(--fly-yellow, #E2FF00)' }} />
        <h2>Validando sesión...</h2>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="db-admin-restricted">
        <AlertTriangle size={48} />
        <h2>Error al cargar perfil</h2>
        <p>No se pudo obtener la información del usuario.</p>
        <button className="db-btn db-btn-primary" style={{ marginTop: '1rem' }} onClick={() => window.location.reload()}>
          Reintentar
        </button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="db-admin-restricted">
        <AlertTriangle size={48} />
        <h2>Acceso Restringido</h2>
        <p>Solo administradores pueden acceder a esta sección.</p>
      </div>
    );
  }

  return (
    <div className="db-admin-view">
      <FlyPattern fixed opacity={0.03} />
      <Header />

      <div className="db-admin-container">
        {/* Header */}
        <div className="db-admin-header">
          <div className="db-admin-header-left">
            <Database size={28} className="db-admin-icon" />
            <div>
              <h1 className="db-admin-title">Gestión de Categorías</h1>
              <p className="db-admin-sub">Crea categorías que generan tablas automáticamente en Supabase</p>
            </div>
          </div>
          <div className="db-admin-header-actions">
            <button type="button" className="db-btn db-btn-secondary" onClick={() => { fetchTables(); reloadCategories(); }}>
              <RefreshCw size={16} /> Actualizar
            </button>
            <button
              type="button"
              className="db-btn db-btn-primary db-btn-new-cat"
              onClick={() => setShowCreateForm(v => !v)}
            >
              {showCreateForm ? <X size={16} /> : <Plus size={16} />}
              {showCreateForm ? 'Cancelar' : 'Nueva Categoría'}
            </button>
          </div>
        </div>

        {/* Create Category Form */}
        {showCreateForm && (
          <div className="db-create-form">
            <h2 className="db-form-title">
              <Layers size={20} /> Crear Nueva Categoría
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="db-form-group">
                <label className="db-label">Nombre de la categoría</label>
                <input
                  type="text"
                  className="db-input"
                  placeholder="ej: Herramientas, Bebidas..."
                  value={catTitle}
                  onChange={(e) => setCatTitle(e.target.value)}
                />
              </div>
              <div className="db-form-group">
                <label className="db-label">Nombre corto (sidebar)</label>
                <input
                  type="text"
                  className="db-input"
                  placeholder="ej: Herrtas (max 14 chars)"
                  maxLength={14}
                  value={catShortTitle}
                  onChange={(e) => setCatShortTitle(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
              <div className="db-form-group">
                <label className="db-label">Icono</label>
                <div className="db-select-wrapper">
                  <Package size={14} />
                  <select className="db-select" value={catIcon} onChange={(e) => setCatIcon(e.target.value)}>
                    {ICON_OPTIONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                  </select>
                </div>
              </div>
              <div className="db-form-group">
                <label className="db-label">Zona / Color</label>
                <div className="db-select-wrapper">
                  <span className="db-col-dot" style={{ background: ZONE_OPTIONS.find(z => z.value === catZone)?.color || '#ccc' }}></span>
                  <select className="db-select" value={catZone} onChange={(e) => setCatZone(e.target.value)}>
                    {ZONE_OPTIONS.map(z => <option key={z.value} value={z.value}>{z.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Auto info */}
            {catTitle && (
              <div className="db-default-cols" style={{ marginTop: '0.75rem' }}>
                <p className="db-default-cols-label">Se generará automáticamente:</p>
                <div className="db-default-cols-list">
                  <span className="db-default-col"><Table2 size={12} /> Tabla: cat_{slugify(catTitle).replace(/-/g, '_')}</span>
                  <span className="db-default-col"><Hash size={12} /> Ruta: /{slugify(catTitle)}</span>
                </div>
              </div>
            )}

            {/* Columns */}
            <div className="db-columns-section" style={{ marginTop: '1rem' }}>
              <div className="db-columns-header">
                <h3><Columns3 size={16} /> Columnas de la tabla</h3>
                <button className="db-btn-icon" onClick={addColumn}><Plus size={16} /></button>
              </div>

              <div className="db-default-cols" style={{ marginBottom: '0.5rem' }}>
                <div className="db-default-cols-list">
                  <span className="db-default-col"><Hash size={12} /> id (UUID, auto)</span>
                  <span className="db-default-col"><Calendar size={12} /> created_at (auto)</span>
                </div>
              </div>

              {columns.map((col, i) => {
                const typeInfo = getTypeInfo(col.type);
                const TypeIcon = typeInfo.icon;
                return (
                  <div key={i} className="db-column-row">
                    <input
                      type="text"
                      className="db-input db-col-name"
                      placeholder="nombre_columna"
                      value={col.name}
                      onChange={(e) => updateColumn(i, 'name', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                    />
                    <div className="db-select-wrapper">
                      <TypeIcon size={14} style={{ color: typeInfo.color }} />
                      <select className="db-select" value={col.type} onChange={(e) => updateColumn(i, 'type', e.target.value)}>
                        {COLUMN_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <label className="db-checkbox-label">
                      <input type="checkbox" checked={col.required} onChange={(e) => updateColumn(i, 'required', e.target.checked)} />
                      <span>Req</span>
                    </label>
                    <button className="db-btn-icon db-btn-danger" onClick={() => removeColumn(i)}><Trash2 size={14} /></button>
                  </div>
                );
              })}
            </div>

            <button
              className="db-btn db-btn-create"
              onClick={createCategory}
              disabled={creating || !catTitle.trim()}
            >
              {creating ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              {creating ? 'Creando...' : 'Crear Categoría + Tabla'}
            </button>
          </div>
        )}

        {/* Existing Categories */}
        <div className="db-tables-section">
          <h2 className="db-section-title">
            <Layers size={18} /> Categorías Activas
            <span className="db-count">{categories.length}</span>
          </h2>

          <div className="db-tables-list">
            {categories.map(cat => (
              <div key={cat.id} className="db-table-card">
                <div className="db-table-header" onClick={() => handleToggleTable(cat.tableName)}>
                  {expandedTable === cat.tableName ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <Table2 size={16} className="db-table-icon" />
                  <span className="db-table-name">{cat.title}</span>
                  <span className="db-table-rows" style={{ opacity: 0.5 }}>{cat.tableName}</span>
                  <span className="db-col-dot" style={{ background: ZONE_OPTIONS.find(z => z.value === cat.zone)?.color || '#ccc', marginLeft: 'auto' }}></span>
                  <button
                    className="db-btn-icon db-btn-danger"
                    style={{ marginLeft: '0.25rem' }}
                    onClick={(e) => { e.stopPropagation(); deleteCategory(cat); }}
                    disabled={deleting === cat.id}
                  >
                    {deleting === cat.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
                {expandedTable === cat.tableName && (
                  <div className="db-table-columns">
                    {tableColumns[cat.tableName] ? (
                      tableColumns[cat.tableName].map((col, i) => {
                        const typeInfo = getTypeInfo(col.data_type);
                        return (
                          <div key={i} className="db-table-col">
                            <span className="db-col-dot" style={{ background: typeInfo.color }}></span>
                            <span className="db-col-name">{col.column_name}</span>
                            <span className="db-col-type">{col.data_type}</span>
                            {col.is_nullable === 'NO' && <span className="db-col-required">requerido</span>}
                          </div>
                        );
                      })
                    ) : (
                      <div className="db-loading-sm"><Loader2 size={14} className="animate-spin" /> Cargando columnas...</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Raw Tables */}
        <div className="db-tables-section" style={{ marginTop: '2rem' }}>
          <h2 className="db-section-title">
            <Table2 size={18} /> Todas las Tablas
            {!loadingTables && <span className="db-count">{tables.length}</span>}
          </h2>
          {loadingTables ? (
            <div className="db-loading"><Loader2 size={24} className="animate-spin" /> <span>Cargando...</span></div>
          ) : (
            <div className="db-tables-list">
              {tables.map(t => (
                <div key={t.table_name} className="db-table-card">
                  <div className="db-table-header" onClick={() => handleToggleTable(t.table_name)}>
                    {expandedTable === t.table_name ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <Table2 size={16} className="db-table-icon" />
                    <span className="db-table-name">{t.table_name}</span>
                  </div>
                  {expandedTable === t.table_name && (
                    <div className="db-table-columns">
                      {tableColumns[t.table_name] ? (
                        tableColumns[t.table_name].map((col, i) => {
                          const typeInfo = getTypeInfo(col.data_type);
                          return (
                            <div key={i} className="db-table-col">
                              <span className="db-col-dot" style={{ background: typeInfo.color }}></span>
                              <span className="db-col-name">{col.column_name}</span>
                              <span className="db-col-type">{col.data_type}</span>
                              {col.is_nullable === 'NO' && <span className="db-col-required">requerido</span>}
                            </div>
                          );
                        })
                      ) : (
                        <div className="db-loading-sm"><Loader2 size={14} className="animate-spin" /> Cargando...</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DatabaseAdminView;
