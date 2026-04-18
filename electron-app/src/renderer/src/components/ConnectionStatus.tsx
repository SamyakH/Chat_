interface Props {
  status: 'connecting' | 'connected' | 'disconnected'
}

const CONFIG = {
  connecting:   { dot: 'bg-yellow-500 animate-pulse', text: 'Connecting...', color: 'text-yellow-400' },
  connected:    { dot: 'bg-teal-500',                  text: 'P2P Connected', color: 'text-teal-400' },
  disconnected: { dot: 'bg-gray-600',                  text: 'Offline',       color: 'text-gray-500' },
}

export default function ConnectionStatus({ status }: Props) {
  const { dot, text, color } = CONFIG[status]
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      <span className={`text-xs ${color}`}>{text}</span>
    </div>
  )
}