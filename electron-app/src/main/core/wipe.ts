import fs from 'fs'
import { closeStorage } from './storage'
import { lockIdentity, getDataDir } from './identity'

export async function executeWipe(): Promise<void> {
  lockIdentity()
  closeStorage()

  const dir = getDataDir()
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}
