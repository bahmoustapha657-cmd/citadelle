import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import UpdateBanner from './components/UpdateBanner.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { registerServiceWorker } from './sw-register.js'
import { initSentry } from './sentry.js'
import { languePrete } from './i18n'
import { VERSION_APP } from './version-app.js'
import { recevoirJetonAndroid } from './backend/application-android.js'

console.info(`[EduGest] version ${VERSION_APP.court}`, VERSION_APP.date || '')
initSentry()
recevoirJetonAndroid()

// Immédiat en français ; en anglais ou en arabe, le temps de lire les textes
// de la langue (gardés sur l'appareil après la première fois).
languePrete.then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
      <UpdateBanner />
    </StrictMode>,
  )
})

if (import.meta.env.PROD) {
  registerServiceWorker()
}
