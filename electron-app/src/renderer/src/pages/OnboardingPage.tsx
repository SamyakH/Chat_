import { useState, FormEvent } from 'react'
import { ShieldCheck, User, Lock, ChevronRight, ChevronLeft } from 'lucide-react'

export default function OnboardingPage({ onCreated }: { onCreated: () => void }) {
  const [step, setStep]             = useState<1 | 2>(1)
  const [displayName, setName]      = useState('')
  const [statusLine, setStatus]     = useState('')
  const [passcode, setPasscode]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (passcode !== confirm) { setError('Passcodes do not match'); return }
    if (passcode.length < 4)  { setError('Passcode must be at least 4 characters'); return }
    setLoading(true)
    try {
      await window.api.createIdentity({ displayName, statusLine, passcode })
      await window.api.initWorkspace()
      onCreated()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create identity')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen bg-gray-950 items-center justify-center">
      <div className="w-full max-w-sm px-8">
        <div className="flex flex-col items-center mb-10">
          <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/20 mb-4">
            <ShieldCheck className="w-10 h-10 text-teal-400" />
          </div>
          <h1 className="text-2xl font-semibold text-white">Create Your Identity</h1>
          <p className="text-gray-500 text-sm mt-1 text-center">
            Zero registration · No phone · No email
          </p>

          {/* Step indicators */}
          <div className="flex gap-2 mt-4">
            {[1, 2].map((s) => (
              <div
                key={s}
                className={`h-1 w-8 rounded-full transition-colors ${
                  s === step ? 'bg-teal-500' : 'bg-gray-700'
                }`}
              />
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                Display Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Cipher Ghost"
                  maxLength={36}
                  className="w-full bg-gray-900 border border-gray-800 focus:border-teal-500 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-600 outline-none transition-colors"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                Status Line <span className="text-gray-600 normal-case">(optional)</span>
              </label>
              <input
                type="text"
                value={statusLine}
                onChange={(e) => setStatus(e.target.value)}
                placeholder="Ready for a private exchange."
                maxLength={120}
                className="w-full bg-gray-900 border border-gray-800 focus:border-teal-500 rounded-xl px-4 py-3 text-white placeholder-gray-600 outline-none transition-colors"
              />
            </div>

            <button
              onClick={() => { if (displayName.trim().length >= 2) setStep(2) }}
              disabled={displayName.trim().length < 2}
              className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-500 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-xl py-3 font-medium transition-colors"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleCreate} className="space-y-4">
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
                  placeholder="Min 4 characters"
                  className="w-full bg-gray-900 border border-gray-800 focus:border-teal-500 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-600 outline-none transition-colors"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                Confirm Passcode
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter passcode"
                  className="w-full bg-gray-900 border border-gray-800 focus:border-teal-500 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-600 outline-none transition-colors"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-medium transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="submit"
                disabled={loading || !passcode || !confirm}
                className="flex-1 bg-teal-600 hover:bg-teal-500 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-xl py-3 font-medium transition-colors"
              >
                {loading ? 'Creating...' : 'Create Identity'}
              </button>
            </div>
          </form>
        )}

        <p className="text-center text-gray-700 text-xs mt-8">
          Your keys are generated locally and never leave this device.
        </p>
      </div>
    </div>
  )
}