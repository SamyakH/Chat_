import { useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

interface Props {
  onScan: (data: string) => void
  onError?: (err: string) => void
}

export default function QRScanner({ onScan, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)

  useEffect(() => {
    const id = 'qr-scanner-region'
    if (!containerRef.current) return

    containerRef.current.id = id
    const scanner = new Html5Qrcode(id)
    scannerRef.current = scanner

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 200, height: 200 } },
        (decoded) => {
          onScan(decoded)
          scanner.stop().catch(() => {})
        },
        undefined
      )
      .catch((err) => onError?.(String(err)))

    return () => {
      scanner.stop().catch(() => {})
    }
  }, [onScan, onError])

  return (
    <div className="rounded-xl overflow-hidden border border-gray-700">
      <div ref={containerRef} style={{ width: '100%', minHeight: 240 }} />
    </div>
  )
}