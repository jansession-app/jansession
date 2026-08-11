import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { AuthGate } from './auth/AuthGate'
import { DataProvider } from './data/DataContext'
import { LanguageProvider } from './i18n/LanguageContext'
import { registerPushServiceWorker } from './push/webPush'
import './styles.css'

void registerPushServiceWorker().catch((error: unknown) => {
  console.error('[JanSession] Service Worker registration failed', error)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <AuthGate>
        <HashRouter>
          <DataProvider>
            <App />
          </DataProvider>
        </HashRouter>
      </AuthGate>
    </LanguageProvider>
  </StrictMode>,
)
