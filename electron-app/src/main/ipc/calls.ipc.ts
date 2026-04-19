import type { IpcMain } from 'electron'
import { z } from 'zod'
import { requireUnlocked } from '../core/identity'
import { getContactById, initStorage } from '../core/storage'
import { getNetworkInstance } from '../core/networking'

const SignalingSchema = z.object({
  contactId: z.string().min(1),
  type: z.string().min(1),
  data: z.unknown()
})

const CandidateSchema = z.object({
  contactId: z.string().min(1),
  candidate: z.unknown()
})

export function registerCallsIpc(ipcMain: IpcMain): void {
  ipcMain.handle('calls:hangup', async (_, contactId: unknown) => {
    requireUnlocked()
    initStorage()
    if (typeof contactId !== 'string') throw new Error('Invalid contactId')
    const contact = getContactById(contactId)
    if (!contact) throw new Error('Contact not found')
    const network = getNetworkInstance()
    network.sendSignalingMessage((contact as { public_id: string }).public_id, 'hangup', {})
  })

  ipcMain.handle('calls:signaling', async (_, payload: unknown) => {
    requireUnlocked()
    initStorage()
    const p = SignalingSchema.parse(payload)
    const contact = getContactById(p.contactId)
    if (!contact) throw new Error('Contact not found')
    const network = getNetworkInstance()
    network.sendSignalingMessage((contact as { public_id: string }).public_id, p.type, p.data)
  })

  ipcMain.handle('calls:candidate', async (_, payload: unknown) => {
    requireUnlocked()
    initStorage()
    const p = CandidateSchema.parse(payload)
    const contact = getContactById(p.contactId)
    if (!contact) throw new Error('Contact not found')
    const network = getNetworkInstance()
    network.sendSignalingMessage((contact as { public_id: string }).public_id, 'candidate', p.candidate)
  })

  ipcMain.handle('calls:offer', async (_, contactId: unknown, offer: unknown) => {
    requireUnlocked()
    initStorage()
    if (typeof contactId !== 'string') throw new Error('Invalid contactId')
    const contact = getContactById(contactId)
    if (!contact) throw new Error('Contact not found')
    const network = getNetworkInstance()
    network.sendSignalingMessage((contact as { public_id: string }).public_id, 'offer', offer)
  })

  ipcMain.handle('calls:answer-send', async (_, contactId: unknown, answer: unknown) => {
    requireUnlocked()
    initStorage()
    if (typeof contactId !== 'string') throw new Error('Invalid contactId')
    const contact = getContactById(contactId)
    if (!contact) throw new Error('Contact not found')
    const network = getNetworkInstance()
    network.sendSignalingMessage((contact as { public_id: string }).public_id, 'answer', answer)
  })
}