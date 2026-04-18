import type { IpcMain } from 'electron'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { requireUnlocked } from '../core/identity'
import { storeMessage, loadMessages, softDeleteMessage, updateDeliveryStatus, getIdentityKeys, getContactById } from '../core/storage'
import { initCrypto, encryptMessage, deriveSessionKey } from '../core/cryptography'

const SendSchema = z.object({
  contactId: z.string().uuid(),
  conversationId: z.string().min(1),
  text: z.string().min(1).max(10_000)
})

const StatusSchema = z.object({
  messageId: z.string().uuid(),
  status: z.enum(['sent', 'delivered', 'failed'])
})

function normalizeMessage(record: any) {
  return {
    id: record.id,
    conversationId: record.conversation_id,
    contactId: record.contact_id,
    direction: record.direction,
    plaintext: record.plaintext,
    ciphertext: record.ciphertext,
    nonce: record.nonce,
    signature: record.signature,
    deliveryStatus: record.delivery_status,
    messageType: record.message_type,
    isEdited: Boolean(record.is_edited),
    isDeleted: Boolean(record.is_deleted),
    createdAt: record.created_at
  }
}

export function registerMessagesIpc(ipcMain: IpcMain): void {
  ipcMain.handle('messages:load', (_, conversationId: unknown) => {
    requireUnlocked()
    if (typeof conversationId !== 'string') throw new Error('Invalid conversationId')
    return loadMessages(conversationId).map(normalizeMessage)
  })

  ipcMain.handle('messages:send', async (_, payload: unknown) => {
    requireUnlocked()
    const { contactId, conversationId, text } = SendSchema.parse(payload)

    await initCrypto()
    const keys = getIdentityKeys()
    if (!keys) throw new Error('Identity keys not found')

    const contact = getContactById(contactId) as any
    if (!contact) throw new Error('Contact not found')

    let sessionKey: Uint8Array = Buffer.from(contactId.slice(0, 32).padEnd(32, '0'))
    if (typeof contact.x_public_key === 'string') {
      const myPrivate = Buffer.from(keys.exchange.privateKey, 'base64')
      const theirPublic = Buffer.from(contact.x_public_key, 'base64')
      sessionKey = await deriveSessionKey(myPrivate, theirPublic)
    }

    const signingPrivateKeyBuffer = Buffer.from(keys.signing.privateKey, 'base64')
    const encrypted = await encryptMessage(text, sessionKey as any, signingPrivateKeyBuffer as any)

    const msg = {
      id: randomUUID(),
      conversationId,
      contactId,
      direction: 'outgoing' as const,
      plaintext: text,
      ciphertext: encrypted.ciphertext,
      nonce: encrypted.nonce,
      signature: encrypted.signature,
      deliveryStatus: 'sent'
    }
    storeMessage(msg)
    return msg
  })

  ipcMain.handle('messages:delete', (_, messageId: unknown) => {
    requireUnlocked()
    if (typeof messageId !== 'string') throw new Error('Invalid messageId')
    softDeleteMessage(messageId)
    return { ok: true }
  })

  ipcMain.handle('messages:update-status', (_, payload: unknown) => {
    requireUnlocked()
    const { messageId, status } = StatusSchema.parse(payload)
    updateDeliveryStatus(messageId, status)
    return { ok: true }
  })
}