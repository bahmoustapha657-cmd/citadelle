import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import UpdateBanner from './components/UpdateBanner.jsx'
import { registerServiceWorker } from './sw-register.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <UpdateBanner />
  </StrictMode>,
)

registerServiceWorker()
