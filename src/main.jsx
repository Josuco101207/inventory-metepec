import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/fly-overrides.css'
import './styles/mobile-redesign.css'
import App from './App.jsx'
import { registerSW } from 'virtual:pwa-register'

// ── Parche DOM: evitar crashes por extensiones del navegador o caché PWA ──
// Extensiones como Google Translate, Grammarly, etc. modifican el DOM real
// por fuera de React, causando errores de insertBefore/removeChild/appendChild.
// Este parche atrapa esos errores específicos para que React no crashee.
if (typeof Node !== 'undefined') {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function(child) {
    if (child.parentNode !== this) {
      console.warn('[DOM Patch] removeChild: node not a child, skipping.');
      return child;
    }
    return originalRemoveChild.apply(this, arguments);
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function(newNode, refNode) {
    if (refNode && refNode.parentNode !== this) {
      console.warn('[DOM Patch] insertBefore: ref node not a child, appending instead.');
      return originalInsertBefore.call(this, newNode, null);
    }
    return originalInsertBefore.apply(this, arguments);
  };
}

// Registro del Service Worker para soporte offline y PWA
registerSW({ immediate: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
