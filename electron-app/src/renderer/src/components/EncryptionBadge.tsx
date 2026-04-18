import { ShieldCheck } from 'lucide-react'

export default function EncryptionBadge() {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-teal-950/60 border border-teal-900/60 rounded-full">
      <ShieldCheck className="w-3 h-3 text-teal-400" />
      <span className="text-[10px] text-teal-400 font-medium tracking-wide">
        ChaCha20-Poly1305 · E2E
      </span>
    </div>
  )
}