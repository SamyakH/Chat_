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

export function registerContactsIpc(ipcMain: IpcMain): void {
  ipcMain.handle('contacts:list', () => {
    requireUnlocked()
    return loadContacts()
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
}