import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import UpdateBanner from './components/UpdateBanner.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { registerServiceWorker } from './sw-register.js'
import { initSentry } from './sentry.js'
import './i18n'
import { VERSION_APP } from './version-app.js'

console.info(`[EduGest] version ${VERSION_APP.court}`, VERSION_APP.date || '')
initSentry()

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
