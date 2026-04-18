import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { UserPlus, Users, QrCode } from 'lucide-react'
import AppLayout from '../components/AppLayout'
import ContactCard from '../components/ContactCard'

interface ApiContact { id: string; display_name: string; fingerprint: string; note: string }
interface Contact { id: string; displayName: string; fingerprint: string; note: string }

function mapContact(raw: ApiContact): Contact {
  return {
    id: raw.id,
    displayName: raw.display_name,
    fingerprint: raw.fingerprint,
    note: raw.note,
  }
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)

  function load() {
    setLoading(true)
    window.api.listContacts().then((c) => setContacts((c as ApiContact[]).map(mapContact))).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function handleDelete(id: string) {
    if (!confirm('Remove this contact?')) return
    await window.api.deleteContact(id)
    load()
  }

  async function handleBlock(id: string) {
    await window.api.blockContact(id)
    load()
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
          {contacts.length === 0 ? (
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
                  contact={c}
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