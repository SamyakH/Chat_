import { useEffect, useState, useRef } from 'react'
import type { MouseEvent, ReactElement } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Send, MessageSquare, UserPlus, Phone } from 'lucide-react'
import AppLayout from '../components/AppLayout'
import MessageBubble from '../components/MessageBubble'
import EncryptionBadge from '../components/EncryptionBadge'
import { webrtc } from '../core/webrtc-manager'
import type { Contact, Message } from '../../../shared/api'

export default function ChatPage(): ReactElement {
  const { contactId } = useParams<{ contactId: string }>()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [contextMenu, setContextMenu] = useState<{
    messageId: string
    x: number
    y: number
  } | null>(null)
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
      setMessages([])
      return
    }
    setError('')
    window.api
      .loadMessages(convId)
      .then((m) => setMessages(m))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load messages')
      })
  }, [convId])

  useEffect(() => {
    // Listen for incoming messages and reload if they are for this conversation
    const handler = (p: { conversationId: string }): void => {
      if (!convId) return
      if (p.conversationId !== convId) return
      window.api
        .loadMessages(convId)
        .then((m) => setMessages(m))
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'Failed to load messages')
        })
    }

     const unsubscribe = window.api.onMessageReceived(handler)

    return () => {
      unsubscribe()
    }
  }, [convId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleMessageRightClick(messageId: string, event: MouseEvent<HTMLDivElement>): void {
    event.preventDefault()
    setContextMenu({
      messageId,
      x: event.clientX,
      y: event.clientY
    })
  }

  function closeContextMenu(): void {
    setContextMenu(null)
  }

  async function handleContextCopy(messageId: string): Promise<void> {
    const msg = messages.find((m) => m.id === messageId)
    if (!msg) return
    try {
      await navigator.clipboard.writeText(msg.plaintext)
    } catch (err) {
      console.error('Failed to copy message text', err)
    }
    closeContextMenu()
  }

  async function handleContextDelete(messageId: string): Promise<void> {
    if (!confirm('Delete this message?')) return
    try {
      await window.api.deleteMessage(messageId)
      setMessages((prev) => prev.filter((m) => m.id !== messageId))
    } catch (err: unknown) {
      console.error('Failed to delete message', err)
      setError(err instanceof Error ? err.message : 'Failed to delete message')
    } finally {
      closeContextMenu()
    }
  }

  async function handleContextEdit(messageId: string): Promise<void> {
    const msg = messages.find((m) => m.id === messageId)
    if (!msg) return
    const newText = prompt('Edit message', msg.plaintext)
    if (newText === null || !newText.trim()) {
      closeContextMenu()
      return
    }
    try {
      const updated = await window.api.editMessage({ messageId, text: newText.trim() })
      setMessages((prev) => prev.map((m) => (m.id === messageId ? updated : m)))
    } catch (err: unknown) {
      console.error('Failed to edit message', err)
      setError(err instanceof Error ? err.message : 'Failed to edit message')
    } finally {
      closeContextMenu()
    }
  }

  async function handleSend(): Promise<void> {
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

  async function handleStartCall(): Promise<void> {
    if (!selected) return
    try {
      await webrtc.startCall(selected.id)
    } catch (err) {
      console.error('Failed to start call:', err)
      setError(err instanceof Error ? err.message : 'Failed to start call')
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
              <div className="ml-auto flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleStartCall}
                  className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" />
                  Call
                </button>
                <EncryptionBadge />
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2 content-auto">
              {error && (
                <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
                  {error}
                </div>
              )}
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} onCopy={handleMessageRightClick} />
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

        {contextMenu && (
          <div
            className="fixed inset-0 z-50"
            onClick={closeContextMenu}
            onContextMenu={(e) => {
              e.preventDefault()
              closeContextMenu()
            }}
          >
            <div
              className="absolute bg-gray-900 border border-gray-700 rounded-lg shadow-lg py-1 text-sm text-gray-100"
              style={{ top: contextMenu.y, left: contextMenu.x }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="block w-full text-left px-3 py-1.5 hover:bg-gray-800"
                onClick={() => handleContextCopy(contextMenu.messageId)}
              >
                Copy text
              </button>
              <button
                type="button"
                className="block w-full text-left px-3 py-1.5 hover:bg-gray-800"
                onClick={() => handleContextEdit(contextMenu.messageId)}
              >
                Edit message
              </button>
              <button
                type="button"
                className="block w-full text-left px-3 py-1.5 hover:bg-red-900/60 text-red-300"
                onClick={() => handleContextDelete(contextMenu.messageId)}
              >
                Delete message
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
