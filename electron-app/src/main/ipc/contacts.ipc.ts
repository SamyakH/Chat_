import type { IpcMain } from 'electron'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { requireUnlocked } from '../core/identity'
import { storeContact, loadContacts, deleteContact, blockContact } from '../core/storage'
import { computeFingerprint } from '../core/cryptography'

const AddContactSchema = z.object({
  displayName: z.string().min(1).max(60),
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

export function registerContactsIpc(ipcMain: IpcMain): void {
  ipcMain.handle('contacts:list', () => {
    requireUnlocked()
    return loadContacts().map(normalizeContact)
  })

  ipcMain.handle('contacts:add', (_, payload: unknown) => {
    requireUnlocked()
    const parsed = AddContactSchema.parse(payload)
    const fingerprint = computeFingerprint(parsed.edPublicKey, parsed.xPublicKey)
    const contact = {
      id: randomUUID(),
      displayName: parsed.displayName,
      fingerprint,
      edPublicKey: parsed.edPublicKey,
      xPublicKey: parsed.xPublicKey,
      note: parsed.note
    }
    storeContact(contact)
    return { ...contact }
  })

  ipcMain.handle('contacts:delete', (_, id: unknown) => {
    requireUnlocked()
    if (typeof id !== 'string') throw new Error('Invalid contact id')
    deleteContact(id)
    return { ok: true }
  })

  ipcMain.handle('contacts:block', (_, id: unknown) => {
    requireUnlocked()
    if (typeof id !== 'string') throw new Error('Invalid contact id')
    blockContact(id)
    return { ok: true }
  })

  ipcMain.handle('contacts:add-from-qr', (_, payload: unknown) => {
    requireUnlocked()
    const { qrData } = AddFromQrSchema.parse(payload)
    let parsed: { publicId?: string; displayName?: string; edPublicKey?: string; xPublicKey?: string }
    try {
      parsed = JSON.parse(qrData)
    } catch {
      throw new Error('QR code payload is malformed')
    }

    if (!parsed.publicId || !parsed.displayName || !parsed.edPublicKey || !parsed.xPublicKey) {
      throw new Error('QR code is missing required contact fields')
    }

    const fingerprint = computeFingerprint(parsed.edPublicKey.trim(), parsed.xPublicKey.trim())
    const contact = {
      id: randomUUID(),
      displayName: parsed.displayName.trim(),
      fingerprint,
      edPublicKey: parsed.edPublicKey.trim(),
      xPublicKey: parsed.xPublicKey.trim(),
      note: `Imported from ${parsed.publicId}`
    }
    storeContact(contact)
    return { ...contact }
  })
}