import type { IpcMain } from 'electron'
import { requireUnlocked } from '../core/identity'
import { getContactById, initStorage } from '../core/storage'
import { getNetworkInstance } from '../core/networking'

export function registerCallsIpc(ipcMain: IpcMain): void {
  ipcMain.handle('calls:start', async (_, contactId: unknown) => {
    requireUnlocked()
    initStorage()
    if (typeof contactId !== 'string') throw new Error('Invalid contactId')
    const contact = getContactById(contactId) as any
    if (!contact) throw new Error('Contact not found')
    const network = getNetworkInstance()
    network.sendSignalingMessage(contact.public_id, 'offer', {})
  })

  ipcMain.handle('calls:answer', async (_, contactId: unknown) => {
    requireUnlocked()
    initStorage()
    if (typeof contactId !== 'string') throw new Error('Invalid contactId')
    const contact = getContactById(contactId) as any
    if (!contact) throw new Error('Contact not found')
    const network = getNetworkInstance()
    network.sendSignalingMessage(contact.public_id, 'answer', {})
  })

  ipcMain.handle('calls:hangup', async (_, contactId: unknown) => {
    requireUnlocked()
    initStorage()
    if (typeof contactId !== 'string') throw new Error('Invalid contactId')
    const contact = getContactById(contactId) as any
    if (!contact) throw new Error('Contact not found')
    const network = getNetworkInstance()
    network.sendSignalingMessage(contact.public_id, 'hangup', {})
  })

  ipcMain.handle('calls:signaling', async (_, payload: unknown) => {
    requireUnlocked()
    initStorage()
    const p = payload as { contactId: string; type: string; data: any }
    const contact = getContactById(p.contactId) as any
    if (!contact) throw new Error('Contact not found')
    const network = getNetworkInstance()
    network.sendSignalingMessage(contact.public_id, p.type, p.data)
  })

  ipcMain.handle('calls:candidate', async (_, payload: unknown) => {
    requireUnlocked()
    initStorage()
    const p = payload as { contactId: string; candidate: any }
    const contact = getContactById(p.contactId) as any
    if (!contact) throw new Error('Contact not found')
    const network = getNetworkInstance()
    network.sendSignalingMessage(contact.public_id, 'candidate', p.candidate)
  })

  ipcMain.handle('calls:offer', async (_, contactId: unknown, offer: unknown) => {
    requireUnlocked()
    initStorage()
    if (typeof contactId !== 'string') throw new Error('Invalid contactId')
    const contact = getContactById(contactId) as any
    if (!contact) throw new Error('Contact not found')
    const network = getNetworkInstance()
    network.sendSignalingMessage(contact.public_id, 'offer', offer)
  })

  ipcMain.handle('calls:answer-send', async (_, contactId: unknown, answer: unknown) => {
    requireUnlocked()
    initStorage()
    if (typeof contactId !== 'string') throw new Error('Invalid contactId')
    const contact = getContactById(contactId) as any
    if (!contact) throw new Error('Contact not found')
    const network = getNetworkInstance()
    network.sendSignalingMessage(contact.public_id, 'answer', answer)
  })
}