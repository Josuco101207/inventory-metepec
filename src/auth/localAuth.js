/**
 * DEPRECATED — Este módulo ya no es el sistema de autenticación principal.
 * La autenticación se maneja exclusivamente a través de Supabase Auth.
 * Se conserva únicamente para compatibilidad con imports existentes
 * hasta que sean removidos. No contiene lógica activa ni credenciales.
 */

const USERS_KEY = 'dicrejart_users';

const getUsers = () => {
  try {
    const users = localStorage.getItem(USERS_KEY);
    return users ? JSON.parse(users) : [];
  } catch {
    return [];
  }
};

const register = async (userData) => {
  const users = getUsers();
  if (users.find(u => u.email === userData.email)) {
    return { success: false, error: 'Email already exists' };
  }
  const newUser = { id: Date.now().toString(), role: 'user', ...userData };
  const { password: _, ...userWithoutPassword } = newUser;
  users.push(newUser);
  try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); } catch { /* ignore */ }
  return { success: true, user: userWithoutPassword };
};

export const localAuth = {
  login: async () => ({ success: false, error: 'Use Supabase Auth' }),
  logout: () => {},
  register,
  getCurrentUser: () => null,
  getUsers,
};
