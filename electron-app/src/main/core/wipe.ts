import { burnAccount } from './identity'

export async function executeWipe(): Promise<void> {
  // Reuse the same emergency wipe behavior as burnAccount()
  burnAccount()
}
