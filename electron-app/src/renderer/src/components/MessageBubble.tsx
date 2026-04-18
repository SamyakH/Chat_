import { CheckCheck, Check, Clock } from 'lucide-react'

interface Props {
  message: {
    id: string
    direction: 'incoming' | 'outgoing'
    plaintext: string
    delivery_status: string
    created_at: number
  }
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'delivered') return <CheckCheck className="w-3 h-3 text-teal-400" />
  if (status === 'sent') return <Check className="w-3 h-3 text-gray-500" />
  return <Clock className="w-3 h-3 text-gray-600" />
}

export default function MessageBubble({ message }: Props) {
  const out = message.direction === 'outgoing'
  return (
    <div className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl ${
          out
            ? 'bg-teal-700 text-white rounded-br-sm'
            : 'bg-gray-800 text-gray-100 rounded-bl-sm'
        }`}
      >
        <p className="text-sm leading-relaxed break-words">{message.plaintext}</p>
        <div className={`flex items-center gap-1 mt-1 ${out ? 'justify-end' : 'justify-start'}`}>
          <span className="text-[10px] text-white/40">{formatTime(message.created_at)}</span>
          {out && <StatusIcon status={message.delivery_status} />}
        </div>
      </div>
    </div>
  )
}