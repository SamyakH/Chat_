import type { IpcMain } from 'electron'
import { z } from 'zod'
import {
  getIdentityState,
  getIdentityProfile,
  requireUnlocked,
  createIdentity,
  unlockIdentity,
  lockIdentity,
  updateIdentityProfile,
  regenerateIdentityPublicId,
  burnAccount
} from '../core/identity'
import { getIdentityKeys, initStorage } from '../core/storage'

const CreateIdentitySchema = z.object({
  displayName: z.string().min(2).max(36),
  statusLine: z.string().max(120),
  passcode: z.string().min(4)
})

const UnlockIdentitySchema = z.object({
  passcode: z.string().min(1)
})

const UpdateProfileSchema = z.object({
  displayName: z.string().min(2).max(36),
  statusLine: z.string().max(120)
})

export function registerIdentityIpc(ipcMain: IpcMain): void {
  ipcMain.handle('identity:get-state', () => getIdentityState())
  ipcMain.handle('identity:get-qr-code', () => {
    requireUnlocked()
    initStorage()
    const profile = getIdentityProfile()
    const keys = getIdentityKeys()
    if (!keys) throw new Error('Identity keys are missing')

    const payload = {
      publicId: profile.publicId,
      displayName: profile.displayName,
      edPublicKey: keys.signing.publicKey,
      xPublicKey: keys.exchange.publicKey
    }
    const qrData = JSON.stringify(payload)
    return { qrData, ...payload }
  })
  ipcMain.handle('identity:create', async (_, payload: unknown) => {
    const parsed = CreateIdentitySchema.parse(payload)
    return await createIdentity(parsed)
  })

  ipcMain.handle('identity:unlock', (_, payload: unknown) => {
    const parsed = UnlockIdentitySchema.parse(payload)
    return unlockIdentity(parsed.passcode)
  })

  ipcMain.handle('identity:lock', () => lockIdentity())

  ipcMain.handle('identity:update-profile', (_, payload: unknown) => {
    const parsed = UpdateProfileSchema.parse(payload)
    return updateIdentityProfile(parsed)
  })

  ipcMain.handle('identity:regenerate-id', () => regenerateIdentityPublicId())

  ipcMain.handle('identity:burn-account', () => {
    burnAccount()
    return true
  })
}
