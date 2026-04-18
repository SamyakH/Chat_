import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { UserPlus, Users, QrCode } from 'lucide-react'
import AppLayout from '../components/AppLayout'
import ContactCard from '../components/ContactCard'
import type { Contact } from '../../../shared/api'

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  function load() {
    setLoading(true)
    setError('')
    window.api
      .listContacts()
      .then((c) => setContacts(c))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load contacts')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    setTimeout(load, 0)
  }, [])

  async function handleDelete(id: string) {
    if (!confirm('Remove this contact?')) return
    setError('')
    try {
      await window.api.deleteContact(id)
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete contact')
    }
  }

  async function handleBlock(id: string) {
    setError('')
    try {
      await window.api.blockContact(id)
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to block contact')
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

        {/* List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
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
                <ContactCard
                  key={c.id}
                  contact={{
                    id: c.id,
                    displayName: c.displayName,
                    fingerprint: c.fingerprint,
                    note: c.note
                  }}
                  onDelete={handleDelete}
                  onBlock={handleBlock}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
