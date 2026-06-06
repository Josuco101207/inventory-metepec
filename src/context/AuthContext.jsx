import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, supabaseRestQuery } from '../lib/supabase';
import { toast } from 'sonner';

const AuthContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

// Fetch user profile using direct REST (avoids gotrue internal lock issues)
const fetchProfile = async (userId) => {
  try {
    // First try REST API directly (works even when gotrue client is locked)
    const profile = await supabaseRestQuery('profiles', {
      eq: { column: 'id', value: userId },
      single: true,
    });
    return profile;
  } catch (restErr) {
    console.warn('[fetchProfile] REST fallback failed, trying SDK:', restErr.message);
    // Fallback to SDK
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      return data;
    } catch (sdkErr) {
      console.error('[fetchProfile] SDK also failed:', sdkErr.message);
      return null;
    }
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

  // Load user profile with timeout protection
  const loadProfile = useCallback(async (sessionUser) => {
    let timer;
    try {
      const profilePromise = fetchProfile(sessionUser.id);
      const timeoutPromise = new Promise((_, reject) =>
        timer = setTimeout(() => reject(new Error('Profile fetch timeout')), 6000)
      );

      const profile = await Promise.race([profilePromise, timeoutPromise]);
      setUserData(buildUserData(sessionUser, profile));
    } catch (err) {
      console.error('Profile fetch error (using fallback data):', err.message);
      setUserData(buildUserData(sessionUser, null));
    } finally {
      if (timer) clearTimeout(timer);
    }
  }, [buildUserData]);

  // Listen to Supabase auth state changes
  useEffect(() => {
    let subscription = null;
    let loadingTimeout = null;
    let initialDone = false;

    const finishLoading = () => {
      if (!initialDone) {
        initialDone = true;
        if (loadingTimeout) clearTimeout(loadingTimeout);
        setLoading(false);
      }
    };

    // Safety timeout — never stay loading more than 6s
    loadingTimeout = setTimeout(() => {
      console.warn('Auth loading timeout — forcing load');
      finishLoading();
    }, 6000);

    // Listen for auth state changes (includes INITIAL_SESSION on mount)
    try {
      const { data } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && session?.user) {
            setUser(session.user);
            await loadProfile(session.user);
            finishLoading();
          } else if (event === 'SIGNED_OUT') {
            setUser(null);
            setUserData(null);
            finishLoading();
          } else if (event === 'INITIAL_SESSION' && !session) {
            // No session on startup
            finishLoading();
          }
        }
      );
      subscription = data?.subscription;
    } catch (err) {
      console.error('Auth subscription error:', err);
      finishLoading();
    }

    return () => {
      if (subscription) subscription.unsubscribe();
      if (loadingTimeout) clearTimeout(loadingTimeout);
    };
  }, [loadProfile]);

  // Realtime: reload profile when admin changes permissions
  useEffect(() => {
    if (!user) return;

    const profileChannel = supabase
      .channel(`profile-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        async (payload) => {
          const updated = payload.new;
          setUserData(prev => ({
            ...prev,
            role: updated.role || prev?.role || 'user',
            allowedViews: updated.allowed_views || [],
            allowedCategories: updated.allowed_categories || [],
            editableCategories: updated.editable_categories || [],
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
    };
  }, [user]);

  const login = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { success: false, error: error.message };
    }
    if (data.user && data.session) {
      setUser(data.user);
      // Wait for profile with short timeout — ensures userData is ready
      const profilePromise = loadProfile(data.user);
      const timeoutPromise = new Promise(r => setTimeout(r, 1500));
      await Promise.race([profilePromise, timeoutPromise]);
      setLoading(false);
    }
    return { success: true, user: data.user, session: data.session };
  }, [loadProfile]);
  
  const signup = useCallback(async (email, password, name) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } }
    });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, user: data.user };
  }, []);

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Logout error:', err);
    }
    setUser(null);
    setUserData(null);
  }, []);

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
  }, [user, logout]);

  const { isAdmin, isStaff } = useMemo(() => {
    const admin = userData?.role === 'admin';
    const staff = admin || userData?.role === 'almacenista' || userData?.role === 'supervisor';
    return { isAdmin: admin, isStaff: staff };
  }, [userData]);

  // Returns true if the current user can add items to the given category
  const canAddTo = useCallback((category) => {
    if (isAdmin) return true;
    const allowed = userData?.allowedCategories;
    if (!allowed || !Array.isArray(allowed) || allowed.length === 0) return false;
    return allowed.includes(category);
  }, [isAdmin, userData?.allowedCategories]);

  // Returns true if the current user can edit items in the given category
  const canEditIn = useCallback((category) => {
    if (isAdmin) return true;
    const editable = userData?.editableCategories;
    if (!editable || !Array.isArray(editable) || editable.length === 0) return false;
    return editable.includes(category);
  }, [isAdmin, userData?.editableCategories]);

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
  }), [user, userData, loading, isAdmin, isStaff, canAddTo, canEditIn, login, signup, logout]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
