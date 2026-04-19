import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { initCrypto, generateSigningKeyPair, generateExchangeKeyPair, decryptMessage, deriveSessionKey } from './cryptography'
import { closeStorage, initStorage, storeIdentityKeys, getContactByPublicId, storeMessage, getIdentityKeys } from './storage'
import { initializeNetwork, getNetworkInstance } from './networking'
import { mainWindow } from '../index'

export interface IdentityProfile {
  displayName: string
  statusLine: string
  publicId: string
}

interface IdentityRecord {
  version: 1
  profile: IdentityProfile
  passcodeSalt: string
  passcodeHash: string
  createdAt: number
  updatedAt: number
}

export interface IdentityState {
  hasIdentity: boolean
  isUnlocked: boolean
  profile: IdentityProfile | null
}

let isUnlocked = false

export function getDataDir(): string {
  return path.join(app.getPath('userData'), 'anon-chat')
}

function getIdentityFile(): string {
  return path.join(getDataDir(), 'identity.json')
}

function ensureDataDir(): void {
  fs.mkdirSync(getDataDir(), { recursive: true })
}

function generatePublicId(): string {
  return `anon-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}`
}

function normalizeName(s: string, max: number): string {
  return s.trim().replace(/\s+/g, ' ').slice(0, max)
}

function hashPasscode(passcode: string, saltBase64: string): string {
  return scryptSync(passcode, Buffer.from(saltBase64, 'base64'), 64).toString('base64')
}

function readIdentity(): IdentityRecord | null {
  ensureDataDir()
  const file = getIdentityFile()
  if (!fs.existsSync(file)) return null
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as IdentityRecord
  } catch {
    return null
  }
}

function writeIdentity(identity: IdentityRecord): void {
  ensureDataDir()
  fs.writeFileSync(getIdentityFile(), JSON.stringify(identity, null, 2), { mode: 0o600 })
}

function makeState(identity: IdentityRecord | null): IdentityState {
  return {
    hasIdentity: Boolean(identity),
    isUnlocked,
    profile: identity ? identity.profile : null
  }
}

export function getIdentityState(): IdentityState {
  return makeState(readIdentity())
}

export function requireUnlocked(): void {
  if (!isUnlocked) throw new Error('Unlock the app to continue.')
}

export function getIdentityProfile(): IdentityProfile {
  requireUnlocked()
  const identity = readIdentity()
  if (!identity) throw new Error('No local identity found.')
  return identity.profile
}

export async function createIdentity(payload: {
  displayName: string
  statusLine: string
  passcode: string
}): Promise<IdentityState> {
  if (readIdentity()) throw new Error('An identity already exists on this device.')

  const displayName = normalizeName(payload.displayName, 36)
  const statusLine = normalizeName(payload.statusLine, 120)
  const passcode = payload.passcode.trim()

  if (displayName.length < 2) throw new Error('Display name must be at least 2 characters.')
  if (passcode.length < 4) throw new Error('Passcode must be at least 4 characters.')

  // Initialize crypto and generate key pairs
  await initCrypto()
  const signingKeys = await generateSigningKeyPair()
  const exchangeKeys = await generateExchangeKeyPair()

  const now = Date.now()
  const passcodeSalt = randomBytes(16).toString('base64')

  const identity: IdentityRecord = {
    version: 1,
    profile: {
      displayName,
      statusLine: statusLine || 'Ready for a private exchange.',
      publicId: generatePublicId()
    },
    passcodeSalt,
    passcodeHash: hashPasscode(passcode, passcodeSalt),
    createdAt: now,
    updatedAt: now
  }

  try {
    isUnlocked = true
    initStorage()
    storeIdentityKeys(signingKeys, exchangeKeys)
    writeIdentity(identity)
    return makeState(identity)
  } catch (error) {
    isUnlocked = false
    try {
      closeStorage()
      fs.rmSync(getDataDir(), { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors and surface the original failure.
    }
    throw error
  }
}

export function unlockIdentity(passcode: string): IdentityState {
  const identity = readIdentity()
  if (!identity) throw new Error('No identity found. Create one first.')

  const expected = Buffer.from(identity.passcodeHash, 'base64')
  const received = Buffer.from(hashPasscode(passcode.trim(), identity.passcodeSalt), 'base64')

  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new Error('Incorrect passcode.')
  }

  isUnlocked = true

  // Initialize storage after successful unlock
  try {
    initStorage()
  } catch {
    isUnlocked = false
    throw new Error('Failed to initialize secure storage')
  }

  // Initialize network
  initializeNetwork(identity.profile.publicId)
  getNetworkInstance().on('message:received', handleIncomingMessage)
  getNetworkInstance().on('signaling:received', (msg) => {
    if (mainWindow) {
      mainWindow.webContents.send('signaling:message', msg)
    }
  })

  return makeState(identity)
}

export function lockIdentity(): IdentityState {
  isUnlocked = false
  closeStorage()
  try {
    getNetworkInstance().shutdown()
  } catch {
    // Ignore if not initialized
  }
  return makeState(readIdentity())
}

export function burnAccount(): void {
  // Emergency wipe all data
  isUnlocked = false
  try {
    closeStorage()
    // Recursively delete entire user data directory
    fs.rmSync(getDataDir(), { recursive: true, force: true, maxRetries: 5 })
  } catch {
    // Ignore cleanup errors
  }
}

export function updateIdentityProfile(payload: {
  displayName: string
  statusLine: string
}): IdentityState {
  requireUnlocked()
  const identity = readIdentity()
  if (!identity) throw new Error('No identity found.')

  const displayName = normalizeName(payload.displayName, 36)
  const statusLine = normalizeName(payload.statusLine, 120)
  if (displayName.length < 2) throw new Error('Display name must be at least 2 characters.')

  identity.profile.displayName = displayName
  identity.profile.statusLine = statusLine || 'Ready for a private exchange.'
  identity.updatedAt = Date.now()

  writeIdentity(identity)
  return makeState(identity)
}

export function regenerateIdentityPublicId(): IdentityState {
  requireUnlocked()
  const identity = readIdentity()
  if (!identity) throw new Error('No identity found.')

  identity.profile.publicId = generatePublicId()
  identity.updatedAt = Date.now()

  writeIdentity(identity)
  return makeState(identity)
}

async function handleIncomingMessage(msg: any): Promise<void> {
  try {
    await initCrypto()
    const keys = getIdentityKeys()
    if (!keys) return

    const contact = getContactByPublicId(msg.senderId) as any
    if (!contact) return // Unknown sender

    if (typeof contact.x_public_key !== 'string') return

    const myPrivate = Buffer.from(keys.exchange.privateKey, 'base64')
    const theirPublic = Buffer.from(contact.x_public_key, 'base64')
    const sessionKey = await deriveSessionKey(myPrivate, theirPublic)

    const packet = {
      ciphertext: msg.data.ciphertext,
      nonce: msg.data.nonce,
      signature: msg.data.signature
    }
    const plaintext = await decryptMessage(packet, sessionKey, Buffer.from(contact.ed_public_key, 'base64'))

    const message = {
      id: msg.data.id,
      conversationId: msg.data.conversationId,
      contactId: contact.id,
      direction: 'incoming' as const,
      plaintext,
      ciphertext: msg.data.ciphertext,
      nonce: msg.data.nonce,
      signature: msg.data.signature,
      deliveryStatus: 'delivered',
      messageType: 'TEXT',
      isEdited: false,
      isDeleted: false,
      createdAt: msg.timestamp
    }
    storeMessage(message)
  } catch (err) {
    console.error('Failed to handle incoming message:', err)
  }
}
