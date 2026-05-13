import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/fly-overrides.css'
import './styles/mobile-redesign.css'
import App from './App.jsx'
import { registerSW } from 'virtual:pwa-register'

// Registro del Service Worker para soporte offline y PWA
registerSW({ immediate: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
