import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Send, MessageSquare, UserPlus } from 'lucide-react'
import AppLayout from '../components/AppLayout'
import MessageBubble from '../components/MessageBubble'
import EncryptionBadge from '../components/EncryptionBadge'
import type { Contact, Message } from '../../../shared/api'

export default function ChatPage() {
  const { contactId } = useParams<{ contactId: string }>()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const selected = contacts.find((c) => c.id === contactId) ?? null
  const convId = selected ? `conv-${selected.id}` : null

  useEffect(() => {
    window.api
      .listContacts()
      .then((c) => setContacts(c))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load contacts')
      })
  }, [])

  useEffect(() => {
    if (!convId) {
      setTimeout(() => setMessages([]), 0)
      return
    }
    setTimeout(() => setError(''), 0)
    window.api
      .loadMessages(convId)
      .then((m) => setMessages(m))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load messages')
      })
  }, [convId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    if (!text.trim() || !selected || !convId || sending) return
    setSending(true)
    setError('')
    try {
      const msg = await window.api.sendMessage({
        contactId: selected.id,
        conversationId: convId,
        text: text.trim()
      })
      setMessages((prev) => [...prev, msg])
      setText('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  return (
    <AppLayout>
      <div className="flex h-full">
        {/* Contact list sidebar */}
        <div className="w-60 bg-gray-900 border-r border-gray-800 flex flex-col flex-shrink-0">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Conversations
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {contacts.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-gray-600 text-xs mb-3">No contacts yet</p>
                <Link
                  to="/add-contact"
                  className="text-teal-500 text-xs hover:text-teal-400 flex items-center justify-center gap-1"
                >
                  <UserPlus className="w-3 h-3" /> Add first contact
                </Link>
              </div>
            ) : (
              contacts.map((c) => (
                <Link
                  key={c.id}
                  to={`/chat/${c.id}`}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                    c.id === contactId
                      ? 'bg-gray-800 border-l-2 border-teal-500'
                      : 'hover:bg-gray-800/50 border-l-2 border-transparent'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-teal-900/60 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-teal-300">
                      {c.displayName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{c.displayName}</p>
                    <p className="text-[10px] text-gray-600 font-mono truncate">
                      {c.fingerprint.slice(0, 16)}…
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Chat area */}
        {selected ? (
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header */}
            <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-3 bg-gray-950">
              <div className="w-8 h-8 rounded-full bg-teal-900/60 flex items-center justify-center">
                <span className="text-sm font-bold text-teal-300">
                  {selected.displayName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-semibold text-white text-sm">{selected.displayName}</p>
                <p className="text-[10px] text-gray-500 font-mono">
                  {selected.fingerprint.slice(0, 20)}…
                </p>
              </div>
              <div className="ml-auto">
                <EncryptionBadge />
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
              {error && (
                <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
                  {error}
                </div>
              )}
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="px-5 py-4 border-t border-gray-800 bg-gray-950">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Type a message... (Enter to send)"
                  className="flex-1 bg-gray-900 border border-gray-800 focus:border-teal-600 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 outline-none transition-colors text-sm"
                />
                <button
                  onClick={handleSend}
                  disabled={!text.trim() || sending}
                  className="bg-teal-600 hover:bg-teal-500 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-xl px-4 py-2.5 transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <MessageSquare className="w-12 h-12 text-gray-800" />
            <p className="text-gray-600 text-sm">Select a contact to start a secure conversation</p>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
