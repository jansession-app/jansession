import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { AuthGate } from './auth/AuthGate'
import { DataProvider } from './data/DataContext'
import { LanguageProvider } from './i18n/LanguageContext'
import './styles.css'

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
