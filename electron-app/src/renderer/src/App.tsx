import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import OnboardingPage from './pages/OnboardingPage'
import ChatPage from './pages/ChatPage'
import ContactsPage from './pages/ContactsPage'
import SettingsPage from './pages/SettingsPage'
import SharePage from './pages/SharePage'
import AddContactPage from './pages/AddContactPage'
import ScanContactPage from './pages/ScanContactPage'
import CallWindow from './components/CallWindow'
import { webrtc } from './core/webrtc-manager'

type AppState = 'loading' | 'no-identity' | 'locked' | 'unlocked'

type IncomingCallState = {
  contactId: string | null
  isIncoming: boolean
}

export default function App(): ReactElement {
  const [appState, setAppState] = useState<AppState>('loading')
  const [bootstrapError, setBootstrapError] = useState('')
  const [incomingCall, setIncomingCall] = useState<IncomingCallState | null>(null)
  const [showCallWindow, setShowCallWindow] = useState(false)

  useEffect(() => {
    window.api
      .getIdentityState()
      .then((s) => {
        if (!s.hasIdentity) setAppState('no-identity')
        else if (!s.isUnlocked) setAppState('locked')
        else setAppState('unlocked')
      })
      .catch((err: unknown) => {
        setBootstrapError(err instanceof Error ? err.message : 'Failed to initialize the app')
      })
  }, [])

  useEffect(() => {
    const onIncoming = (state: unknown): void => {
      if (!state || typeof state !== 'object') return
      const typedState = state as { contactId?: string | null; isIncoming: boolean }
      setIncomingCall({ contactId: typedState.contactId ?? null, isIncoming: typedState.isIncoming })
    }

    const onCallStarted = (): void => {
      setShowCallWindow(true)
    }

    const onCallEnded = (): void => {
      setIncomingCall(null)
      setShowCallWindow(false)
    }

    webrtc.on('incoming-call', onIncoming as (...args: unknown[]) => void)
    webrtc.on('call-started', onCallStarted as (...args: unknown[]) => void)
    webrtc.on('call-ended', onCallEnded as (...args: unknown[]) => void)

    return () => {
      webrtc.off('incoming-call', onIncoming as (...args: unknown[]) => void)
      webrtc.off('call-started', onCallStarted as (...args: unknown[]) => void)
      webrtc.off('call-ended', onCallEnded as (...args: unknown[]) => void)
    }
  }, [])

  async function handleAcceptIncomingCall(): Promise<void> {
    try {
      await webrtc.acceptCall()
      setShowCallWindow(true)
      setIncomingCall(null)
    } catch (err) {
      console.error('Failed to accept call', err)
      setIncomingCall(null)
    }
  }

  async function handleDeclineIncomingCall(): Promise<void> {
    try {
      const state = webrtc.getCallState()
      if (state.contactId) {
        await window.api.hangupCall(state.contactId)
      }
    } catch (err) {
      console.error('Failed to send hangup', err)
    } finally {
      webrtc.endCall()
      setIncomingCall(null)
      setShowCallWindow(false)
    }
  }

  if (appState === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        {bootstrapError ? (
          <div className="max-w-md rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            {bootstrapError}
          </div>
        ) : (
          <div className="text-xs text-gray-600 tracking-[0.3em] animate-pulse uppercase">
            Initializing secure environment...
          </div>
        )}
      </div>
    )
  }

  return (
    <HashRouter>
      <>
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

        {incomingCall && appState === 'unlocked' && (
          <IncomingCallOverlay
            contactId={incomingCall.contactId}
            onAccept={handleAcceptIncomingCall}
            onDecline={handleDeclineIncomingCall}
          />
        )}

        {showCallWindow && appState === 'unlocked' && (
          <CallWindow
            onClose={() => {
              webrtc.endCall()
              setShowCallWindow(false)
            }}
          />
        )}
      </>
    </HashRouter>
  )
}

function IncomingCallOverlay({
  contactId,
  onAccept,
  onDecline
}: {
  contactId: string | null
  onAccept: () => void
  onDecline: () => void
}): ReactElement {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
      <div className="mb-6 pointer-events-auto rounded-2xl bg-gray-900 border border-teal-700/60 shadow-xl px-4 py-3 flex items-center gap-4">
        <div className="w-9 h-9 rounded-full bg-teal-700 flex items-center justify-center">
          <span className="text-xs font-semibold text-white">Call</span>
        </div>
        <div>
          <p className="text-sm text-white font-medium">Incoming call</p>
          <p className="text-xs text-gray-400">
            {contactId ? `From ${contactId}` : 'Unknown contact'}
          </p>
        </div>
        <div className="flex gap-2 ml-4">
          <button
            type="button"
            onClick={onDecline}
            className="px-3 py-1.5 rounded-full bg-red-600 hover:bg-red-500 text-xs font-medium text-white"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="px-3 py-1.5 rounded-full bg-teal-600 hover:bg-teal-500 text-xs font-medium text-white"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
