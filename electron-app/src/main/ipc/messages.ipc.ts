import type { IpcMain } from 'electron'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { requireUnlocked } from '../core/identity'
import {
  storeMessage,
  loadMessages,
  softDeleteMessage,
  updateDeliveryStatus,
  getIdentityKeys,
  getContactById,
  initStorage,
  getDb
} from '../core/storage'
import { initCrypto, encryptMessage, deriveSessionKey } from '../core/cryptography'
import { getNetworkInstance } from '../core/networking'
import type { Message } from '../../shared/api'

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
    initStorage()
    if (typeof conversationId !== 'string') throw new Error('Invalid conversationId')
    return loadMessages(conversationId).map(normalizeMessage)
  })

  ipcMain.handle('messages:send', async (_, payload: unknown) => {
    requireUnlocked()
    initStorage()
    const { contactId, conversationId, text } = SendSchema.parse(payload)

    await initCrypto()
    const keys = getIdentityKeys()
    if (!keys) throw new Error('Identity keys not found')

    const contact = getContactById(contactId) as any
    if (!contact) throw new Error('Contact not found')

    if (typeof contact.x_public_key !== 'string' || !contact.x_public_key.trim()) {
      throw new Error('Contact is missing a valid exchange key.')
    }

    let sessionKey: Uint8Array
    try {
      const myPrivate = Buffer.from(keys.exchange.privateKey, 'base64')
      const theirPublic = Buffer.from(contact.x_public_key, 'base64')
      sessionKey = await deriveSessionKey(myPrivate, theirPublic)
    } catch {
      throw new Error('Unable to derive a secure session for this contact.')
    }

    const signingPrivateKeyBuffer = Buffer.from(keys.signing.privateKey, 'base64')
    const encrypted = await encryptMessage(text, sessionKey, signingPrivateKeyBuffer)

    const createdAt = Date.now()
    const msg: Message = {
      id: randomUUID(),
      conversationId,
      contactId,
      direction: 'outgoing',
      plaintext: text,
      ciphertext: encrypted.ciphertext,
      nonce: encrypted.nonce,
      signature: encrypted.signature,
      deliveryStatus: 'sent',
      messageType: 'TEXT',
      isEdited: false,
      isDeleted: false,
      createdAt
    }
    storeMessage(msg)
    // Send via network
    getNetworkInstance().sendMessage((contact as any).public_id, msg).catch(console.error)
    return msg
  })

  ipcMain.handle('messages:edit', async (_, payload: unknown) => {
    requireUnlocked()
    initStorage()
    const p = payload as { messageId: string; text: string }
    if (!p.messageId || !p.text) throw new Error('Invalid payload')
    
    // Update plaintext and mark as edited
    // Note: ciphertext remains immutable (original encrypted version sent to peer)
    // Only the local plaintext display is updated
    const db = getDb()
    db.prepare('UPDATE messages SET plaintext = ?, is_edited = 1 WHERE id = ?').run(p.text, p.messageId)
    const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(p.messageId) as any
    return normalizeMessage(msg)
  })

  ipcMain.handle('messages:delete', (_, messageId: unknown) => {
    requireUnlocked()
    initStorage()
    if (typeof messageId !== 'string') throw new Error('Invalid messageId')
    softDeleteMessage(messageId)
    return { ok: true }
  })

  ipcMain.handle('messages:update-status', (_, payload: unknown) => {
    requireUnlocked()
    initStorage()
    const { messageId, status } = StatusSchema.parse(payload)
    updateDeliveryStatus(messageId, status)
    return { ok: true }
  })
}
