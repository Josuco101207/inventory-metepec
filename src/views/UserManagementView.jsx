import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  UserPlus, Trash2, Shield, ShieldCheck, Mail, Loader2,
  Warehouse, User, ChevronDown, ChevronUp, Lock, Edit3, X,
  LayoutDashboard, History, Activity, Eye, EyeOff
} from 'lucide-react';
import { toast } from 'sonner';
import { CATEGORY_ICONS } from '../config/categories';
import { useCategories } from '../context/CategoriesContext';
import FlyPattern from '../components/FlyPattern';
import './UserManagementView.css';

const USERS_KEY = 'dicrejart_users';

const getUsers = () => {
  try {
    const users = localStorage.getItem(USERS_KEY);
    return users ? JSON.parse(users) : [];
  } catch (e) {
    console.error("Error reading users:", e);
    return [];
  }
};

const setUsers = (users) => {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch (e) {
    console.error("Error writing users:", e);
  }
};

const updateUser = (id, updates) => {
  const users = getUsers();
  const index = users.findIndex(u => u.id === id);
  if (index !== -1) {
    users[index] = { ...users[index], ...updates };
    setUsers(users);
    return users[index];
  }
  return null;
};

const deleteUser = (id) => {
  const users = getUsers();
  const filtered = users.filter(u => u.id !== id);
  setUsers(filtered);
};

const addUser = (userData) => {
  const users = getUsers();
  const newUser = { 
    ...userData, 
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    createdAt: new Date().toISOString()
  };
  users.push(newUser);
  setUsers(users);
  return newUser;
};

// Mini toggle checkbox button
const PermToggle = ({ active, onClick, color, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      width: 28, height: 28,
      borderRadius: 8,
      border: `2px solid ${active ? color : '#e2e8f0'}`,
      background: active ? `${color}18` : '#f8fafc',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: disabled ? 'default' : 'pointer',
      transition: 'all 0.15s',
      flexShrink: 0,
    }}
    title={active ? 'Quitar permiso' : 'Dar permiso'}
  >
    {active && <span style={{ width: 10, height: 10, borderRadius: 3, background: color, display: 'block' }} />}
  </button>
);

