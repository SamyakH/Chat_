import type { IpcMain } from 'electron'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { requireUnlocked, getIdentityProfile } from '../core/identity'
import {
  storeContact,
  loadContacts,
  loadBlockedContacts,
  deleteContact,
  blockContact,
  unblockContact,
  initStorage,
  loadIncomingContactRequests,
  acceptContactRequest,
  declineContactRequest,
  getDb,
  getContactById
} from '../core/storage'
import { computeFingerprint } from '../core/cryptography'
import type { Contact } from '../../shared/api'

const AddContactSchema = z.object({
  displayName: z.string().min(1).max(60),
  publicId: z.string().min(1),
  edPublicKey: z.string().min(10),
  xPublicKey: z.string().min(10),
  note: z.string().max(200).optional().default('')
})

const AddFromQrSchema = z.object({
  qrData: z.string().min(1)
})

function normalizeContact(record: any) {
  return {
    id: record.id,
    publicId: record.public_id,
    displayName: record.display_name,
    fingerprint: record.fingerprint,
    edPublicKey: record.ed_public_key,
    xPublicKey: record.x_public_key,
    note: record.note,
    isBlocked: Boolean(record.is_blocked),
    createdAt: record.created_at,
    lastMessageAt: record.last_message_at
  }
}

function makeContactRecord(contact: {
  id: string
  displayName: string
  fingerprint: string
  edPublicKey: string
  xPublicKey: string
  note: string
  publicId: string
}): Contact {
  const createdAt = Date.now()
  return {
    ...contact,
    publicId: contact.publicId,
    isBlocked: false,
    createdAt,
    lastMessageAt: null
  }
}

export function registerContactsIpc(ipcMain: IpcMain): void {
  ipcMain.handle('contacts:list', () => {
    requireUnlocked()
    initStorage()
    return loadContacts().map(normalizeContact)
  })

  ipcMain.handle('contacts:requests:list', () => {
    requireUnlocked()
    initStorage()
    return loadIncomingContactRequests()
  })

  ipcMain.handle('contacts:request:accept', (_, requestId: unknown) => {
    requireUnlocked()
    initStorage()
    if (typeof requestId !== 'string') throw new Error('Invalid request id')
    acceptContactRequest(requestId)
    return { ok: true }
  })

  ipcMain.handle('contacts:request:decline', (_, requestId: unknown) => {
    requireUnlocked()
    initStorage()
    if (typeof requestId !== 'string') throw new Error('Invalid request id')
    declineContactRequest(requestId)
    return { ok: true }
  })

  ipcMain.handle('contacts:add', (_, payload: unknown) => {
    requireUnlocked()
    initStorage()
    const parsed = AddContactSchema.parse(payload)
    const fingerprint = computeFingerprint(parsed.edPublicKey, parsed.xPublicKey)
    const contact = makeContactRecord({
      id: randomUUID(),
      displayName: parsed.displayName,
      publicId: parsed.publicId,
      fingerprint,
      edPublicKey: parsed.edPublicKey,
      xPublicKey: parsed.xPublicKey,
      note: parsed.note
    })
    try {
      storeContact(contact)
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('UNIQUE constraint failed: contacts.fingerprint')
      ) {
        throw new Error('This contact is already in your list.')
      }
      throw error
    }
    return { ...contact }
  })

  ipcMain.handle('contacts:delete', (_, id: unknown) => {
    requireUnlocked()
    initStorage()
    if (typeof id !== 'string') throw new Error('Invalid contact id')
    deleteContact(id)
    return { ok: true }
  })

  ipcMain.handle('contacts:block', (_, id: unknown) => {
    requireUnlocked()
    initStorage()
    if (typeof id !== 'string') throw new Error('Invalid contact id')
    blockContact(id)
    return { ok: true }
  })

  ipcMain.handle('contacts:update', (_, payload: unknown) => {
    requireUnlocked()
    initStorage()
    const p = payload as { id: string; displayName?: string; note?: string }
    if (!p.id) throw new Error('Invalid contact id')
    // Update logic, assume storage has updateContact
    // For now, simple update
    const db = getDb()
    const updates: string[] = []
    const values: any[] = []
    if (p.displayName) {
      updates.push('display_name = ?')
      values.push(p.displayName)
    }
    if (p.note !== undefined) {
      updates.push('note = ?')
      values.push(p.note)
    }
    if (updates.length === 0) throw new Error('Nothing to update')
    values.push(p.id)
    db.prepare(`UPDATE contacts SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    const contact = getContactById(p.id) as any
    return normalizeContact(contact)
  })

  ipcMain.handle('contacts:add-from-qr', (_, payload: unknown) => {
    requireUnlocked()
    initStorage()
    const { qrData } = AddFromQrSchema.parse(payload)
    let parsed: {
      publicId?: string
      displayName?: string
      edPublicKey?: string
      xPublicKey?: string
    }
    try {
      parsed = JSON.parse(qrData)
    } catch {
      throw new Error('QR code payload is malformed')
    }

    if (!parsed.publicId || !parsed.displayName || !parsed.edPublicKey || !parsed.xPublicKey) {
      throw new Error('QR code is missing required contact fields')
    }

    const publicId = parsed.publicId.trim()
    const displayName = parsed.displayName.trim()
    const edPublicKey = parsed.edPublicKey.trim()
    const xPublicKey = parsed.xPublicKey.trim()

    if (!displayName || !edPublicKey || !xPublicKey) {
      throw new Error('QR code contains empty contact fields')
    }

    const ownProfile = getIdentityProfile()
    if (publicId === ownProfile.publicId) {
      throw new Error('You cannot add your own identity as a contact.')
    }

    const fingerprint = computeFingerprint(edPublicKey, xPublicKey)
    const contact = makeContactRecord({
      id: randomUUID(),
      displayName,
      publicId,
      fingerprint,
      edPublicKey,
      xPublicKey,
      note: `Imported from ${publicId}`
    })
    try {
      storeContact(contact)
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('UNIQUE constraint failed: contacts.fingerprint')
      ) {
        throw new Error('This contact is already in your list.')
      }
      throw error
    }
    return { ...contact }
  })

  ipcMain.handle('contacts:blocked:list', () => {
    requireUnlocked()
    initStorage()
    return loadBlockedContacts().map(normalizeContact)
  })

  ipcMain.handle('contacts:unblock', (_, id: unknown) => {
    requireUnlocked()
    initStorage()
    if (typeof id !== 'string') throw new Error('Invalid contact id')
    unblockContact(id)
    return { ok: true }
  })
}
