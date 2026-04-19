import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { randomUUID } from 'crypto'
import Database from 'better-sqlite3'
import { computeFingerprint } from './cryptography'

// Using better-sqlite3 (synchronous, fast)
// Note: For production, replace with @journeyapps/sqlcipher for full AES-256-GCM encryption
let db: Database.Database | null = null

export function getDbPath(): string {
  const dir = path.join(app.getPath('userData'), 'anon-chat')
  fs.mkdirSync(dir, { recursive: true })
  return path.join(dir, 'chat.db')
}

function hasColumn(database: Database.Database, tableName: string, columnName: string): boolean {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>
  return columns.some((column) => column.name === columnName)
}

export function initStorage(): void {
  if (db) return

  // Dynamic require keeps native module out of renderer bundle
  db = new Database(getDbPath())

  const database = db!
  database.pragma('journal_mode = WAL')
  database.pragma('foreign_keys = ON')
  database.pragma('temp_store = MEMORY')

  database.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id           TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      fingerprint  TEXT NOT NULL UNIQUE,
      ed_public_key TEXT NOT NULL,
      x_public_key  TEXT NOT NULL,
      public_id    TEXT NOT NULL UNIQUE,
      note         TEXT DEFAULT '',
      is_blocked   INTEGER DEFAULT 0,
      created_at   INTEGER NOT NULL,
      last_message_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id              TEXT PRIMARY KEY,
      contact_id      TEXT NOT NULL,
      created_at      INTEGER NOT NULL,
      last_activity_at INTEGER,
      message_count   INTEGER DEFAULT 0,
      FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id              TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      contact_id      TEXT NOT NULL,
      direction       TEXT NOT NULL CHECK(direction IN ('incoming','outgoing')),
      plaintext       TEXT NOT NULL DEFAULT '',
      ciphertext      TEXT,
      nonce           TEXT,
      signature       TEXT,
      delivery_status TEXT NOT NULL DEFAULT 'sent',
      message_type    TEXT NOT NULL DEFAULT 'TEXT',
      is_edited       INTEGER DEFAULT 0,
      is_deleted      INTEGER DEFAULT 0,
      created_at      INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS identity_keys (
      key_type        TEXT PRIMARY KEY,
      public_key      TEXT NOT NULL,
      private_key     TEXT NOT NULL,
      created_at      INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS session_nonces (
      id          TEXT PRIMARY KEY,
      nonce_value TEXT NOT NULL UNIQUE,
      used_at     INTEGER NOT NULL,
      expires_at  INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_messages_contact ON messages(contact_id);
    CREATE INDEX IF NOT EXISTS idx_contacts_fp ON contacts(fingerprint);
    CREATE INDEX IF NOT EXISTS idx_nonces_exp ON session_nonces(expires_at);
    
    CREATE TABLE IF NOT EXISTS contact_requests (
      id                  TEXT PRIMARY KEY,
      remote_public_id    TEXT NOT NULL UNIQUE,
      display_name        TEXT NOT NULL,
      ed_public_key       TEXT NOT NULL,
      x_public_key        TEXT NOT NULL,
      direction           TEXT NOT NULL CHECK(direction IN ('incoming','outgoing')),
      status              TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined')),
      created_at          INTEGER NOT NULL,
      updated_at          INTEGER NOT NULL
    );
    
    CREATE INDEX IF NOT EXISTS idx_requests_status ON contact_requests(status);
    CREATE INDEX IF NOT EXISTS idx_requests_direction ON contact_requests(direction);
  `)
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Storage not initialized. Call initStorage() first.')
  return db
}

export function closeStorage(): void {
  if (db) {
    try {
      db.close()
    } catch {
      /* ignore */
    }
    db = null
  }
}

// ── Contacts ─────────────────────────────────────────────────────────────────

export function storeContact(contact: {
  id: string
  displayName: string
  fingerprint: string
  edPublicKey: string
  xPublicKey: string
  note?: string
  publicId: string
  createdAt?: number
}): void {
  const createdAt = contact.createdAt ?? Date.now()
  getDb()
    .prepare(
      `
      INSERT INTO contacts
        (id, display_name, fingerprint, ed_public_key, x_public_key, note, public_id, created_at)
      VALUES (?,?,?,?,?,?,?,?)
    `
    )
    .run(
      contact.id,
      contact.displayName,
      contact.fingerprint,
      contact.edPublicKey,
      contact.xPublicKey,
      contact.note ?? '',
      contact.publicId,
      createdAt
    )
}

export function loadContacts(): unknown[] {
  return getDb()
    .prepare('SELECT * FROM contacts WHERE is_blocked = 0 ORDER BY created_at DESC')
    .all()
}

export function getContactById(id: string): unknown | null {
  return (
    (getDb()
      .prepare('SELECT * FROM contacts WHERE id = ? AND is_blocked = 0')
      .get(id) as unknown) || null
  )
}
export function getContactByPublicId(publicId: string): unknown | null {
  return (
    (getDb()
      .prepare('SELECT * FROM contacts WHERE public_id = ? AND is_blocked = 0')
      .get(publicId) as any) || null
  )
}
export function blockContact(id: string): void {
  getDb().prepare('UPDATE contacts SET is_blocked = 1 WHERE id = ?').run(id)
}

export function loadBlockedContacts(): unknown[] {
  return getDb()
    .prepare('SELECT * FROM contacts WHERE is_blocked = 1 ORDER BY created_at DESC')
    .all()
}

export function unblockContact(id: string): void {
  getDb().prepare('UPDATE contacts SET is_blocked = 0 WHERE id = ?').run(id)
}

export function deleteContact(id: string): void {
  getDb().prepare('DELETE FROM contacts WHERE id = ?').run(id)
}

// ── Contact Requests ─────────────────────────────────────────────────────────

export function storeContactRequest(request: {
  id: string
  remotePublicId: string
  displayName: string
  edPublicKey: string
  xPublicKey: string
  direction: 'incoming' | 'outgoing'
  status?: 'pending' | 'accepted' | 'declined'
  createdAt?: number
  updatedAt?: number
}): void {
  const now = Date.now()
  getDb().prepare(`
    INSERT OR REPLACE INTO contact_requests
      (id, remote_public_id, display_name, ed_public_key, x_public_key, direction, status, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(
    request.id,
    request.remotePublicId,
    request.displayName,
    request.edPublicKey,
    request.xPublicKey,
    request.direction,
    request.status ?? 'pending',
    request.createdAt ?? now,
    request.updatedAt ?? now
  )
}

export function loadIncomingContactRequests(): {
  id: string
  publicId: string
  displayName: string
  createdAt: number
}[] {
  return getDb()
    .prepare('SELECT * FROM contact_requests WHERE direction = ? AND status = ? ORDER BY created_at DESC')
    .all('incoming', 'pending')
    .map((record: any) => ({
      id: record.id,
      publicId: record.remote_public_id,
      displayName: record.display_name,
      createdAt: record.created_at
    }))
}

export function acceptContactRequest(requestId: string): void {
  const db = getDb()
  const request = db
    .prepare('SELECT * FROM contact_requests WHERE id = ?')
    .get(requestId) as any

  if (!request) throw new Error('Contact request not found')

  db.transaction(() => {
    // Add contact to local database
    storeContact({
      id: request.id,
      displayName: request.display_name,
      fingerprint: computeFingerprint(request.ed_public_key, request.x_public_key),
      edPublicKey: request.ed_public_key,
      xPublicKey: request.x_public_key,
      note: 'Accepted contact request',
      createdAt: Date.now()
    })

    // Mark request as accepted
    db.prepare('UPDATE contact_requests SET status = ?, updated_at = ? WHERE id = ?')
      .run('accepted', Date.now(), requestId)
  })()
}

export function declineContactRequest(requestId: string): void {
  getDb().prepare('UPDATE contact_requests SET status = ?, updated_at = ? WHERE id = ?')
    .run('declined', Date.now(), requestId)
}

// ── Messages ──────────────────────────────────────────────────────────────────

export function storeMessage(msg: {
  id: string
  conversationId: string
  contactId: string
  direction: 'incoming' | 'outgoing'
  plaintext: string
  ciphertext?: string | null
  nonce?: string | null
  signature?: string | null
  deliveryStatus?: string
  createdAt?: number
}): void {
  const d = getDb()
  const createdAt = msg.createdAt ?? Date.now()

  // Create conversation row if it doesn't exist
  d.prepare(
    `
    INSERT OR IGNORE INTO conversations (id, contact_id, created_at)
    VALUES (?,?,?)
  `
  ).run(msg.conversationId, msg.contactId, createdAt)

  d.prepare(
    `
    INSERT INTO messages
      (id, conversation_id, contact_id, direction, plaintext, ciphertext, nonce, signature, delivery_status, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `
  ).run(
    msg.id,
    msg.conversationId,
    msg.contactId,
    msg.direction,
    msg.plaintext,
    msg.ciphertext || null,
    msg.nonce || null,
    msg.signature || null,
    msg.deliveryStatus ?? 'sent',
    createdAt
  )

  d.prepare(
    `
    UPDATE conversations
    SET last_activity_at = ?, message_count = message_count + 1
    WHERE id = ?
  `
  ).run(createdAt, msg.conversationId)
}

export function loadMessages(conversationId: string): unknown[] {
  return getDb()
    .prepare(
      `
      SELECT * FROM messages
      WHERE conversation_id = ? AND is_deleted = 0
      ORDER BY created_at ASC
    `
    )
    .all(conversationId)
}

export function updateDeliveryStatus(
  messageId: string,
  status: 'sent' | 'delivered' | 'failed'
): void {
  getDb().prepare('UPDATE messages SET delivery_status = ? WHERE id = ?').run(status, messageId)
}

export function softDeleteMessage(messageId: string): void {
  getDb().prepare('UPDATE messages SET is_deleted = 1 WHERE id = ?').run(messageId)
}

// ── Nonce tracking ────────────────────────────────────────────────────────────

export function trackNonce(nonceValue: string): boolean {
  const d = getDb()
  // Purge expired nonces first
  d.prepare('DELETE FROM session_nonces WHERE expires_at < ?').run(Date.now())

  const exists = d.prepare('SELECT id FROM session_nonces WHERE nonce_value = ?').get(nonceValue)

  if (exists) return false // Replay detected

  d.prepare(
    `
    INSERT INTO session_nonces (id, nonce_value, used_at, expires_at)
    VALUES (?,?,?,?)
  `
  ).run(randomUUID(), nonceValue, Date.now(), Date.now() + 86_400_000)

  return true
}

// ── Identity Key Pairs ────────────────────────────────────────────────────────

export function storeIdentityKeys(
  signingKeys: {
    publicKey: string
    privateKey: string
  },
  exchangeKeys: {
    publicKey: string
    privateKey: string
  }
): void {
  const d = getDb()
  d.prepare(
    `
    INSERT OR REPLACE INTO identity_keys (key_type, public_key, private_key, created_at)
    VALUES (?, ?, ?, ?)
  `
  ).run('signing', signingKeys.publicKey, signingKeys.privateKey, Date.now())

  d.prepare(
    `
    INSERT OR REPLACE INTO identity_keys (key_type, public_key, private_key, created_at)
    VALUES (?, ?, ?, ?)
  `
  ).run('exchange', exchangeKeys.publicKey, exchangeKeys.privateKey, Date.now())
}

export function getIdentityKeys(): {
  signing: { publicKey: string; privateKey: string }
  exchange: { publicKey: string; privateKey: string }
} | null {
  const d = getDb()
  const signing = d
    .prepare('SELECT public_key, private_key FROM identity_keys WHERE key_type = ?')
    .get('signing') as any
  const exchange = d
    .prepare('SELECT public_key, private_key FROM identity_keys WHERE key_type = ?')
    .get('exchange') as any

  if (!signing || !exchange) return null

  return {
    signing: { publicKey: signing.public_key, privateKey: signing.private_key },
    exchange: { publicKey: exchange.public_key, privateKey: exchange.private_key }
  }
}
