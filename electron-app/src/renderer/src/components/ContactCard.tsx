import { Trash2, ShieldOff } from 'lucide-react'

interface Contact {
  id: string
  display_name: string
  fingerprint: string
  note: string
}

interface Props {
  contact: Contact
  onDelete: (id: string) => void
  onBlock: (id: string) => void
}

export default function ContactCard({ contact, onDelete, onBlock }: Props) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 rounded-xl border border-gray-800 hover:border-gray-700 transition-colors">
      <div className="w-10 h-10 rounded-full bg-teal-800/60 flex items-center justify-center flex-shrink-0">
        <span className="text-sm font-semibold text-teal-300">
          {contact.display_name.charAt(0).toUpperCase()}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{contact.display_name}</p>
        <p className="text-xs text-gray-500 font-mono truncate">
          {contact.fingerprint.slice(0, 24)}...
        </p>
        {contact.note && (
          <p className="text-xs text-gray-600 truncate mt-0.5">{contact.note}</p>
        )}
      </div>

      <div className="flex gap-1">
        <button
          onClick={() => onBlock(contact.id)}
          className="p-1.5 rounded-lg text-gray-600 hover:text-yellow-400 hover:bg-yellow-950/30 transition-colors"
          title="Block"
        >
          <ShieldOff className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onDelete(contact.id)}
          className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-950/30 transition-colors"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}