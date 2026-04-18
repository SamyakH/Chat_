import type { IpcMain } from 'electron'
import { z } from 'zod'
import { executeWipe } from '../core/wipe'

const WipeSchema = z.object({
  confirmation: z.literal('DESTROY')
})

export function registerWipeIpc(ipcMain: IpcMain): void {
  ipcMain.handle('wipe:execute', async (_, payload: unknown) => {
    WipeSchema.parse(payload) // throws if 'DESTROY' not typed exactly
    await executeWipe()
    return { ok: true }
  })
}
