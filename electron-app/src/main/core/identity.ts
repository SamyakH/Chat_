import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { initCrypto, generateSigningKeyPair, generateExchangeKeyPair } from './cryptography'
import { storeIdentityKeys } from './storage'

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
    profile: isUnlocked && identity ? identity.profile : null
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

  writeIdentity(identity)
  
  // Store generated key pairs
  storeIdentityKeys(signingKeys, exchangeKeys)
  
  isUnlocked = true
  return makeState(identity)
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
  return makeState(identity)
}

export function lockIdentity(): IdentityState {
  isUnlocked = false
  return makeState(readIdentity())
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