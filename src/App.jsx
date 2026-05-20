import React, { Suspense, lazy, Component } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import MobileTabBar from './components/MobileTabBar';
import MobileHeader from './components/MobileHeader';
import Dashboard from './components/Dashboard';
import FlyPattern from './components/FlyPattern';
import useIsMobile from './hooks/useIsMobile';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    // Ignore browser extension / cascade preview DOM manipulation errors
    const msg = error?.message || '';
    if (msg.includes('removeChild') || msg.includes('insertBefore') || msg.includes('appendChild')) {
      return null; // Don't update state — let React retry
    }
    return { hasError: true, error };
  }
  componentDidCatch(error) {
    const msg = error?.message || '';
    if (msg.includes('removeChild') || msg.includes('insertBefore') || msg.includes('appendChild')) {
      return; // Silently ignore extension errors
    }
    console.error('App error:', error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '1rem', background: '#252220', color: '#fff' }}>
          <h2 style={{ fontWeight: 900 }}>Algo salió mal</h2>
          <p style={{ opacity: 0.6 }}>{this.state.error?.message}</p>
          <button onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
            style={{ padding: '0.75rem 2rem', background: '#8DC63F', color: '#252220', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer' }}>
            RECARGAR
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const InventoryView = lazy(() => import('./views/InventoryView'));
const SettingsView = lazy(() => import('./views/SettingsView'));
const ProfileView = lazy(() => import('./views/ProfileView'));
const UserManagementView = lazy(() => import('./views/UserManagementView'));
const LoginView = lazy(() => import('./views/LoginView'));
const ParquesView = lazy(() => import('./views/ParquesView'));
const TransactionsView = lazy(() => import('./views/TransactionsView'));
const DatabaseAdminView = lazy(() => import('./views/DatabaseAdminView'));
const AnalyticsView = lazy(() => import('./views/AnalyticsView'));
const ToolsView = lazy(() => import('./views/ToolsView'));
const InvoicesView = lazy(() => import('./views/InvoicesView'));
const InvoiceAIView = lazy(() => import('./views/InvoiceAIView'));
const ManualEntryView = lazy(() => import('./views/ManualEntryView'));

import { InventoryProvider, useInventory } from './context/InventoryContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Toaster, toast } from 'sonner';
import { Loader2, Lock, AlertTriangle, RefreshCw } from 'lucide-react';
import { useState as useStateR } from 'react';
import { CategoriesProvider, useCategories } from './context/CategoriesContext';

const RootApp = () => {
  const { user, loading, userData, isAdmin } = useAuth();
  const { categories, loading: catsLoading } = useCategories();
  const { loadError, loading: invLoading, syncInventory } = useInventory();
  const [sidebarOpen, setSidebarOpen] = useStateR(false);
  const { isMobile } = useIsMobile();

  if (loading || catsLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        flexDirection: 'column',
        gap: '1rem',
        backgroundColor: 'hsl(var(--bg-main))',
        color: 'hsl(var(--text-main))',
        transition: 'background-color 0.3s'
      }}>
        <Loader2 className="animate-spin" style={{ color: 'hsl(var(--primary))' }} size={60} />
        <p style={{ fontWeight: '800', letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '0.75rem', opacity: 0.6 }}>
          Validando Sesión...
        </p>
      </div>
    );
  }

  const hasViewAccess = (viewId) => {
    if (isAdmin) return true;
    const defaultAllowed = ['dashboard', 'profile'];
    if (defaultAllowed.includes(viewId)) return true;
    if (!userData) return false;
    // Retrocompatibilidad: Si no tiene el campo (usuario antiguo), tiene acceso
    if (!userData.allowedViews) return true;
    return userData.allowedViews.includes(viewId);
  };

  const ViewProtectedRoute = ({ viewId, children }) => {
    if (loading) return null;
    if (hasViewAccess(viewId)) return children;
    
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-fade-in">
        <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mb-6">
          <Lock size={40} />
        </div>
        <h2 className="text-2xl font-black mb-2">Acceso Restringido</h2>
        <p className="text-muted max-w-xs mx-auto mb-8">
          No tienes permisos para ver esta sección. Contacta a Jonathan para solicitar acceso.
        </p>
        <button className="btn-apple-primary px-8" onClick={() => window.location.href = '/'}>
          Volver al Inicio
        </button>
      </div>
    );
  };

  if (!user) {
    return <LoginView />;
  }

  return (
    <Router>
      <FlyPattern fixed opacity={0.04} />
      <div className="app-container" style={{ position: 'relative', zIndex: 1 }}>
        {/* Sidebar handles its own mobile visibility */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className={`main-content ${isMobile ? 'main-content--mobile' : ''}`}>
          {/* Mobile: compact sticky header — Desktop: destroyed */}
          {isMobile && <MobileHeader />}

          {loadError && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              background: 'rgba(255, 59, 48, 0.12)', border: '1px solid rgba(255, 59, 48, 0.3)',
              borderRadius: '12px', padding: '12px 16px', margin: '12px 16px 0',
              color: '#ff6b6b', fontSize: '0.8rem', fontWeight: 600
            }}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>Error al conectar con la base de datos: {loadError}</span>
              <button onClick={syncInventory} style={{
                background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', padding: 4
              }}><RefreshCw size={15} /></button>
            </div>
          )}
          <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%' }}><Loader2 className="animate-spin" style={{ color: 'hsl(var(--primary))' }} size={40} /></div>}>
            <Routes>
              <Route path="/" element={<ViewProtectedRoute viewId="dashboard"><Dashboard /></ViewProtectedRoute>} />
              {categories.map(cat => (
                <Route
                  key={cat.id}
                  path={cat.route}
                  element={
                    <ViewProtectedRoute viewId={cat.viewId}>
                      <InventoryView categoryTitle={cat.title} />
                    </ViewProtectedRoute>
                  }
                />
              ))}
              <Route path="/transactions" element={<ViewProtectedRoute viewId="transactions"><TransactionsView /></ViewProtectedRoute>} />
              <Route path="/parques" element={<ViewProtectedRoute viewId="parques"><ParquesView /></ViewProtectedRoute>} />
              <Route path="/analytics" element={isAdmin ? <AnalyticsView /> : <Navigate to="/" />} />
              <Route path="/tools" element={isAdmin ? <ToolsView /> : <Navigate to="/" />} />
              <Route path="/invoices" element={isAdmin ? <InvoicesView /> : <Navigate to="/" />} />
              <Route path="/invoice-ai" element={<InvoiceAIView />} />
              <Route path="/manual-entry" element={<ManualEntryView />} />
              <Route path="/settings" element={isAdmin ? <SettingsView /> : <Navigate to="/" />} />
              <Route path="/profile" element={<ProfileView />} />
              <Route path="/users" element={isAdmin ? <UserManagementView /> : <Navigate to="/" />} />
              <Route path="/database" element={isAdmin ? <DatabaseAdminView /> : <Navigate to="/" />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>

        {/* Mobile: bottom tab bar — Desktop: destroyed */}
        {isMobile && <MobileTabBar onMorePress={() => setSidebarOpen(true)} />}
      </div>
      <Toaster position={isMobile ? 'top-center' : 'top-right'} richColors closeButton />
    </Router>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <CategoriesProvider>
          <ThemeProvider>
            <InventoryProvider>
              <RootApp />
            </InventoryProvider>
          </ThemeProvider>
        </CategoriesProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
