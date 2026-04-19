import { createHash, randomBytes } from 'crypto'

// Libsodium is async — call initCrypto() once before using anything
let sodium: typeof import('libsodium-wrappers').default | null = null

export async function initCrypto(): Promise<void> {
  if (sodium) return
  const lib = await import('libsodium-wrappers')
  await lib.default.ready
  sodium = lib.default
}

function getSodium() {
  if (!sodium) throw new Error('Crypto not initialized. Call initCrypto() first.')
  return sodium
}

export interface SigningKeyPair {
  publicKey: string // base64
  privateKey: string // base64
}

export interface ExchangeKeyPair {
  publicKey: string // base64
  privateKey: string // base64
}

export interface EncryptedPacket {
  ciphertext: string // base64
  nonce: string // base64
  signature: string // base64
}

// Generate Ed25519 signing key pair
export async function generateSigningKeyPair(): Promise<SigningKeyPair> {
  await initCrypto()
  const s = getSodium()
  const pair = s.crypto_sign_keypair()
  return {
    publicKey: Buffer.from(pair.publicKey).toString('base64'),
    privateKey: Buffer.from(pair.privateKey).toString('base64')
  }
}

// Generate X25519 key exchange pair
export async function generateExchangeKeyPair(): Promise<ExchangeKeyPair> {
  await initCrypto()
  const s = getSodium()
  const pair = s.crypto_box_keypair()
  return {
    publicKey: Buffer.from(pair.publicKey).toString('base64'),
    privateKey: Buffer.from(pair.privateKey).toString('base64')
  }
}

/**
 * Encrypt message with XSalsa20-Poly1305 (libsodium crypto_secretbox) + Ed25519 signature.
 * The symmetric key MUST be the output of deriveSessionKey(), which already applies HKDF.
 */
export async function encryptMessage(
  plaintext: string,
  sessionKey: Uint8Array,
  signingPrivateKey: Uint8Array
): Promise<EncryptedPacket> {
  await initCrypto()
  const s = getSodium()

  const nonce = randomBytes(s.crypto_secretbox_NONCEBYTES)
  const plaintextBytes = Buffer.from(plaintext, 'utf-8')

  const ciphertext = s.crypto_secretbox_easy(plaintextBytes, nonce, sessionKey)

  // Sign ciphertext + nonce together
  const toSign = Buffer.concat([Buffer.from(ciphertext), nonce])
  const signature = s.crypto_sign_detached(toSign, signingPrivateKey)

  return {
    ciphertext: Buffer.from(ciphertext).toString('base64'),
    nonce: Buffer.from(nonce).toString('base64'),
    signature: Buffer.from(signature).toString('base64')
  }
}

// Verify signature + decrypt
export async function decryptMessage(
  packet: EncryptedPacket,
  sessionKey: Uint8Array,
  signingPublicKey: Uint8Array
): Promise<string> {
  await initCrypto()
  const s = getSodium()

  const ciphertext = Buffer.from(packet.ciphertext, 'base64')
  const nonce = Buffer.from(packet.nonce, 'base64')
  const signature = Buffer.from(packet.signature, 'base64')

  // Verify BEFORE decrypting
  const toVerify = Buffer.concat([ciphertext, nonce])
  const valid = s.crypto_sign_verify_detached(signature, toVerify, signingPublicKey)
  if (!valid) throw new Error('Signature verification failed — message may be tampered.')

  const plaintext = s.crypto_secretbox_open_easy(ciphertext, nonce, sessionKey)
  if (!plaintext) throw new Error('Decryption failed.')

  return Buffer.from(plaintext).toString('utf-8')
}

/**
 * X25519 ECDH — derive shared session key using HKDF-SHA-256.
 * The returned key is suitable for crypto_secretbox (32 bytes).
 */
export async function deriveSessionKey(
  myPrivateKey: Uint8Array,
  theirPublicKey: Uint8Array
): Promise<Uint8Array> {
  await initCrypto()
  const s = getSodium()

  // Raw ECDH output (32 bytes)
  const sharedSecret = s.crypto_scalarmult(myPrivateKey, theirPublicKey)

  // HKDF context string to bind this key to messaging use
  const info = Buffer.from('anon-chat:session-key:v1', 'utf-8')
  const salt = new Uint8Array(32) // all zeros salt; could be randomized & stored if desired

  const prk = createHash('sha256')
    .update(Buffer.from(salt))
    .update(Buffer.from(sharedSecret))
    .digest()

  const okm = createHash('sha256')
    .update(prk)
    .update(info)
    .update(Buffer.from([0x01]))
    .digest()

  // crypto_secretbox key must be 32 bytes
  return new Uint8Array(okm.subarray(0, s.crypto_secretbox_KEYBYTES))
}

// Sign arbitrary payload
export async function signPayload(
  payload: Uint8Array,
  privateKey: Uint8Array
): Promise<Uint8Array> {
  await initCrypto()
  return getSodium().crypto_sign_detached(payload, privateKey)
}

// Verify arbitrary payload
export async function verifySignature(
  payload: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array
): Promise<boolean> {
  await initCrypto()
  return getSodium().crypto_sign_verify_detached(signature, payload, publicKey)
}

/**
 * SHA-256 fingerprint of two public keys.
 * Uses decoded base64 and separate updates to avoid ambiguity.
 */
export function computeFingerprint(edPub: string, xPub: string): string {
  return createHash('sha256')
    .update(Buffer.from(edPub, 'base64'))
    .update(Buffer.from(xPub, 'base64'))
    .digest('hex')
}

// Safely zero out a buffer
export function zeroize(buf: Buffer): void {
  buf.fill(0)
}
