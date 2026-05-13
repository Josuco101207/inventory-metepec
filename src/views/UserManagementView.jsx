import React, { useState, useEffect } from 'react';
import { localAuth } from '../auth/localAuth';
import {
  UserPlus, Trash2, Shield, Mail, Key, Loader2,
  Warehouse, User, ChevronDown, ChevronUp, Lock, PlusCircle, Edit3, X, Eye, EyeOff,
  LayoutDashboard, History, Activity, FileText
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
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'user' });
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showPasswords, setShowPasswords] = useState({});
  const [isChangeModalOpen, setIsChangeModalOpen] = useState(false);
  const [changingPasswordUser, setChangingPasswordUser] = useState(null);
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  useEffect(() => {
    const data = getUsers();
    data.sort((a, b) => (a.displayName || a.name || '').toLowerCase().localeCompare((b.displayName || b.name || '').toLowerCase()));
    setUsers(data);
    setLoading(false);
  }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const result = await localAuth.register({
        email: newUser.email,
        password: newUser.password,
        name: newUser.name
      });
      
      if (result.success) {
        addUser({
          name: newUser.name,
          displayName: newUser.name,
          email: newUser.email,
          role: newUser.role,
          allowedCategories: [...ALL_CATEGORIES],
          editableCategories: [],
          allowedViews: ['dashboard', 'tornilleria', 'papeleria', 'herramientas', 'impresion-3d', 'electronica', 'general', 'almacen-temporal', 'parques'],
          password: newUser.password
        });
        
        toast.success(`Usuario ${newUser.name} creado`);
        setIsAddModalOpen(false);
        setNewUser({ name: '', email: '', password: '', role: 'user' });
        
        // Reload users
        const data = getUsers();
        data.sort((a, b) => (a.displayName || a.name || '').toLowerCase().localeCompare((b.displayName || b.name || '').toLowerCase()));
        setUsers(data);
      } else {
        toast.error(result.error || 'Error al crear cuenta');
      }
    } catch (err) {
      toast.error(err.message || 'Error al crear cuenta');
    } finally { 
      setIsCreating(false); 
    }
  };

  const toggleRole = async (u) => {
    const next = u.role === 'admin' ? 'almacenista' : u.role === 'almacenista' ? 'user' : 'admin';
    if (window.confirm(`¿Cambiar rol de ${u.email} a ${next.toUpperCase()}?`)) {
      updateUser(u.id, { role: next });
      setUsers(prev => prev.map(user => user.id === u.id ? { ...user, role: next } : user));
      toast.success(`Rol cambiado a ${next}`);
    }
  };

  const handleDelete = async (u) => {
    if (u.role === 'admin') return toast.error('No puedes eliminar a Jonathan');
    if (window.confirm(`¿Eliminar acceso para ${u.email}?`)) {
      deleteUser(u.id);
      setUsers(prev => prev.filter(user => user.id !== u.id));
      toast.info('Perfil eliminado');
    }
  };

  // Toggle a single permission for a user
  const togglePerm = async (u, field, category) => {
    const current = u[field] || [];
    const isPresent = current.includes(category);
    const next = isPresent ? current.filter(c => c !== category) : [...current, category];
    
    setSaving(true);
    try {
      const updates = { [field]: next };
      
      // Auto-sync: If they can Add or Edit, they MUST be able to View.
      // If they lose View, they probably shouldn't Add/Edit (optional, but safer)
      if (!isPresent && (field === 'allowedCategories' || field === 'editableCategories')) {
        const viewId = categoryToViewId(category);
        if (viewId && !(u.allowedViews || []).includes(viewId)) {
          updates.allowedViews = [...(u.allowedViews || []), viewId];
        }
      }
      
      updateUser(u.id, updates);
      setUsers(prev => prev.map(user => user.id === u.id ? { ...user, ...updates } : user));
    }
    catch { toast.error('Error al guardar'); }
    finally { setSaving(false); }
  };

  const setAll = async (u, field, value) => {
    setSaving(true);
    const data = value 
      ? (field === 'allowedViews' ? ALL_VIEWS.map(v => v.id) : [...ALL_CATEGORIES]) 
      : [];
    try { 
      updateUser(u.id, { [field]: data });
      setUsers(prev => prev.map(user => user.id === u.id ? { ...user, [field]: data } : user));
    }
    finally { setSaving(false); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!changingPasswordUser || !newPassword) return;
    setIsUpdatingPassword(true);

    try {
      // Update in localStorage
      updateUser(changingPasswordUser.id, {
        password: newPassword
      });
      setUsers(prev => prev.map(user => user.id === changingPasswordUser.id ? { ...user, password: newPassword } : user));

      toast.success(`Contraseña de ${changingPasswordUser.email} actualizada`);
      setIsChangeModalOpen(false);
      setNewPassword('');
      setCurrentPasswordInput('');
    } catch (err) {
      toast.error(err.message || "Error al actualizar contraseña");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const sendResetEmail = async (email) => {
    // Not implemented for local version
    toast.info("Función no disponible en versión local");
  };

  const togglePasswordVisibility = (uid) => {
    setShowPasswords(prev => ({ ...prev, [uid]: !prev[uid] }));
  };

  const roleStyle = (role) => ({
    admin:       { bg: '#f0f7ff', color: '#0071e3', border: '#bfdbfe' },
    almacenista: { bg: '#fff8f0', color: '#ea580c', border: '#fed7aa' },
    user:        { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' },
  }[role] || { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' });

  const summaryText = (u) => {
    if (u.role === 'admin') return { text: 'Acceso ilimitado', color: '#0071e3', bg: '#f0f7ff', border: '#bfdbfe' };
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

              return (
                <div key={u.id} className={`fly-team-card ${isExpanded ? 'fly-card-expanded' : ''}`}>
                  
                  {/* User Row */}
                  <div className="fly-team-row">
                    {/* Avatar */}
                    <div className={`fly-team-avatar ${isAdminUser ? 'fly-avatar-admin' : ''}`}>
                      <User size={20} />
                    </div>

                    {/* Name + email */}
                    <div className="fly-team-info">
                      <p className="fly-team-name">{u.displayName || u.name}</p>
                      <div className="fly-team-email-row">
                        <p className="fly-team-email">
                          <Mail size={12} /> {u.email}
                        </p>
                        <div className="fly-team-password" onClick={() => togglePasswordVisibility(u.id)}>
                          <Key size={10} />
                          <span>{showPasswords[u.id] ? (u.password || '---') : '••••••••'}</span>
                          {showPasswords[u.id] ? <EyeOff size={10} /> : <Eye size={10} />}
                        </div>
                      </div>
                    </div>

                    {/* Role pill */}
                    <span className={`fly-role-pill ${u.role}`}>
                      {u.role === 'admin' && <Shield size={10} />}
                      {u.role === 'almacenista' && <Warehouse size={10} />}
                      {u.role === 'user' && <User size={10} />}
                      {(u.role || 'user').toUpperCase()}
                    </span>

                    {/* Summary pill */}
                    <span className="fly-summary-pill">
                      {ss.text}
                    </span>

                    {/* Actions */}
                    <div className="fly-team-actions">
                      {!isAdminUser && (
                        <button
                          onClick={() => setExpandedUserId(isExpanded ? null : u.id)}
                          className={`fly-action-btn ${isExpanded ? 'fly-action-active' : ''}`}
                        >
                          <Lock size={12} /> Permisos {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                      )}
                      <button onClick={() => toggleRole(u)} title="Cambiar rol" className="fly-action-btn fly-action-gray">
                        <Shield size={13} />
                      </button>
                      <button onClick={() => { setChangingPasswordUser(u); setIsChangeModalOpen(true); }} title="Cambiar Contraseña" className="fly-action-btn fly-action-gray">
                        <Key size={13} />
                      </button>
                      <button onClick={() => handleDelete(u)} title="Eliminar" className="fly-action-btn fly-action-red">
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
                <input type="text" required className="w-full" placeholder="Mín 6 caracteres" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
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
            <p className="text-sm text-muted mb-6">Establece una nueva contraseña para <strong>{changingPasswordUser?.email}</strong>.</p>
            <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
              {!changingPasswordUser?.password && (
                <div className="f-group">
                  <label style={{ color: '#ea580c' }}>Contraseña Actual (Requerida por ser usuario antiguo)</label>
                  <div className="relative">
                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      required 
                      placeholder="Contraseña que usa actualmente" 
                      className="w-full" 
                      style={{ borderColor: '#fed7aa', background: '#fffcf9' }}
                      value={currentPasswordInput} 
                      onChange={e => setCurrentPasswordInput(e.target.value)} 
                    />
                  </div>
                </div>
              )}
              <div className="f-group">
                <label>Nueva Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    required 
                    placeholder="Mín 6 caracteres" 
                    className="w-full" 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)} 
                  />
                </div>
              </div>
              <div className="flex flex-col gap-3 mt-2">
                <div className="flex gap-4">
                  <button type="button" className="btn-secondary flex-1" onClick={() => { setIsChangeModalOpen(false); setCurrentPasswordInput(''); }}>Cancelar</button>
                  <button type="submit" className="btn-primary flex-1 flex justify-center items-center gap-2" disabled={isUpdatingPassword}>
                    {isUpdatingPassword ? <Loader2 className="animate-spin" size={18} /> : 'Actualizar'}
                  </button>
                </div>
                
                <button 
                  type="button" 
                  onClick={() => sendResetEmail(changingPasswordUser.email)}
                  style={{ background: 'none', border: 'none', color: '#0071e3', fontSize: 12, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  O enviar correo de restablecimiento
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
