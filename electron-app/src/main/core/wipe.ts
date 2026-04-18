import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { closeStorage } from './storage'
import { lockIdentity } from './identity'

export async function executeWipe(): Promise<void> {
  lockIdentity()
  closeStorage()

  const dir = path.join(app.getPath('userData'), 'anon-chat')
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}
