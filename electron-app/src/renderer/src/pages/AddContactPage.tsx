import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, CheckCircle, QrCode } from 'lucide-react'
import AppLayout from '../components/AppLayout'

export default function AddContactPage() {
  const navigate = useNavigate()
  const [displayName, setName] = useState('')
  const [contactPayload, setPayload] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleAdd() {
    setError('')
    if (!displayName.trim()) { setError('Display name is required'); return }
    if (!contactPayload.trim()) { setError('Contact payload is required'); return }

    let edPublicKey = contactPayload.trim()
    let xPublicKey = contactPayload.trim()

    try {
      const parsed = JSON.parse(contactPayload)
      if (parsed.edPublicKey && parsed.xPublicKey) {
        edPublicKey = parsed.edPublicKey
        xPublicKey = parsed.xPublicKey
      }
    } catch {
      // Fallback to raw string as public key placeholder
    }

    setLoading(true)
    try {
      await window.api.addContact({
        displayName: displayName.trim(),
        edPublicKey: edPublicKey.trim(),
        xPublicKey: xPublicKey.trim(),
        note: note.trim()
      })
      setSuccess(true)
      setTimeout(() => navigate('/contacts'), 1500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add contact')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout>
      <div className="h-full flex flex-col">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-3">
          <UserPlus className="w-5 h-5 text-gray-400" />
          <h1 className="text-lg font-semibold text-white">Add Contact</h1>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-md space-y-4">
            {success ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <CheckCircle className="w-12 h-12 text-teal-500" />
                <p className="text-white font-medium">Contact added successfully!</p>
                <p className="text-gray-500 text-sm">Redirecting to contacts...</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Contact's name"
                      maxLength={60}
                      className="w-full bg-gray-900 border border-gray-800 focus:border-teal-500 rounded-xl px-4 py-3 text-white placeholder-gray-600 outline-none transition-colors"
                      autoFocus
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/scan-contact')}
                    className="inline-flex items-center gap-2 rounded-xl bg-gray-800 hover:bg-gray-700 px-4 py-3 text-sm font-medium text-white transition-colors"
                  >
                    <QrCode className="w-4 h-4" /> Scan QR
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                    Contact Payload
                  </label>
                  <textarea
                    value={contactPayload}
                    onChange={(e) => setPayload(e.target.value)}
                    placeholder='Paste shared QR payload or public key string'
                    rows={4}
                    className="w-full bg-gray-900 border border-gray-800 focus:border-teal-500 rounded-2xl px-4 py-3 text-white placeholder-gray-600 outline-none transition-colors font-mono text-sm"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    Paste the secure contact payload from the Share page, or enter a raw public key string.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                    Note <span className="text-gray-600 normal-case">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="How you know this person"
                    maxLength={200}
                    className="w-full bg-gray-900 border border-gray-800 focus:border-teal-500 rounded-xl px-4 py-3 text-white placeholder-gray-600 outline-none transition-colors"
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  onClick={handleAdd}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-500 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-xl py-3 font-medium transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  {loading ? 'Adding...' : 'Add Contact'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}