import { useState, FormEvent } from 'react'
import { ShieldCheck, Lock } from 'lucide-react'

export default function LoginPage({ onUnlocked }: { onUnlocked: () => void }) {
  const [passcode, setPasscode] = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const state = await window.api.unlockIdentity({ passcode })
      if (state.isUnlocked) {
        try {
          await window.api.initWorkspace()
          onUnlocked()
        } catch (err: unknown) {
          await window.api.lockIdentity()
          throw err
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Incorrect passcode')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen bg-gray-950 items-center justify-center">
      <div className="w-full max-w-sm px-8">
        {/* Header */}
        <div className="flex flex-col items-center mb-10">
          <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/20 mb-4">
            <ShieldCheck className="w-10 h-10 text-teal-400" />
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Anon Chat</h1>
          <p className="text-gray-500 text-sm mt-1">Enter your passcode to unlock</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
              Passcode
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter passcode"
                className="w-full bg-gray-900 border border-gray-800 focus:border-teal-500 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-600 outline-none transition-colors"
                autoFocus
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !passcode}
            className="w-full bg-teal-600 hover:bg-teal-500 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-xl py-3 font-medium transition-colors"
          >
            {loading ? 'Unlocking...' : 'Unlock'}
          </button>
        </form>

        <p className="text-center text-gray-700 text-xs mt-8">
          All data stored locally. Nothing leaves your device.
        </p>
      </div>
    </div>
  )
}
