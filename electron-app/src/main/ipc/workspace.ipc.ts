import type { IpcMain } from 'electron'
import { requireUnlocked, getIdentityProfile } from '../core/identity'
import { initStorage, loadContacts } from '../core/storage'

export function registerWorkspaceIpc(ipcMain: IpcMain): void {
  ipcMain.handle('workspace:init', () => {
    requireUnlocked()
    initStorage()
    return { ok: true }
  })

  ipcMain.handle('workspace:get-summary', () => {
    requireUnlocked()
    const profile = getIdentityProfile()
    const contacts = loadContacts()
    return { profile, contactCount: (contacts as unknown[]).length }
  })
}