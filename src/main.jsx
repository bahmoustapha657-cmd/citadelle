import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import UpdateBanner from './components/UpdateBanner.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { registerServiceWorker } from './sw-register.js'
import { initSentry } from './sentry.js'
import { isTransientFirestoreError } from './firestore-safe.js'
import './i18n'

initSentry()

// Filtre les FirebaseError permission-denied/unavailable transitoires qui
// remontent en unhandledrejection après une coupure réseau (token JWT expiré
// pendant la déconnexion — Firebase re-souscrit automatiquement au refresh).
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (isTransientFirestoreError(event.reason)) {
      event.preventDefault()
    }
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
    <UpdateBanner />
  </StrictMode>,
)

if (import.meta.env.PROD) {
  registerServiceWorker()
}
