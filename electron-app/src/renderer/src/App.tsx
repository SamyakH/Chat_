import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import OnboardingPage from './pages/OnboardingPage'
import ChatPage from './pages/ChatPage'
import ContactsPage from './pages/ContactsPage'
import SettingsPage from './pages/SettingsPage'
import SharePage from './pages/SharePage'
import AddContactPage from './pages/AddContactPage'
import ScanContactPage from './pages/ScanContactPage'

type AppState = 'loading' | 'no-identity' | 'locked' | 'unlocked'

export default function App() {
  const [appState, setAppState] = useState<AppState>('loading')

  useEffect(() => {
    window.api.getIdentityState().then((s) => {
      if (!s.hasIdentity) setAppState('no-identity')
      else if (!s.isUnlocked) setAppState('locked')
      else setAppState('unlocked')
    })
  }, [])

  if (appState === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="text-xs text-gray-600 tracking-[0.3em] animate-pulse uppercase">
          Initializing secure environment...
        </div>
      </div>
    )
  }

  return (
    <HashRouter>
      <Routes>
        {appState === 'no-identity' && (
          <>
            <Route
              path="/onboarding"
              element={<OnboardingPage onCreated={() => setAppState('unlocked')} />}
            />
            <Route path="*" element={<Navigate to="/onboarding" replace />} />
          </>
        )}

        {appState === 'locked' && (
          <>
            <Route
              path="/login"
              element={<LoginPage onUnlocked={() => setAppState('unlocked')} />}
            />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        )}

        {appState === 'unlocked' && (
          <>
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/chat/:contactId" element={<ChatPage />} />
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="/add-contact" element={<AddContactPage />} />
            <Route path="/scan-contact" element={<ScanContactPage />} />
            <Route path="/share" element={<SharePage />} />
            <Route
              path="/settings"
              element={<SettingsPage onLocked={() => setAppState('locked')} />}
            />
            <Route path="*" element={<Navigate to="/chat" replace />} />
          </>
        )}
      </Routes>
    </HashRouter>
  )
}