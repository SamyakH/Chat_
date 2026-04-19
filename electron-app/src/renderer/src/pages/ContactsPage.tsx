import { useEffect, useState } from 'react'
import type { MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { UserPlus, Users, QrCode } from 'lucide-react'
import AppLayout from '../components/AppLayout'
import ContactCard from '../components/ContactCard'
import type { Contact } from '../../../shared/api'

interface ContactRequest {
  id: string
  displayName: string
  publicId: string
  createdAt: number
}

export default function ContactsPage(): React.ReactNode {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [blockedContacts, setBlockedContacts] = useState<Contact[]>([])
  const [incomingRequests, setIncomingRequests] = useState<ContactRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showBlocked, setShowBlocked] = useState(false)
  const [contextMenu, setContextMenu] = useState<{
    contactId: string
    x: number
    y: number
  } | null>(null)

  function load(): void {
    setLoading(true)
    setError('')
    window.api
      .listContacts()
      .then((c) => {
        setContacts(c.filter((contact) => !contact.isBlocked))
        setBlockedContacts(c.filter((contact) => contact.isBlocked))
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load contacts')
      })

    // Load incoming contact requests
    window.api
      .listIncomingContactRequests()
      .then((r) => setIncomingRequests(r))
      .catch(() => setIncomingRequests([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()

    const handler = (): void => {
      // Reload incoming requests when a new one arrives
      load()
    }

    window.api.onIncomingContactRequest(handler)

    return () => {
      // Cleanup: ipcRenderer will be cleaned up when the page unmounts
    }
  }, [])

  async function handleDelete(id: string): Promise<void> {
    if (!confirm('Remove this contact?')) return
    setError('')
    try {
      await window.api.deleteContact(id)
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete contact')
    }
  }

  async function handleBlock(id: string): Promise<void> {
    setError('')
    try {
      await window.api.blockContact(id)
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to block contact')
    }
  }

  function openContextMenu(e: MouseEvent<HTMLDivElement>, contactId: string): void {
    e.preventDefault()
    setContextMenu({
      contactId,
      x: e.clientX,
      y: e.clientY
    })
  }

  function closeContextMenu(): void {
    setContextMenu(null)
  }

  async function handleContextCopyId(contactId: string): Promise<void> {
    const contact = contacts.find((c) => c.id === contactId)
    if (!contact) return
    try {
      await navigator.clipboard.writeText(contact.publicId)
    } catch (err) {
      console.error('Failed to copy contact ID', err)
    }
    closeContextMenu()
  }

  async function handleContextCopyFingerprint(contactId: string): Promise<void> {
    const contact = contacts.find((c) => c.id === contactId)
    if (!contact) return
    try {
      await navigator.clipboard.writeText(contact.fingerprint)
    } catch (err) {
      console.error('Failed to copy contact fingerprint', err)
    }
    closeContextMenu()
  }

  async function handleContextEdit(contactId: string): Promise<void> {
    const contact = contacts.find((c) => c.id === contactId)
    if (!contact) return
    const newName = prompt('Edit display name', contact.displayName)
    if (newName === null || !newName.trim()) {
      closeContextMenu()
      return
    }
    const newNote = prompt('Edit note (optional)', contact.note ?? '')
    try {
      await window.api.updateContact({
        id: contactId,
        displayName: newName.trim(),
        note: (newNote ?? '').trim()
      })
      load()
    } catch (err: unknown) {
      console.error('Failed to update contact', err)
      setError(err instanceof Error ? err.message : 'Failed to update contact')
    } finally {
      closeContextMenu()
    }
  }

  async function handleContextBlock(contactId: string): Promise<void> {
    await handleBlock(contactId)
    closeContextMenu()
  }

  async function handleContextDelete(contactId: string): Promise<void> {
    await handleDelete(contactId)
    closeContextMenu()
  }

  async function handleUnblock(id: string): Promise<void> {
    setError('')
    try {
      await window.api.unblockContact(id)
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to unblock contact')
    }
  }

  return (
    <AppLayout>
      <div className="h-full flex flex-col">
         {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-gray-400" />
            <h1 className="text-lg font-semibold text-white">Contacts</h1>
            {incomingRequests.length > 0 && (
              <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full animate-pulse">
                {incomingRequests.length} pending
              </span>
            )}
            <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
              {contacts.length}
            </span>
          </div>
          <Link
            to="/add-contact"
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <UserPlus className="w-4 h-4" /> Add Contact
          </Link>
        </div>

        {/* Incoming Contact Requests */}
        {incomingRequests.length > 0 && (
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-sm font-medium text-gray-400 mb-3">Incoming Contact Requests</h2>
            <div className="space-y-2 max-w-2xl">
              {incomingRequests.map((request) => (
                <div key={request.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">{request.displayName}</p>
                      <p className="text-gray-500 text-xs">Wants to connect with you</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          await window.api.acceptContactRequest(request.id)
                          load()
                        }}
                        className="bg-teal-600 hover:bg-teal-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium"
                      >
                        Accept
                      </button>
                      <button
                        onClick={async () => {
                          await window.api.declineContactRequest(request.id)
                          load()
                        }}
                        className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Blocked Contacts Toggle */}
        {blockedContacts.length > 0 && (
          <div className="px-6 py-3 border-b border-gray-800">
            <button 
              onClick={() => setShowBlocked(!showBlocked)}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              Blocked Contacts ({blockedContacts.length})
              <svg className={`w-4 h-4 transition-transform ${showBlocked ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        )}

        {/* Blocked Contacts List */}
        {showBlocked && blockedContacts.length > 0 && (
          <div className="px-6 py-4 border-b border-gray-800 bg-gray-900/50">
            <div className="space-y-2 max-w-2xl">
              {blockedContacts.map((c) => (
                <div key={c.id} className="bg-gray-900 border border-red-900/50 rounded-xl p-4 opacity-70">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium flex items-center gap-2">
                        {c.displayName}
                        <span className="text-xs text-red-400 bg-red-900/30 px-1.5 py-0.5 rounded">Blocked</span>
                      </p>
                      <p className="text-gray-500 text-xs font-mono">{c.fingerprint?.slice(0, 16)}...</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUnblock(c.id)}
                        className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium"
                      >
                        Unblock
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="bg-red-900/50 hover:bg-red-800 text-white px-3 py-1.5 rounded-lg text-sm font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

         {/* Active Contacts List */}
        <div className="flex-1 overflow-y-auto px-6 py-4 content-auto">
          {error ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          ) : loading && contacts.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-gray-500">Loading contacts...</p>
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <Users className="w-12 h-12 text-gray-800" />
              <p className="text-gray-500 text-sm">No contacts yet</p>
              <div className="flex gap-3">
                <Link
                  to="/add-contact"
                  className="text-teal-500 hover:text-teal-400 text-sm flex items-center gap-1"
                >
                  <UserPlus className="w-4 h-4" /> Add contact
                </Link>
                <Link
                  to="/scan-contact"
                  className="text-teal-500 hover:text-teal-400 text-sm flex items-center gap-1"
                >
                  <QrCode className="w-4 h-4" /> Scan QR
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-2 max-w-2xl">
              {contacts.map((c) => (
                <div key={c.id} onContextMenu={(e) => openContextMenu(e, c.id)}>
                  <ContactCard
                    contact={{
                      id: c.id,
                      displayName: c.displayName,
                      fingerprint: c.fingerprint,
                      note: c.note
                    }}
                    onDelete={handleDelete}
                    onBlock={handleBlock}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

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
                onClick={() => handleContextCopyId(contextMenu.contactId)}
              >
                Copy Public ID
              </button>
              <button
                type="button"
                className="block w-full text-left px-3 py-1.5 hover:bg-gray-800"
                onClick={() => handleContextCopyFingerprint(contextMenu.contactId)}
              >
                Copy Fingerprint
              </button>
              <button
                type="button"
                className="block w-full text-left px-3 py-1.5 hover:bg-gray-800"
                onClick={() => handleContextEdit(contextMenu.contactId)}
              >
                Edit Contact
              </button>
              <button
                type="button"
                className="block w-full text-left px-3 py-1.5 hover:bg-gray-800"
                onClick={() => handleContextBlock(contextMenu.contactId)}
              >
                Block Contact
              </button>
              <button
                type="button"
                className="block w-full text-left px-3 py-1.5 hover:bg-red-900/60 text-red-300"
                onClick={() => handleContextDelete(contextMenu.contactId)}
              >
                Delete Contact
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}