import type { IpcMain } from 'electron'
import { z } from 'zod'
import {
  getIdentityState,
  createIdentity,
  unlockIdentity,
  lockIdentity,
  updateIdentityProfile,
  regenerateIdentityPublicId
} from '../core/identity'
import { getIdentityKeys } from '../core/storage'

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
    const state = getIdentityState()
    if (!state.hasIdentity || !state.profile) throw new Error('Identity not created')
    const keys = getIdentityKeys()
    if (!keys) throw new Error('Identity keys are missing')

    const payload = {
      publicId: state.profile.publicId,
      displayName: state.profile.displayName,
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
}
