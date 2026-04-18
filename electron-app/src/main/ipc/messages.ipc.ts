import type { IpcMain } from 'electron'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { requireUnlocked } from '../core/identity'
import { storeMessage, loadMessages, softDeleteMessage, updateDeliveryStatus } from '../core/storage'

const SendSchema = z.object({
  contactId: z.string().uuid(),
  conversationId: z.string().min(1),
  text: z.string().min(1).max(10_000)
})

const StatusSchema = z.object({
  messageId: z.string().uuid(),
  status: z.enum(['sent', 'delivered', 'failed'])
})

export function registerMessagesIpc(ipcMain: IpcMain): void {
  ipcMain.handle('messages:load', (_, conversationId: unknown) => {
    requireUnlocked()
    if (typeof conversationId !== 'string') throw new Error('Invalid conversationId')
    return loadMessages(conversationId)
  })

  ipcMain.handle('messages:send', (_, payload: unknown) => {
    requireUnlocked()
    const { contactId, conversationId, text } = SendSchema.parse(payload)
    const msg = {
      id: randomUUID(),
      conversationId,
      contactId,
      direction: 'outgoing' as const,
      plaintext: text,
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