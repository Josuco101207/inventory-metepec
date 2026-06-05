import React, { useState, useEffect, useCallback } from 'react';
import { Database, Plus, Trash2, Table2, Columns3, Eye, RefreshCw, ChevronDown, ChevronRight, AlertTriangle, Check, Loader2, X, Type, Hash, Calendar, ToggleLeft, List, Package, Layers, Edit2, Download, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCategories } from '../context/CategoriesContext';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import FlyPattern from '../components/FlyPattern';
import Header from '../components/Header';
import './DatabaseAdminView.css';
import useIsMobile from '../hooks/useIsMobile';

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
  const { isMobile } = useIsMobile();
  const [tables, setTables] = useState([]);
  const [loadingTables, setLoadingTables] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(() => {
    try {
      const saved = localStorage.getItem('dicrejart_db_admin_show_create_form');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });
  const [expandedTable, setExpandedTable] = useState(null);
  const [tableColumns, setTableColumns] = useState({});
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);

  // Edit category state
  const [editingCatId, setEditingCatId] = useState(null);
  const [editCatTitle, setEditCatTitle] = useState('');
  const [editCatShortTitle, setEditCatShortTitle] = useState('');
  const [editCatIcon, setEditCatIcon] = useState('Package');
  const [editCatZone, setEditCatZone] = useState('arcade');
  const [editColumns, setEditColumns] = useState([]);
  const [originalColumns, setOriginalColumns] = useState([]);
  const [updating, setUpdating] = useState(false);

  const normalizeType = (pgType) => {
    if (!pgType) return 'text';
    const t = pgType.toLowerCase();
    if (t === 'integer' || t === 'int4' || t === 'smallint' || t === 'bigint') return 'int4';
    if (t === 'boolean' || t === 'bool') return 'bool';
    if (t.includes('timestamp') || t === 'timestamptz') return 'timestamptz';
    if (t === 'double precision' || t === 'numeric' || t === 'real' || t === 'float8') return 'float8';
    if (t === 'json' || t === 'jsonb') return 'jsonb';
    if (t === 'uuid') return 'uuid';
    return 'text';
  };

  const startEditCategory = (cat) => {
    setEditingCatId(cat.id);
    setEditCatTitle(cat.title);
    setEditCatShortTitle(cat.shortTitle);
    setEditCatIcon(cat.iconName || 'Package');
    setEditCatZone(cat.zone || 'arcade');
    
    const schemaCols = Array.isArray(cat.schema) ? cat.schema : [];
    const initialCols = schemaCols.map(c => ({
      name: c.name,
      type: normalizeType(c.type),
      required: false,
      originalName: c.name
    }));
    setEditColumns(initialCols);
    setOriginalColumns(JSON.parse(JSON.stringify(initialCols)));
  };

  const cancelEditCategory = () => {
    setEditingCatId(null);
  };

  const updateCategory = async (cat) => {
    if (!editCatTitle.trim()) return toast.error('Nombre de categoría requerido');
    
    setUpdating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      // Diff columns
      const finalCols = editColumns.filter(c => c.name.trim());
      const newSchema = finalCols.map(c => ({
        name: c.name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        label: c.name.charAt(0).toUpperCase() + c.name.slice(1).replace(/_/g, ' '),
        type: c.type,
      }));

      // SQL statements
      let sql = '';
      
      // Handle drops
      for (const orig of originalColumns) {
        if (!finalCols.find(c => c.originalName === orig.originalName)) {
           sql += `ALTER TABLE public."${cat.tableName}" DROP COLUMN IF EXISTS "${orig.originalName}";\n`;
        }
      }

      // Handle renames and adds
      for (const col of finalCols) {
        const safeName = col.name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
        if (!col.originalName) {
           let def = `"${safeName}" ${col.type}`;
           if (col.required) def += ' NOT NULL';
           if (col.type === 'int4' && (safeName === 'qty' || safeName === 'stock_min')) def += ' DEFAULT 0';
           sql += `ALTER TABLE public."${cat.tableName}" ADD COLUMN IF NOT EXISTS ${def};\n`;
        } else {
           if (col.originalName !== safeName) {
             sql += `ALTER TABLE public."${cat.tableName}" RENAME COLUMN "${col.originalName}" TO "${safeName}";\n`;
           }
           
           const origCol = originalColumns.find(c => c.originalName === col.originalName);
           if (origCol && origCol.type !== col.type) {
             let castExpr = `USING "${safeName}"::${col.type}`;
             if (col.type === 'int4') {
               castExpr = `USING NULLIF(regexp_replace("${safeName}"::text, '[^0-9.-]', '', 'g'), '')::int4`;
             } else if (col.type === 'float8') {
               castExpr = `USING NULLIF(regexp_replace("${safeName}"::text, '[^0-9.-]', '', 'g'), '')::float8`;
             } else if (col.type === 'bool') {
               castExpr = `USING ("${safeName}"::text IN ('true', '1', 't', 'y', 'yes'))`;
             }
             sql += `ALTER TABLE public."${cat.tableName}" ALTER COLUMN "${safeName}" TYPE ${col.type} ${castExpr};\n`;
           }
        }
      }

      if (sql.trim()) {
         await rpcCall('exec_sql', { query: sql });
      }

      const updateRes = await fetch(`${supabaseUrl}/rest/v1/categories?id=eq.${cat.supabaseId}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({
          title: editCatTitle.trim(),
          short_title: editCatShortTitle.trim() || editCatTitle.trim().substring(0, 14),
          icon_name: editCatIcon,
          zone: editCatZone,
          schema: JSON.stringify(newSchema),
        }),
      });

      if (!updateRes.ok) {
        const err = await updateRes.json().catch(() => ({}));
        throw new Error(err.message || 'Error actualizando categoría');
      }

      toast.success(`Categoría "${editCatTitle}" actualizada`);
      setEditingCatId(null);
      reloadCategories();
    } catch (err) {
      console.error('Update category error:', err);
      toast.error(err.message || 'Error al actualizar categoría');
    } finally {
      setUpdating(false);
    }
  };

  const addEditColumn = () => {
    setEditColumns([...editColumns, { name: '', type: 'text', required: false, originalName: null }]);
  };
  const removeEditColumn = (i) => {
    const col = editColumns[i];
    if (col.originalName) {
      if (!window.confirm(`¿Seguro que deseas ELIMINAR la columna "${col.originalName}"? Esto borrará todos los datos asociados en la base de datos de forma irreversible.`)) return;
    }
    setEditColumns(editColumns.filter((_, idx) => idx !== i));
  };
  const updateEditColumn = (i, field, value) => {
    const updated = [...editColumns];
    updated[i] = { ...updated[i], [field]: value };
    setEditColumns(updated);
  };

  // New category form
  const [catTitle, setCatTitle] = useState(() => {
    return localStorage.getItem('dicrejart_db_admin_cat_title') || '';
  });
  const [catShortTitle, setCatShortTitle] = useState(() => {
    return localStorage.getItem('dicrejart_db_admin_cat_short_title') || '';
  });
  const [catIcon, setCatIcon] = useState(() => {
    return localStorage.getItem('dicrejart_db_admin_cat_icon') || 'Package';
  });
  const [catZone, setCatZone] = useState(() => {
    return localStorage.getItem('dicrejart_db_admin_cat_zone') || 'arcade';
  });
  const [columns, setColumns] = useState(() => {
    try {
      const saved = localStorage.getItem('dicrejart_db_admin_columns');
      return saved ? JSON.parse(saved) : [
        { name: 'name', type: 'text', required: true },
        { name: 'qty', type: 'int4', required: true },
        { name: 'stock_min', type: 'int4', required: false },
        { name: 'subcategoria', type: 'text', required: false },
        { name: 'marca', type: 'text', required: false },
        { name: 'location', type: 'text', required: false },
      ];
    } catch {
      return [
        { name: 'name', type: 'text', required: true },
        { name: 'qty', type: 'int4', required: true },
        { name: 'stock_min', type: 'int4', required: false },
        { name: 'subcategoria', type: 'text', required: false },
        { name: 'marca', type: 'text', required: false },
        { name: 'location', type: 'text', required: false },
      ];
    }
  });

  // Sync form state to localStorage
  useEffect(() => {
    localStorage.setItem('dicrejart_db_admin_show_create_form', JSON.stringify(showCreateForm));
  }, [showCreateForm]);

  useEffect(() => {
    localStorage.setItem('dicrejart_db_admin_cat_title', catTitle);
  }, [catTitle]);

  useEffect(() => {
    localStorage.setItem('dicrejart_db_admin_cat_short_title', catShortTitle);
  }, [catShortTitle]);

  useEffect(() => {
    localStorage.setItem('dicrejart_db_admin_cat_icon', catIcon);
  }, [catIcon]);

  useEffect(() => {
    localStorage.setItem('dicrejart_db_admin_cat_zone', catZone);
  }, [catZone]);

  useEffect(() => {
    localStorage.setItem('dicrejart_db_admin_columns', JSON.stringify(columns));
  }, [columns]);

  const [backingUp, setBackingUp] = useState(false);

  const handleBackup = async () => {
    setBackingUp(true);
    const toastId = toast.loading('Generando respaldo de la base de datos...');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // 1. Fetch all categories metadata
      const catRes = await fetch(`${supabaseUrl}/rest/v1/categories?select=*`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      const categoriesData = await catRes.json();
      
      const backupData = {
        timestamp: new Date().toISOString(),
        categories: categoriesData,
        tables: {}
      };

      // 2. Fetch data for each category table
      for (const cat of categoriesData) {
        if (cat.table_name) {
          try {
            const tableRes = await fetch(`${supabaseUrl}/rest/v1/${cat.table_name}?select=*`, {
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${session.access_token}`
              }
            });
            if (tableRes.ok) {
              backupData.tables[cat.table_name] = await tableRes.json();
            }
          } catch {
            console.warn(`Could not backup table ${cat.table_name}`);
          }
        }
      }

      // Create download
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dicrejart_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Respaldo generado con éxito', { id: toastId });
    } catch (err) {
      console.error('Backup error:', err);
      toast.error('Error al generar el respaldo', { id: toastId });
    } finally {
      setBackingUp(false);
    }
  };

  const fetchTables = useCallback(async (options = { ignore: false }) => {
    setLoadingTables(true);
    try {
      const data = await rpcCall('get_public_tables');
      if (!options.ignore) setTables(data || []);
    } catch (err) {
      if (!options.ignore) {
        console.error('Error fetching tables:', err);
        setTables([]);
      }
    } finally {
      if (!options.ignore) setLoadingTables(false);
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

  useEffect(() => {
    const opts = { ignore: false };
    fetchTables(opts);
    return () => { opts.ignore = true; };
  }, [fetchTables]);

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
          if (c.type === 'int4' && safeName === 'stock_min') def += ' DEFAULT 0';
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
        { name: 'stock_min', type: 'int4', required: false },
        { name: 'subcategoria', type: 'text', required: false },
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

  // Debug: log render state
  console.log('[DB Admin] Render - showCreateForm:', showCreateForm, 'authLoading:', authLoading);

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

  if (isMobile) {
    return (
      <div className="fly-db-mobile">
        <div className="fdm-sticky-header">
          <div className="fdm-header-top">
            <h1 className="fdm-title">Categorías</h1>
            <button className="fdm-btn-add" onClick={() => setShowCreateForm(true)}>
              <Plus size={16} /> NUEVA
            </button>
          </div>
          <div className="fdm-header-stats">
            <div className="fdm-stat">
              <span className="fdm-stat-val">{categories.length}</span>
              <span className="fdm-stat-lbl">Activas</span>
            </div>
            <button className="fdm-btn-action" onClick={handleBackup} disabled={backingUp}>
              {backingUp ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Backup
            </button>
            <button className="fdm-btn-action" onClick={() => { fetchTables(); reloadCategories(); }}>
              <RefreshCw size={16} /> Sync
            </button>
          </div>
        </div>

        <div className="fdm-content">
          {categories.map(cat => (
            <div key={cat.id} className="fdm-cat-card">
              <div className="fdm-cat-header" onClick={() => handleToggleTable(cat.tableName)}>
                <div className="fdm-cat-icon-wrap" style={{ background: ZONE_OPTIONS.find(z => z.value === cat.zone)?.color || '#ccc' }}>
                  <Package size={20} color="#000" />
                </div>
                <div className="fdm-cat-info">
                  <span className="fdm-cat-title">{cat.title}</span>
                  <span className="fdm-cat-table">{cat.tableName}</span>
                </div>
                <div className="fdm-cat-actions">
                  <button className="fdm-btn-icon text-fly-blue" onClick={(e) => { e.stopPropagation(); startEditCategory(cat); }}>
                    <Edit2 size={18} />
                  </button>
                  <button className="fdm-btn-icon text-fly-magenta" onClick={(e) => { e.stopPropagation(); deleteCategory(cat); }} disabled={deleting === cat.id}>
                    {deleting === cat.id ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                  </button>
                  <div className="fdm-chevron">
                    {expandedTable === cat.tableName ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  </div>
                </div>
              </div>

              {expandedTable === cat.tableName && (
                <div className="fdm-cat-cols">
                  {tableColumns[cat.tableName] ? (
                    tableColumns[cat.tableName].map((col, i) => {
                      const typeInfo = getTypeInfo(col.data_type);
                      return (
                        <div key={i} className="fdm-col-row">
                          <div className="fdm-col-left">
                            <span className="fdm-col-dot" style={{ background: typeInfo.color }}></span>
                            <span className="fdm-col-name">{col.column_name}</span>
                          </div>
                          <div className="fdm-col-right">
                            <span className="fdm-col-type">{col.data_type}</span>
                            {col.is_nullable === 'NO' && <span className="fdm-col-req">Req</span>}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="fdm-loading"><Loader2 size={16} className="animate-spin" /></div>
                  )}
                </div>
              )}
            </div>
          ))}

          <h2 className="fdm-section-title">Tablas Raw ({tables.length})</h2>
          <div className="fdm-raw-tables">
            {loadingTables ? (
              <div className="fdm-loading"><Loader2 size={24} className="animate-spin" /></div>
            ) : (
              tables.map(t => (
                <div key={t.table_name} className="fdm-raw-card" onClick={() => handleToggleTable(t.table_name)}>
                  <div className="fdm-raw-header">
                    <Table2 size={16} className="fdm-raw-icon" />
                    <span className="fdm-raw-name">{t.table_name}</span>
                    {expandedTable === t.table_name ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </div>
                  {expandedTable === t.table_name && (
                    <div className="fdm-cat-cols">
                      {tableColumns[t.table_name] ? (
                        tableColumns[t.table_name].map((col, i) => {
                          const typeInfo = getTypeInfo(col.data_type);
                          return (
                            <div key={i} className="fdm-col-row">
                              <div className="fdm-col-left">
                                <span className="fdm-col-dot" style={{ background: typeInfo.color }}></span>
                                <span className="fdm-col-name">{col.column_name}</span>
                              </div>
                              <div className="fdm-col-right">
                                <span className="fdm-col-type">{col.data_type}</span>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="fdm-loading"><Loader2 size={16} className="animate-spin" /></div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* CREATE MODAL */}
        {showCreateForm && (
          <div className="modal-overlay">
            <div className="modal-card p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Nueva Categoría</h3>
                <button onClick={() => setShowCreateForm(false)} className="text-gray-400"><X size={24} /></button>
              </div>
              <div className="flex flex-col gap-4">
                <div className="f-group">
                  <label>Nombre</label>
                  <input type="text" className="w-full" value={catTitle} onChange={(e) => setCatTitle(e.target.value)} />
                </div>
                <div className="f-group">
                  <label>Nombre corto</label>
                  <input type="text" className="w-full" maxLength={14} value={catShortTitle} onChange={(e) => setCatShortTitle(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <div className="f-group flex-1">
                    <label>Icono</label>
                    <select className="w-full" value={catIcon} onChange={(e) => setCatIcon(e.target.value)}>
                      {ICON_OPTIONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                    </select>
                  </div>
                  <div className="f-group flex-1">
                    <label>Zona</label>
                    <select className="w-full" value={catZone} onChange={(e) => setCatZone(e.target.value)}>
                      {ZONE_OPTIONS.map(z => <option key={z.value} value={z.value}>{z.label}</option>)}
                    </select>
                  </div>
                </div>
                
                <div className="fdm-cols-editor mt-2">
                  <div className="flex justify-between items-center mb-2">
                    <label>Columnas</label>
                    <button className="fdm-btn-icon" onClick={addColumn}><Plus size={16} /></button>
                  </div>
                  {columns.map((col, i) => (
                    <div key={i} className="fdm-col-edit-row flex items-center gap-2 mb-2">
                      <input type="text" className="flex-1" style={{ minWidth: 0, padding: '8px' }} value={col.name} onChange={(e) => updateColumn(i, 'name', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))} />
                      <select style={{ width: '80px', padding: '8px' }} value={col.type} onChange={(e) => updateColumn(i, 'type', e.target.value)}>
                        {COLUMN_TYPES.map(t => <option key={t.value} value={t.value}>{t.value}</option>)}
                      </select>
                      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={col.required} onChange={(e) => updateColumn(i, 'required', e.target.checked)} />Req</label>
                      <button className="text-fly-magenta" onClick={() => removeColumn(i)}><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-4 mt-4">
                  <button className="btn-secondary flex-1" onClick={() => setShowCreateForm(false)}>Cancelar</button>
                  <button className="btn-primary flex-1 flex justify-center items-center gap-2" onClick={createCategory} disabled={creating || !catTitle.trim()}>
                    {creating ? <Loader2 size={18} className="animate-spin" /> : 'Crear'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* EDIT MODAL */}
        {editingCatId && (() => {
          const cat = categories.find(c => c.id === editingCatId);
          return (
          <div className="modal-overlay">
            <div className="modal-card p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Editar Categoría</h3>
                <button onClick={cancelEditCategory} className="text-gray-400"><X size={24} /></button>
              </div>
              <div className="flex flex-col gap-4">
                <div className="f-group">
                  <label>Nombre</label>
                  <input type="text" className="w-full" value={editCatTitle} onChange={(e) => setEditCatTitle(e.target.value)} />
                </div>
                <div className="f-group">
                  <label>Nombre corto</label>
                  <input type="text" className="w-full" maxLength={14} value={editCatShortTitle} onChange={(e) => setEditCatShortTitle(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <div className="f-group flex-1">
                    <label>Icono</label>
                    <select className="w-full" value={editCatIcon} onChange={(e) => setEditCatIcon(e.target.value)}>
                      {ICON_OPTIONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                    </select>
                  </div>
                  <div className="f-group flex-1">
                    <label>Zona</label>
                    <select className="w-full" value={editCatZone} onChange={(e) => setEditCatZone(e.target.value)}>
                      {ZONE_OPTIONS.map(z => <option key={z.value} value={z.value}>{z.label}</option>)}
                    </select>
                  </div>
                </div>
                
                <div className="fdm-cols-editor mt-2">
                  <div className="flex justify-between items-center mb-2">
                    <label>Columnas</label>
                    <button className="fdm-btn-icon" onClick={addEditColumn}><Plus size={16} /></button>
                  </div>
                  {editColumns.map((col, i) => {
                    const isOriginal = !!col.originalName;
                    return (
                    <div key={i} className="fdm-col-edit-row flex flex-col gap-1 mb-3 pb-3 border-b border-gray-800">
                      <div className="flex items-center gap-2">
                        <input type="text" className="flex-1" style={{ minWidth: 0, padding: '8px' }} value={col.name} onChange={(e) => updateEditColumn(i, 'name', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))} />
                        <select style={{ width: '80px', padding: '8px' }} value={col.type} onChange={(e) => updateEditColumn(i, 'type', e.target.value)}>
                          {COLUMN_TYPES.map(t => <option key={t.value} value={t.value}>{t.value}</option>)}
                        </select>
                        <button className="text-fly-magenta" onClick={() => removeEditColumn(i)}><Trash2 size={16} /></button>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        {!isOriginal && (
                          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={col.required} onChange={(e) => updateEditColumn(i, 'required', e.target.checked)} />Req</label>
                        )}
                        {isOriginal && <span className="text-xs text-gray-500">Columna Existente</span>}
                      </div>
                    </div>
                  )})}
                </div>

                <div className="flex gap-4 mt-2">
                  <button className="btn-secondary flex-1" onClick={cancelEditCategory}>Cancelar</button>
                  <button className="btn-primary flex-1 flex justify-center items-center gap-2" onClick={() => updateCategory(cat)} disabled={updating}>
                    {updating ? <Loader2 size={18} className="animate-spin" /> : 'Guardar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )})}
      </div>
    );
  }

  return (
    <div className="db-admin-view">
      <FlyPattern fixed opacity={0.03} />
      <Header />

      <div className="db-admin-container">
        {/* Hero Header Fluido */}
        <div className="db-admin-hero">
          <div className="db-fluid-bg">
            <div className="db-fluid-orb db-orb-1" />
            <div className="db-fluid-orb db-orb-2" />
            <div className="db-fluid-orb db-orb-3" />
            <div className="db-fluid-overlay" />
          </div>
          
          <div className="db-admin-header-content">
            <div className="db-admin-header-left">
              <Database size={48} className="db-admin-icon" />
              <div>
                <h1 className="db-admin-title">Gestión de Categorías</h1>
                <p className="db-admin-sub">Estructura y Base de Datos Dinámica</p>
              </div>
            </div>
            
            <div className="db-admin-header-actions">
              <button type="button" className="db-btn" onClick={handleBackup} disabled={backingUp}>
                {backingUp ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} RESPALDO
              </button>
              <button type="button" className="db-btn" onClick={() => { fetchTables(); reloadCategories(); }}>
                <RefreshCw size={16} /> ACTUALIZAR
              </button>
              <button
                type="button"
                className="db-btn db-btn-primary db-btn-new-cat"
                onClick={() => setShowCreateForm(v => !v)}
              >
                {showCreateForm ? <X size={16} /> : <Plus size={16} />}
                {showCreateForm ? 'CANCELAR' : 'NUEVA CATEGORÍA'}
              </button>
            </div>
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
                    className="db-btn-icon"
                    style={{ marginLeft: '0.5rem', color: 'var(--fly-blue)' }}
                    onClick={(e) => { e.stopPropagation(); startEditCategory(cat); }}
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    className="db-btn-icon db-btn-danger"
                    style={{ marginLeft: '0.25rem' }}
                    onClick={(e) => { e.stopPropagation(); deleteCategory(cat); }}
                    disabled={deleting === cat.id}
                  >
                    {deleting === cat.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
                
                {editingCatId === cat.id && (
                  <div className="db-create-form" style={{ margin: '1rem', border: '1px solid var(--fly-border)', borderRadius: '12px', padding: '1rem', background: 'var(--fly-panel-bg)' }} onClick={e => e.stopPropagation()}>
                    <h3 style={{ marginBottom: '1rem', fontSize: '1rem', color: 'var(--fly-text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Edit2 size={16} /> Editar Metadatos
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div className="db-form-group">
                        <label className="db-label">Nombre</label>
                        <input type="text" className="db-input" value={editCatTitle} onChange={(e) => setEditCatTitle(e.target.value)} />
                      </div>
                      <div className="db-form-group">
                        <label className="db-label">Nombre corto</label>
                        <input type="text" className="db-input" maxLength={14} value={editCatShortTitle} onChange={(e) => setEditCatShortTitle(e.target.value)} />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
                      <div className="db-form-group">
                        <label className="db-label">Icono</label>
                        <div className="db-select-wrapper">
                          <Package size={14} />
                          <select className="db-select" value={editCatIcon} onChange={(e) => setEditCatIcon(e.target.value)}>
                            {ICON_OPTIONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="db-form-group">
                        <label className="db-label">Zona / Color</label>
                        <div className="db-select-wrapper">
                          <span className="db-col-dot" style={{ background: ZONE_OPTIONS.find(z => z.value === editCatZone)?.color || '#ccc' }}></span>
                          <select className="db-select" value={editCatZone} onChange={(e) => setEditCatZone(e.target.value)}>
                            {ZONE_OPTIONS.map(z => <option key={z.value} value={z.value}>{z.label}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                    
                    {/* Columns Edit Section */}
                    <div className="db-columns-section" style={{ marginTop: '1.5rem', borderTop: '1px solid var(--fly-border)', paddingTop: '1rem' }}>
                      <div className="db-columns-header">
                        <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--fly-text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Columns3 size={14} /> Esquema de la Tabla
                        </h4>
                        <button className="db-btn-icon" onClick={addEditColumn}><Plus size={14} /></button>
                      </div>

                      <div className="db-default-cols" style={{ marginBottom: '0.5rem' }}>
                        <div className="db-default-cols-list">
                          <span className="db-default-col"><Hash size={12} /> id (UUID, auto)</span>
                          <span className="db-default-col"><Calendar size={12} /> created_at (auto)</span>
                          <span className="db-default-col"><Calendar size={12} /> updated_at (auto)</span>
                        </div>
                      </div>

                      {editColumns.map((col, i) => {
                        const typeInfo = getTypeInfo(col.type);
                        const TypeIcon = typeInfo.icon;
                        const isOriginal = !!col.originalName;
                        return (
                          <div key={i} className="db-column-row">
                            <input
                              type="text"
                              className="db-input db-col-name"
                              placeholder="nombre_columna"
                              value={col.name}
                              onChange={(e) => updateEditColumn(i, 'name', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                            />
                            <div className="db-select-wrapper">
                              <TypeIcon size={14} style={{ color: typeInfo.color }} />
                              <select className="db-select" value={col.type} onChange={(e) => updateEditColumn(i, 'type', e.target.value)}>
                                {COLUMN_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                              </select>
                            </div>
                            {!isOriginal && (
                              <label className="db-checkbox-label">
                                <input type="checkbox" checked={col.required} onChange={(e) => updateEditColumn(i, 'required', e.target.checked)} />
                                <span>Req</span>
                              </label>
                            )}
                            {isOriginal && <span style={{ fontSize: '0.7rem', color: 'var(--fly-border)' }}>Existente</span>}
                            <button className="db-btn-icon db-btn-danger" onClick={() => removeEditColumn(i)}><Trash2 size={14} /></button>
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                      <button className="db-btn" style={{ background: 'transparent', border: '1px solid var(--fly-border)', color: 'var(--fly-text)' }} onClick={cancelEditCategory}>
                        Cancelar
                      </button>
                      <button className="db-btn db-btn-primary" onClick={() => updateCategory(cat)} disabled={updating}>
                        {updating ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Guardar Cambios
                      </button>
                    </div>
                  </div>
                )}

                {expandedTable === cat.tableName && editingCatId !== cat.id && (
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
