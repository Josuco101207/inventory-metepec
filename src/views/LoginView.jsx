import React, { useState } from 'react';
import { Mail, Lock, ArrowRight, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import FlyPattern from '../components/FlyPattern';
import FlyLogo from '../components/FlyLogo';
import './LoginView.css';

const LoginView = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setIsAuthLoading(true);
    try {
      const result = await login(email, password);
      if (result?.success) {
        // Non-blocking toast — UI transitions immediately
        setTimeout(() => toast.success('ACCESO CONCEDIDO'), 100);
      } else {
        const message = result?.error?.includes('Invalid login') 
          ? 'Contraseña incorrecta' 
          : (result?.error || 'Credenciales incorrectas');
        setErrorMsg(message);
        toast.error(message);
        setIsAuthLoading(false);
      }
    } catch (error) {
      console.error(error);
      const message = 'Error al iniciar sesión';
      setErrorMsg(message);
      toast.error(message);
      setIsAuthLoading(false);
    }
  };

  const handleInputChange = (setter) => (e) => {
    setter(e.target.value);
    if (errorMsg) setErrorMsg('');
  };

  return (
    <div className="fly-login-screen">
      <FlyPattern fixed opacity={0.06} />

      {/* Decorative geometric shapes (Bauhaus Pag. 17-19) */}
      <div className="fly-login-shape fly-login-shape-1" />
      <div className="fly-login-shape fly-login-shape-2" />
      <div className="fly-login-shape fly-login-shape-3" />

      <div className="fly-login-container">
        {/* ═══ LADO IZQUIERDO: BRANDING ═══ */}
        <aside className="fly-login-brand">
          <div className="fly-login-brand-top">
            <FlyLogo size={180} glow circular />
          </div>

          <div className="fly-login-brand-content">
            <span className="fly-login-tag">● SISTEMA INTERNO</span>
            <h1 className="fly-login-mega-title">
              <span className="fly-login-mega-accent">CONTROL</span>
              <span>DE INVENTARIO</span>
            </h1>
            <p className="fly-login-pitch">
              GESTION DE ACTIVOS, HERRAMIENTAS<br />
              Y SUMINISTROS DEL PARK.
            </p>

            <div className="fly-login-features">
              <div className="fly-login-feature">
                <span className="fly-login-feature-num">01</span>
                <span className="fly-login-feature-text">REGISTRO &amp; SEGUIMIENTO</span>
              </div>
              <div className="fly-login-feature">
                <span className="fly-login-feature-num">02</span>
                <span className="fly-login-feature-text">CONTROL DE STOCK CRITICO</span>
              </div>
              <div className="fly-login-feature">
                <span className="fly-login-feature-num">03</span>
                <span className="fly-login-feature-text">ANALITICA DE MOVIMIENTOS</span>
              </div>
            </div>
          </div>
        </aside>

        {/* ═══ LADO DERECHO: FORMULARIO ═══ */}
        <main className="fly-login-card">
         <div className="fly-login-card-body">
          <header className="fly-login-card-header">
            <span className="fly-login-step">PASO 01 / 01</span>
            <h2 className="fly-login-card-title">IDENTIFICACION</h2>
            <p className="fly-login-card-sub">
              Ingresa tus credenciales para entrar al sistema.
            </p>
          </header>

          <form onSubmit={handleSubmit} className="fly-login-form">
            <div className="fly-field">
              <label htmlFor="email">CORREO ELECTRONICO</label>
              <div className="fly-field-wrap">
                <Mail size={16} className="fly-field-icon" />
                <input
                  id="email"
                  type="email"
                  placeholder="tu@correo.com"
                  required
                  value={email}
                  onChange={handleInputChange(setEmail)}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className={`fly-field ${errorMsg ? 'fly-field-shake' : ''}`}>
              <label htmlFor="password">CONTRASENA</label>
              <div className="fly-field-wrap">
                <Lock size={16} className="fly-field-icon" />
                <input
                  id="password"
                  ref={(el) => { if (errorMsg && el) el.focus(); }}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={handleInputChange(setPassword)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="fly-field-action"
                  onClick={() => setShowPassword(s => !s)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="fly-login-error">
                <AlertCircle size={14} />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              className="fly-login-submit"
              disabled={isAuthLoading}
            >
              {isAuthLoading ? (
                <Loader2 className="fly-spin" size={18} />
              ) : (
                <>
                  ENTRAR AL SISTEMA <ArrowRight size={16} strokeWidth={3} />
                </>
              )}
            </button>
          </form>
         </div>

          <footer className="fly-login-footer">
            <div className="fly-login-footer-line" />
            <p className="fly-login-footer-text">
              ¿Sin cuenta? Contacta al <strong>Administrador del Almacen</strong>.
            </p>
            <p className="fly-login-version">v1.0 · FLY EXTREME OS</p>
          </footer>
        </main>
      </div>
    </div>
  );
};

export default LoginView;
