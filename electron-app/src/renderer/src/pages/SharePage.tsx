import type { ReactElement } from 'react'
import { useEffect, useState } from 'react'
import { Copy, RefreshCw, Share2 } from 'lucide-react'
import AppLayout from '../components/AppLayout'
import QRDisplay from '../components/QRDisplay'

interface Profile { displayName: string; publicId: string }

export default function SharePage(): ReactElement {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [qrData, setQrData] = useState('')
  const [copied, setCopied] = useState(false)

  async function load(): Promise<void> {
    const qr = await window.api.getQrCode()
    setQrData(qr.qrData)
    setProfile({ displayName: qr.displayName, publicId: qr.publicId })
  }

  useEffect(() => {
    void load()
  }, [])

  async function handleRegenerate(): Promise<void> {
    if (!confirm('Regenerate your public ID? Existing contacts will not be affected.')) return
    await window.api.regenerateIdentityId()
    await load()
  }

  function handleCopy(): void {
    if (!profile) return
    void navigator.clipboard.writeText(qrData)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <AppLayout>
      <div className="h-full flex flex-col">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-3">
          <Share2 className="w-5 h-5 text-gray-400" />
          <h1 className="text-lg font-semibold text-white">Share Identity</h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6">
          {profile && (
            <>
              <div className="text-center">
                <p className="text-gray-400 text-sm mb-1">{profile.displayName}</p>
                <p className="text-xs text-gray-600 font-mono">{profile.publicId}</p>
              </div>

              <QRDisplay data={qrData} size={220} />

              <div className="flex gap-3">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  {copied ? 'Copied!' : 'Copy ID'}
                </button>
                <button
                  onClick={handleRegenerate}
                  className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  <RefreshCw className="w-4 h-4" /> Regenerate
                </button>
              </div>

              <p className="text-gray-600 text-xs text-center max-w-xs">
                Ask your contact to scan this QR code, or share your Public ID manually.
                No personal data is embedded.
              </p>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  )
}