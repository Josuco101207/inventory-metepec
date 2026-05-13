import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

// Fetch user profile using direct fetch with timeout
const fetchProfile = async (userId, accessToken) => {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=*`;
  const controller = new AbortController();
  // Shorter timeout on mobile (3s) vs desktop (5s)
  const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
  const timeout = setTimeout(() => controller.abort(), isTouch ? 3000 : 5000);
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.pgrst.object+json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.error('[fetchProfile] HTTP error:', res.status);
      return null;
    }
    return await res.json();
  } catch (err) {
    clearTimeout(timeout);
    console.error('[fetchProfile] Error:', err.message);
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Helper to build userData from session + profile
  const buildUserData = useCallback((sessionUser, profile) => {
    if (profile) {
      return {
        id: sessionUser.id,
        email: sessionUser.email,
        name: profile.name || '',
        role: profile.role || 'user',
        allowedViews: profile.allowed_views || [],
        allowedCategories: profile.allowed_categories || [],
        editableCategories: profile.editable_categories || [],
      };
    }
    return {
      id: sessionUser.id,
      email: sessionUser.email,
      name: sessionUser.user_metadata?.name || '',
      role: 'user',
    };
  }, []);

  // Load user profile with short timeout
  const loadProfile = useCallback(async (sessionUser, accessToken) => {
    try {
      const profile = await fetchProfile(sessionUser.id, accessToken);
      setUserData(buildUserData(sessionUser, profile));
    } catch (err) {
      console.error('Profile fetch error:', err);
      setUserData(buildUserData(sessionUser, null));
    }
  }, [buildUserData]);

  // Listen to Supabase auth state changes
  useEffect(() => {
    let subscription = null;
    let loadingTimeout = null;
    let initialDone = false;

    // Safety timeout — never stay loading more than 5s on mobile
    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    const timeoutMs = isTouch ? 5000 : 8000;
    loadingTimeout = setTimeout(() => {
      if (!initialDone) {
        console.warn('Auth loading timeout — forcing load');
        initialDone = true;
        setLoading(false);
      }
    }, timeoutMs);

    // Init: use getSession which properly sets internal auth headers
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          await loadProfile(session.user, session.access_token);
        }
      } catch (err) {
        console.error('Auth init error:', err);
      } finally {
        if (!initialDone) {
          initialDone = true;
          clearTimeout(loadingTimeout);
          setLoading(false);
        }
      }
    };

    initAuth();

    // Listen for subsequent changes (login, logout)
    try {
      const { data } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (event === 'SIGNED_IN' && session?.user) {
            setUser(session.user);
            await loadProfile(session.user, session.access_token);
          } else if (event === 'SIGNED_OUT') {
            setUser(null);
            setUserData(null);
          }
        }
      );
      subscription = data?.subscription;
    } catch (err) {
      console.error('Auth subscription error:', err);
      initialDone = true;
      setLoading(false);
    }

    return () => {
      if (subscription) subscription.unsubscribe();
      if (loadingTimeout) clearTimeout(loadingTimeout);
    };
  }, [loadProfile]);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { success: false, error: error.message };
    }
    // Immediately set user and load profile for instant UI response
    if (data.user && data.session) {
      setUser(data.user);
      // Fire and forget profile load — don't block UI
      loadProfile(data.user, data.session.access_token);
    }
    return { success: true, user: data.user, session: data.session };
  };
  
  const signup = async (email, password, name) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } }
    });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, user: data.user };
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Logout error:', err);
    }
    setUser(null);
    setUserData(null);
  };

  // Temporizador de inactividad para seguridad
  useEffect(() => {
    if (!user) return;

    let inactivityTimer;
    let backgroundTimer;
    let lastActivity = Date.now();
    const INACTIVITY_MS = 5 * 60 * 1000; // 5 minutos
    const BACKGROUND_MS = 10 * 60 * 1000; // 10 minutos en background

    const handleInactivity = () => {
      logout();
      toast.info("Sesión cerrada por inactividad (5 min)", {
        description: "Vuelve a iniciar sesión para continuar.",
        duration: 8000
      });
    };

    const resetTimer = () => {
      const now = Date.now();
      // Throttle: ignorar si la última actividad fue hace menos de 2 segundos
      if (now - lastActivity < 2000) return;
      lastActivity = now;
      
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(handleInactivity, INACTIVITY_MS);
    };

    // visibilitychange: solo cerrar sesión si estuvo en background > 10 min
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        backgroundTimer = setTimeout(() => {
          logout();
          toast.info("Sesión cerrada por seguridad", {
            description: "La app estuvo inactiva en segundo plano.",
            duration: 8000
          });
        }, BACKGROUND_MS);
      } else {
        // Volvió al primer plano antes del timeout — cancelar cierre
        if (backgroundTimer) {
          clearTimeout(backgroundTimer);
          backgroundTimer = null;
        }
        resetTimer();
      }
    };

    // Usar un solo listener pasivo con throttle en lugar de 6 listeners activos
    const events = ['mousedown', 'keypress', 'scroll', 'touchstart'];
    
    events.forEach(event => {
      window.addEventListener(event, resetTimer, { passive: true });
    });
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Iniciar el temporizador
    resetTimer();

    return () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      if (backgroundTimer) clearTimeout(backgroundTimer);
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  const isAdmin = userData?.role === 'admin';
  const isStaff = userData?.role === 'admin' || userData?.role === 'almacenista';

  // Returns true if the current user can add items to the given category
  const canAddTo = useCallback((category) => {
    if (isAdmin) return true;
    if (!isStaff) return false;
    const allowed = userData?.allowedCategories;
    if (!allowed || !Array.isArray(allowed)) return false;
    return allowed.includes(category);
  }, [isAdmin, isStaff, userData?.allowedCategories]);

  // Returns true if the current user can edit items in the given category
  const canEditIn = useCallback((category) => {
    if (isAdmin) return true;
    if (!isStaff) return false;
    const editable = userData?.editableCategories;
    if (!editable || !Array.isArray(editable)) return false;
    return editable.includes(category);
  }, [isAdmin, isStaff, userData?.editableCategories]);

  const contextValue = useMemo(() => ({
    user, 
    userData, 
    loading, 
    login, 
    signup, 
    logout,
    isAdmin,
    isStaff,
    canAddTo,
    canEditIn
  }), [user, userData, loading, isAdmin, isStaff, canAddTo, canEditIn]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