const UserManagementView = () => {
  const { user: currentUser } = useAuth();
  const { categories, categoryToViewId } = useCategories();
  const ALL_CATEGORIES = categories.map(cat => cat.title);
  const ALL_VIEWS = [
    { id: 'dashboard', label: 'Dashboard (Inicio)', icon: <LayoutDashboard size={14} /> },
    ...categories.map(cat => {
      const Icon = CATEGORY_ICONS[cat.iconName] || LayoutDashboard;
      return { id: cat.viewId, label: cat.title, icon: <Icon size={14} /> };
    }),
    { id: 'transactions', label: 'Transacciones (Historial)', icon: <History size={14} /> },
    { id: 'analytics', label: 'Analíticas (Gráficas)', icon: <Activity size={14} /> },
  ];
  const [users, setUsers] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const isCreatingRef = useRef(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'user' });
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [isChangeModalOpen, setIsChangeModalOpen] = useState(false);
  const [changingPasswordUser, setChangingPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;

      // Merge Supabase profiles with localStorage passwords (passwords never go to Supabase)
      const localUsers = getUsers();
      const merged = (profiles || []).map(p => {
        const local = localUsers.find(u => u.email === p.email || u.id === p.id);
        return {
          id: p.id,
          email: p.email,
          name: p.name || p.email,
          displayName: p.name || p.email,
          role: p.role || 'user',
          allowedCategories: p.allowed_categories || [],
          editableCategories: p.editable_categories || [],
          allowedViews: p.allowed_views || [],
        };
      });

      merged.sort((a, b) => (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase()));
      setUsers(merged);
    } catch (err) {
      console.error('[UserMgmt] Error loading profiles:', err.message);
      // Fallback to localStorage
      const data = getUsers();
      data.sort((a, b) => (a.displayName || a.name || '').toLowerCase().localeCompare((b.displayName || b.name || '').toLowerCase()));
      setUsers(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (isCreatingRef.current) return;
    isCreatingRef.current = true;
    setIsCreating(true);
    try {
      // 0. Save current admin session BEFORE signUp (signUp auto-switches session)
      const { data: { session: adminSession } } = await supabase.auth.getSession();

      // 1. Create user in Supabase Auth (appears in Supabase dashboard)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUser.email,
        password: newUser.password,
        options: { data: { name: newUser.name } }
      });

      if (authError) {
        toast.error(authError.message || 'Error al crear cuenta en Supabase');
        return;
      }

      // 1.5. Restore admin session so we don't get logged out
      if (adminSession) {
        await supabase.auth.setSession({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token,
        });
      }

      // 2. Insert profile row with role and permissions
      if (authData?.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: authData.user.id,
            email: newUser.email,
            name: newUser.name,
            role: newUser.role,
            allowed_categories: [...ALL_CATEGORIES],
            editable_categories: [],
            allowed_views: ['dashboard', 'tornilleria', 'papeleria', 'herramientas', 'impresion-3d', 'electronica', 'general', 'almacen-temporal', 'parques']
          }, { onConflict: 'id' });

        if (profileError) {
          console.warn('[UserMgmt] Profile insert error:', profileError.message);
        }
      }

      toast.success(`Usuario ${newUser.name} creado`);
      setIsAddModalOpen(false);
      setNewUser({ name: '', email: '', password: '', role: 'user' });

      // Reload users from Supabase
      await loadUsers();
    } catch (err) {
      toast.error(err.message || 'Error al crear cuenta');
    } finally { 
      isCreatingRef.current = false;
      setIsCreating(false); 
    }
  };

  const toggleRole = async (u) => {
    const cycle = { admin: 'almacenista', almacenista: 'supervisor', supervisor: 'user', user: 'admin' };
    const next = cycle[u.role] ?? 'user';
    if (window.confirm(`¿Cambiar rol de ${u.email} a ${next.toUpperCase()}?`)) {
      setUsers(prev => prev.map(user => user.id === u.id ? { ...user, role: next } : user));
      const { data, error } = await supabase
        .from('profiles')
        .update({ role: next })
        .eq('id', u.id)
        .select('id, role');
      if (error) {
        setUsers(prev => prev.map(user => user.id === u.id ? { ...user, role: u.role } : user));
        toast.error(`Error al cambiar rol: ${error.message}`);
        return;
      }
      if (!data || data.length === 0) {
        setUsers(prev => prev.map(user => user.id === u.id ? { ...user, role: u.role } : user));
        toast.error('Sin permiso para cambiar roles. Verifica las políticas RLS de la tabla profiles en Supabase.');
        return;
      }
      updateUser(u.id, { role: next });
      toast.success(`Rol de ${u.email} cambiado a ${next.toUpperCase()}`);
    }
  };

  const handleDelete = async (u) => {
    if (u.role === 'admin') return toast.error('No puedes eliminar a Jonathan');
    if (window.confirm(`¿Eliminar acceso para ${u.email}?`)) {
      deleteUser(u.id);
      await supabase.from('profiles').delete().eq('id', u.id);
      setUsers(prev => prev.filter(user => user.id !== u.id));
      toast.info('Perfil eliminado');
    }
  };

  // Toggle a single permission for a user
  const togglePerm = (u, field, category) => {
    const current = u[field] || [];
    const isPresent = current.includes(category);
    const next = isPresent ? current.filter(c => c !== category) : [...current, category];
    const updates = { [field]: next };

    if (!isPresent && (field === 'allowedCategories' || field === 'editableCategories')) {
      const viewId = categoryToViewId(category);
      if (viewId && !(u.allowedViews || []).includes(viewId)) {
        updates.allowedViews = [...(u.allowedViews || []), viewId];
      }
    }

    setUsers(prev => prev.map(user => user.id === u.id ? { ...user, ...updates } : user));
  };

  const savePermissions = async (u) => {
    setSaving(true);
    try {
      const { error } = await supabase.rpc('update_user_permissions', {
        target_user_id: u.id,
        new_allowed_views: u.allowedViews || [],
        new_allowed_categories: u.allowedCategories || [],
        new_editable_categories: u.editableCategories || [],
      });

      if (error) throw error;

      toast.success(`Permisos de ${u.name || u.email} guardados`);
    } catch (err) {
      console.error('[Permisos] Error completo:', err);
      toast.error('Error: ' + (err.message || JSON.stringify(err)));
    } finally {
      setSaving(false);
    }
  };

  const setAll = async (u, field, value) => {
    setSaving(true);
    const data = value 
      ? (field === 'allowedViews' ? ALL_VIEWS.map(v => v.id) : [...ALL_CATEGORIES]) 
      : [];
    try { 
      updateUser(u.id, { [field]: data });
      const sbField = field === 'allowedCategories' ? 'allowed_categories' : field === 'editableCategories' ? 'editable_categories' : 'allowed_views';
      await supabase.from('profiles').update({ [sbField]: data }).eq('id', u.id);
      setUsers(prev => prev.map(user => user.id === u.id ? { ...user, [field]: data } : user));
    }
    finally { setSaving(false); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!changingPasswordUser || !newPassword || newPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setIsUpdatingPassword(true);
    try {
      const isSelf = currentUser?.id === changingPasswordUser.id;
      if (isSelf) {
        // El propio usuario actualiza su contraseña directamente
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
      } else {
        // Admin cambia contraseña de otro usuario via Edge Function con service_role
        const { data, error } = await supabase.functions.invoke('admin-update-password', {
          body: { userId: changingPasswordUser.id, password: newPassword },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      }
      toast.success(`Contraseña de ${changingPasswordUser.email} actualizada correctamente.`);
      setIsChangeModalOpen(false);
      setNewPassword('');
    } catch (err) {
      toast.error(err.message || 'Error al actualizar contraseña');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const roleStyle = (role) => ({
    admin:       { bg: '#f0f7ff', color: '#0071e3', border: '#bfdbfe' },
    almacenista: { bg: '#fff8f0', color: '#ea580c', border: '#fed7aa' },
    supervisor:  { bg: '#f0fff4', color: '#16a34a', border: '#bbf7d0' },
    user:        { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' },
  }[role] || { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' });

  const summaryText = (u) => {
    if (u.role === 'admin') return { text: 'Acceso ilimitado', color: '#0071e3', bg: '#f0f7ff', border: '#bfdbfe' };
    if (u.role === 'supervisor') return { text: 'Supervisor de salidas', color: '#16a34a', bg: '#f0fff4', border: '#bbf7d0' };
    const a = (u.allowedCategories || []).length;
    const e = (u.editableCategories || []).length;
    if (a === 0 && e === 0) return { text: 'Sin permisos', color: '#dc2626', bg: '#fff1f1', border: '#fecaca' };
    return { text: `${a} agregar · ${e} editar`, color: '#16a34a', bg: '#f0fff4', border: '#bbf7d0' };
  };

  return (
    <div className="fly-team-view">
      <FlyPattern fixed opacity={0.04} />
      
      <div className="fly-team-container">
        
        {/* Header */}
        <div className="fly-team-header">
          <div>
            <h1 className="fly-team-title">Equipo de Trabajo</h1>
            <p className="fly-team-sub">Gestiona roles y permisos de cada miembro</p>
          </div>
          <button className="fly-btn fly-btn-primary" onClick={() => setIsAddModalOpen(true)}>
            <UserPlus size={18} /> Agregar Miembro
          </button>
        </div>

        {loading ? (
          <div className="fly-team-loading">
            <Loader2 className="animate-spin" size={32} />
          </div>
        ) : (
          <div className="fly-team-list">
            {users.map(u => {
              const isExpanded = expandedUserId === u.id;
              const isAdminUser = u.role === 'admin';
              const rs = roleStyle(u.role);
              const ss = summaryText(u);
              const allowedCats = u.allowedCategories || [];
              const editableCats = u.editableCategories || [];

              const validAllowed = (u.allowedCategories || []).filter(c => ALL_CATEGORIES.includes(c));
              const permPct = ALL_CATEGORIES.length > 0
                ? Math.round((validAllowed.length / ALL_CATEGORIES.length) * 100)
                : 0;
              const initials = (u.displayName || u.name || '?').split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();

              return (
                <div key={u.id} className={`fly-team-card ${isExpanded ? 'fly-card-expanded' : ''}`}>
                  
                  {/* User Row */}
                  <div className="fly-team-row">
                    {/* Avatar with initials */}
                    <div className={`fly-team-avatar ${isAdminUser ? 'fly-avatar-admin' : 'fly-avatar-user'}`}>
                      <span className="fly-avatar-initials">{initials}</span>
                    </div>

                    {/* Name + email + progress */}
                    <div className="fly-team-info">
                      <div className="fly-team-name-row">
                        <p className="fly-team-name">{u.displayName || u.name}</p>
                        <span className={`fly-role-pill ${u.role}`}>
                          {u.role === 'admin' && <Shield size={10} />}
                          {u.role === 'almacenista' && <Warehouse size={10} />}
                          {u.role === 'supervisor' && <ShieldCheck size={10} />}
                          {u.role === 'user' && <User size={10} />}
                          {(u.role || 'user').toUpperCase()}
                        </span>
                      </div>
                      <div className="fly-team-email-row">
                        <p className="fly-team-email"><Mail size={12} /> {u.email}</p>
                      </div>
                      {!isAdminUser && (
                        <div className="fly-team-perm-bar-wrap">
                          <div className="fly-team-perm-bar">
                            <div className="fly-team-perm-bar-fill" style={{ width: `${permPct}%` }} />
                          </div>
                          <span className="fly-team-perm-pct">{permPct}% acceso</span>
                        </div>
                      )}
                    </div>

                    {/* Summary */}
                    <span className={`fly-summary-pill fly-summary-${isAdminUser ? 'admin' : allowedCats.length === 0 ? 'none' : 'partial'}`}>
                      {ss.text}
                    </span>

                    {/* Actions */}
                    <div className="fly-team-actions">
                      {!isAdminUser && (
                        <button
                          onClick={() => setExpandedUserId(isExpanded ? null : u.id)}
                          className={`fly-action-btn ${isExpanded ? 'fly-action-active' : ''}`}
                          title="Gestionar permisos"
                        >
                          <Lock size={14} />
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                      )}
                      <button onClick={() => toggleRole(u)} title="Cambiar rol" className="fly-action-btn fly-action-icon">
                        <Shield size={14} />
                      </button>
                      <button onClick={() => { setChangingPasswordUser(u); setIsChangeModalOpen(true); }} title="Cambiar contraseña" className="fly-action-btn fly-action-icon">
                        <Lock size={14} />
                      </button>
                      <button onClick={() => handleDelete(u)} title="Eliminar" className="fly-action-btn fly-action-red fly-action-icon">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Permissions Panel */}
                  {isExpanded && !isAdminUser && (
                    <div className="fly-permissions-panel">
                      <div className="fly-permissions-grid">
                        
                        {/* LEFT: Visibility Permissions */}
                        <div className="fly-permissions-column">
                          <div className="fly-permissions-header">
                            <p className="fly-permissions-title">
                              <Eye size={14} /> ¿Qué pueden ver? (Menú)
                            </p>
                            <div className="fly-permissions-actions">
                              <button onClick={() => setAll(u, 'allowedViews', true)} disabled={saving} className="fly-perm-btn fly-perm-blue">Ver todo</button>
                              <button onClick={() => setAll(u, 'allowedViews', false)} disabled={saving} className="fly-perm-btn fly-perm-red">Bloquear</button>
                            </div>
                          </div>
                          
                          <div className="fly-permissions-list">
                            {ALL_VIEWS.map(view => {
                              const hasAccess = (u.allowedViews || []).includes(view.id);
                              const isCore = view.id === 'dashboard' || view.id === 'profile';
                              return (
                                <div 
                                  key={view.id}
                                  onClick={() => !isCore && togglePerm(u, 'allowedViews', view.id)}
                                  className={`fly-perm-item ${hasAccess ? 'fly-perm-active' : ''}`}
                                  style={{ cursor: (saving || isCore) ? 'default' : 'pointer', opacity: isCore ? 0.6 : 1 }}
                                >
                                  <div className="fly-perm-icon">{view.icon}</div>
                                  <span className="fly-perm-label">{view.label}</span>
                                  <PermToggle active={hasAccess || isCore} color="#0071e3" disabled={saving || isCore} onClick={(e) => { e.stopPropagation(); togglePerm(u, 'allowedViews', view.id); }} />
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* RIGHT: Action Permissions */}
                        <div className="fly-permissions-column">
                          <div className="fly-permissions-header">
                            <p className="fly-permissions-title">
                              <Edit3 size={14} /> ¿Qué pueden hacer?
                            </p>
                            <div className="fly-permissions-actions">
                              <button onClick={() => { setAll(u, 'allowedCategories', true); setAll(u, 'editableCategories', true); }} disabled={saving} className="fly-perm-btn fly-perm-green">Activar todo</button>
                            </div>
                          </div>

                          <div className="fly-perm-table-header">
                            <span className="fly-perm-header-col">SECCIÓN</span>
                            <span className="fly-perm-header-col fly-perm-center">ADD</span>
                            <span className="fly-perm-header-col fly-perm-center">EDIT</span>
                          </div>

                          <div className="fly-permissions-list">
                            {ALL_CATEGORIES.map(cat => {
                              const canAdd  = allowedCats.includes(cat);
                              const canEdit = editableCats.includes(cat);
                              return (
                                <div key={cat} className={`fly-perm-row ${(canAdd || canEdit) ? 'fly-perm-row-active' : ''}`}>
                                  <span className="fly-perm-row-label">{cat}</span>
                                  <div className="fly-perm-row-cell">
                                    <PermToggle active={canAdd}  color="#0071e3" disabled={saving} onClick={() => togglePerm(u, 'allowedCategories',  cat)} />
                                  </div>
                                  <div className="fly-perm-row-cell">
                                    <PermToggle active={canEdit} color="#ea580c" disabled={saving} onClick={() => togglePerm(u, 'editableCategories', cat)} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          
                          <div className="fly-perm-tip">
                            <p>💡 <strong>Tip:</strong> Si activas "Agregar" o "Editar" para una categoría, el sistema le dará automáticamente permiso de <strong>Vista</strong>.</p>
                          </div>
                        </div>
                      </div>

                      {/* Save button */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 0 4px' }}>
                        <button
                          onClick={() => savePermissions(u)}
                          disabled={saving}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '10px 24px', borderRadius: 12,
                            background: saving ? '#94a3b8' : '#0071e3',
                            color: '#fff', border: 'none', cursor: saving ? 'default' : 'pointer',
                            fontWeight: 800, fontSize: '0.85rem', letterSpacing: '0.02em',
                            transition: 'all 0.2s',
                          }}
                        >
                          {saving
                            ? <><Loader2 size={16} className="animate-spin" /> Guardando...</>
                            : <><ShieldCheck size={16} /> Guardar Permisos</>
                          }
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add user modal */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card animate-scale-up p-8">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 className="text-xl font-bold">Nuevo Miembro</h3>
              <button onClick={() => setIsAddModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            <p className="text-sm text-muted mb-6">Crea una cuenta de acceso para un trabajador.</p>
            <form onSubmit={handleCreateUser} className="flex flex-col gap-4">
              <div className="f-group">
                <label>Nombre</label>
                <input type="text" required className="w-full" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} />
              </div>
              <div className="f-group">
                <label>Correo</label>
                <input type="email" required className="w-full" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
              </div>
              <div className="f-group">
                <label>Contraseña temporal</label>
                <input type="password" required className="w-full" placeholder="Mín 6 caracteres" minLength={6} value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
              </div>
              <div className="f-group">
                <label>Rol</label>
                <select className="w-full" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                  <option value="user">Usuario</option>
                  <option value="almacenista">Almacenista</option>
                </select>
              </div>
              <div className="flex gap-4 mt-2">
                <button type="button" className="btn-secondary flex-1" onClick={() => setIsAddModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-primary flex-1 flex justify-center items-center gap-2" disabled={isCreating}>
                  {isCreating ? <Loader2 className="animate-spin" size={18} /> : 'Crear Acceso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Change password modal */}
      {isChangeModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card animate-scale-up p-8">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 className="text-xl font-bold">Cambiar Contraseña</h3>
              <button onClick={() => setIsChangeModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            <p className="text-sm text-muted mb-6">Establece una nueva contraseña para <strong>{changingPasswordUser?.email}</strong>. El usuario deberá iniciar sesión con la nueva contraseña.</p>
            <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
              <div className="f-group">
                <label>Nueva Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="password" 
                    required 
                    placeholder="Mín 6 caracteres" 
                    minLength={6}
                    className="w-full" 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)} 
                  />
                </div>
              </div>
              <div className="flex gap-4 mt-2">
                <button type="button" className="btn-secondary flex-1" onClick={() => { setIsChangeModalOpen(false); setNewPassword(''); }}>Cancelar</button>
                <button type="submit" className="btn-primary flex-1 flex justify-center items-center gap-2" disabled={isUpdatingPassword}>
                  {isUpdatingPassword ? <Loader2 className="animate-spin" size={18} /> : 'Actualizar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementView;
