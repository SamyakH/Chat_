import { useEffect, useState } from 'react'
import { Settings, LogOut, Flame, RefreshCw, Save } from 'lucide-react'
import AppLayout from '../components/AppLayout'

interface Profile { displayName: string; statusLine: string; publicId: string }

export default function SettingsPage({ onLocked }: { onLocked: () => void }) {
  const [profile, setProfile]   = useState<Profile | null>(null)
  const [name, setName]         = useState('')
  const [status, setStatus]     = useState('')
  const [wipeText, setWipeText] = useState('')
  const [saving, setSaving]     = useState(false)
  const [wiping, setWiping]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    window.api
      .getWorkspaceSummary()
      .then((s) => {
        setProfile(s.profile)
        setName(s.profile.displayName)
        setStatus(s.profile.statusLine)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load settings')
      })
  }, [])

  async function handleSave() {
    setSaving(true); setSaved(false); setError('')
    try {
      await window.api.updateIdentityProfile({ displayName: name, statusLine: status })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleLock() {
    await window.api.lockIdentity()
    onLocked()
  }

  async function handleWipe() {
    if (wipeText !== 'DESTROY') return
    setWiping(true)
    try {
      await window.api.executeWipe({ confirmation: 'DESTROY' })
      window.location.reload()
    } finally {
      setWiping(false)
    }
  }

  return (
    <AppLayout>
      <div className="h-full flex flex-col">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-3">
          <Settings className="w-5 h-5 text-gray-400" />
          <h1 className="text-lg font-semibold text-white">Settings</h1>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8 max-w-lg">
          {/* Profile */}
          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Profile</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Display Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={36}
                  className="w-full bg-gray-900 border border-gray-800 focus:border-teal-500 rounded-xl px-4 py-2.5 text-white outline-none text-sm transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Status Line</label>
                <input
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  maxLength={120}
                  className="w-full bg-gray-900 border border-gray-800 focus:border-teal-500 rounded-xl px-4 py-2.5 text-white outline-none text-sm transition-colors"
                />
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 disabled:bg-gray-800 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                <Save className="w-4 h-4" />
                {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </section>

          {/* Identity info */}
          {profile && (
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Identity</h2>
              <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Public ID</span>
                  <span className="text-gray-300 font-mono text-xs">{profile.publicId}</span>
                </div>
                <button
                  onClick={async () => { await window.api.regenerateIdentityId(); window.location.reload() }}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-teal-400 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" /> Regenerate Public ID
                </button>
              </div>
            </section>
          )}

          {/* Session */}
          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Session</h2>
            <button
              onClick={handleLock}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              <LogOut className="w-4 h-4" /> Lock Application
            </button>
          </section>

          {/* Emergency wipe */}
          <section>
            <h2 className="text-xs font-semibold text-red-900 uppercase tracking-wider mb-4">
              Danger Zone
            </h2>
            <div className="bg-red-950/20 border border-red-900/40 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Flame className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-400">Burn Account</p>
                  <p className="text-xs text-red-900/80 mt-1">
                    Permanently deletes all local keys, messages, and contacts from this device.
                    This action is <strong className="text-red-500">irreversible</strong>.
                  </p>
                </div>
              </div>
              <input
                type="text"
                value={wipeText}
                onChange={(e) => setWipeText(e.target.value)}
                placeholder='Type "DESTROY" to confirm'
                className="w-full bg-gray-950 border border-red-900/40 focus:border-red-700 rounded-lg px-3 py-2 text-red-300 placeholder-red-900/60 outline-none text-sm font-mono transition-colors"
              />
              <button
                onClick={handleWipe}
                disabled={wipeText !== 'DESTROY' || wiping}
                className="w-full bg-red-900/40 hover:bg-red-800/60 disabled:opacity-30 disabled:cursor-not-allowed text-red-400 border border-red-900/60 rounded-lg py-2.5 text-sm font-medium transition-colors"
              >
                {wiping ? 'Wiping...' : 'Burn Account — Destroy All Data'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  )
}
