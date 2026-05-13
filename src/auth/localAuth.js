// Local authentication system for dicrejart
// Simple in-memory auth with localStorage persistence

const AUTH_KEY = 'dicrejart_auth';
const USERS_KEY = 'dicrejart_users';

// Default admin user
const DEFAULT_USER = {
  id: 'admin',
  email: 'admin@dicrejart.com',
  name: 'Admin',
  role: 'admin',
  password: 'admin123' // In production, this should be hashed
};

// Initialize with default user if not exists
const initializeUsers = () => {
  const users = getUsers();
  if (users.length === 0) {
    localStorage.setItem(USERS_KEY, JSON.stringify([DEFAULT_USER]));
  }
};

const getUsers = () => {
  const users = localStorage.getItem(USERS_KEY);
  return users ? JSON.parse(users) : [];
};

const getCurrentUser = () => {
  const auth = localStorage.getItem(AUTH_KEY);
  return auth ? JSON.parse(auth) : null;
};

const login = async (email, password) => {
  initializeUsers();
  const users = getUsers();
  const user = users.find(u => u.email === email && u.password === password);
  
  if (user) {
    const { password: _, ...userWithoutPassword } = user;
    localStorage.setItem(AUTH_KEY, JSON.stringify(userWithoutPassword));
    return { success: true, user: userWithoutPassword };
  }
  
  return { success: false, error: 'Invalid credentials' };
};

const logout = () => {
  localStorage.removeItem(AUTH_KEY);
};

const register = async (userData) => {
  initializeUsers();
  const users = getUsers();
  
  if (users.find(u => u.email === userData.email)) {
    return { success: false, error: 'Email already exists' };
  }
  
  const newUser = {
    id: Date.now().toString(),
    ...userData,
    role: 'user'
  };
  
  users.push(newUser);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  
  const { password: _, ...userWithoutPassword } = newUser;
  return { success: true, user: userWithoutPassword };
};

export const localAuth = {
  login,
  logout,
  register,
  getCurrentUser,
  getUsers
};

export { DEFAULT_USER };
