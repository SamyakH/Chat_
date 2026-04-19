import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QrCode, Camera, AlertTriangle } from 'lucide-react'
import AppLayout from '../components/AppLayout'
import { Html5Qrcode } from 'html5-qrcode'

export default function ScanContactPage(): React.ReactNode {
  const navigate = useNavigate()
  const [status, setStatus] = useState('Point your camera at a valid contact QR code')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const handledScanRef = useRef(false)

  useEffect(() => {
    const elementId = 'qr-reader'
    const html5QrCode = new Html5Qrcode(elementId)
    let scannerRunning = false
    const stopScanner = async (): Promise<void> => {
      if (!scannerRunning) return
      await html5QrCode.stop()
      scannerRunning = false
    }

    const config = {
      fps: 10,
      qrbox: { width: 280, height: 280 },
      aspectRatio: 1.0
    }

    html5QrCode
      .start(
        { facingMode: 'environment' },
        config,
        (decodedText: string) => {
          if (handledScanRef.current) return
          handledScanRef.current = true
          setError('')
          setStatus('QR code detected — importing contact...')
          void window.api
            .addContactFromQr({ qrData: decodedText })
            .then(() => {
              setSuccess(true)
              setStatus('Contact added successfully!')
              void stopScanner().catch(() => {})
            })
            .then(() => {
              setTimeout(() => navigate('/contacts'), 1200)
            })
            .catch((err: unknown) => {
              handledScanRef.current = false
              setError(err instanceof Error ? err.message : 'Failed to import contact from QR')
              setStatus('Point your camera at a valid contact QR code')
            })
        },
        () => {
          // ignore occasional scan failures
        }
      )
      .then(() => {
        scannerRunning = true
      })
      .catch((err) => {
        setError(
          'Unable to start camera scanner: ' + (err instanceof Error ? err.message : String(err))
        )
      })

    return () => {
      if (scannerRunning) {
        void stopScanner().catch(() => {})
      }
    }
  }, [navigate])

  return (
    <AppLayout>
      <div className="h-full flex flex-col">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-3">
          <QrCode className="w-5 h-5 text-gray-400" />
          <h1 className="text-lg font-semibold text-white">Scan Contact</h1>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 content-auto">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 text-center">
              <Camera className="mx-auto mb-4 w-10 h-10 text-teal-400" />
              <p className="text-sm text-gray-300 mb-2">
                Use your webcam to scan a secure contact QR code.
              </p>
              <div
                id="qr-reader"
                className="mx-auto w-full max-w-md rounded-3xl overflow-hidden bg-black"
              />
            </div>

            {error && (
              <div className="rounded-3xl border border-red-900/60 bg-red-950/20 p-4 text-sm text-red-300">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <div>{error}</div>
                </div>
              </div>
            )}

            <div className="rounded-3xl border border-gray-800 bg-gray-900 p-5">
              <p className="text-sm text-gray-400">{status}</p>
              {success ? (
                <p className="mt-3 text-sm text-teal-300">Redirecting to contacts...</p>
              ) : (
                <p className="mt-3 text-sm text-gray-500">
                  If your camera does not start, you can manually add a contact using the QR payload
                  from the other device.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
