import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { randomUUID } from 'crypto'
import { requireUnlocked } from './identity'

// Using better-sqlite3 (synchronous, fast)
// Note: For production, replace with @journeyapps/sqlcipher for full AES-256-GCM encryption
let db: import('better-sqlite3').Database | null = null

export function getDbPath(): string {
  const dir = path.join(app.getPath('userData'), 'anon-chat')
  fs.mkdirSync(dir, { recursive: true })
  return path.join(dir, 'chat.db')
}

export function initStorage(): void {
  requireUnlocked()
  if (db) return

  // Dynamic require keeps native module out of renderer bundle
  const Database = require('better-sqlite3') as typeof import('better-sqlite3')
  db = new Database(getDbPath())

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('temp_store = MEMORY')

  db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id           TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      fingerprint  TEXT NOT NULL UNIQUE,
      ed_public_key TEXT NOT NULL,
      x_public_key  TEXT NOT NULL,
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
      delivery_status TEXT NOT NULL DEFAULT 'sent',
      message_type    TEXT NOT NULL DEFAULT 'TEXT',
      is_edited       INTEGER DEFAULT 0,
      is_deleted      INTEGER DEFAULT 0,
      created_at      INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
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
  `)
}

function getDb(): import('better-sqlite3').Database {
  if (!db) throw new Error('Storage not initialized. Call initStorage() first.')
  return db
}

export function closeStorage(): void {
  if (db) {
    try { db.close() } catch { /* ignore */ }
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
}): void {
  getDb()
    .prepare(`
      INSERT OR REPLACE INTO contacts
        (id, display_name, fingerprint, ed_public_key, x_public_key, note, created_at)
      VALUES (?,?,?,?,?,?,?)
    `)
    .run(
      contact.id,
      contact.displayName,
      contact.fingerprint,
      contact.edPublicKey,
      contact.xPublicKey,
      contact.note ?? '',
      Date.now()
    )
}

export function loadContacts(): unknown[] {
  return getDb()
    .prepare('SELECT * FROM contacts WHERE is_blocked = 0 ORDER BY created_at DESC')
    .all()
}

export function blockContact(id: string): void {
  getDb().prepare('UPDATE contacts SET is_blocked = 1 WHERE id = ?').run(id)
}

export function deleteContact(id: string): void {
  getDb().prepare('DELETE FROM contacts WHERE id = ?').run(id)
}

// ── Messages ──────────────────────────────────────────────────────────────────

export function storeMessage(msg: {
  id: string
  conversationId: string
  contactId: string
  direction: 'incoming' | 'outgoing'
  plaintext: string
  deliveryStatus?: string
}): void {
  const d = getDb()

  // Create conversation row if it doesn't exist
  d.prepare(`
    INSERT OR IGNORE INTO conversations (id, contact_id, created_at)
    VALUES (?,?,?)
  `).run(msg.conversationId, msg.contactId, Date.now())

  d.prepare(`
    INSERT INTO messages
      (id, conversation_id, contact_id, direction, plaintext, delivery_status, created_at)
    VALUES (?,?,?,?,?,?,?)
  `).run(
    msg.id,
    msg.conversationId,
    msg.contactId,
    msg.direction,
    msg.plaintext,
    msg.deliveryStatus ?? 'sent',
    Date.now()
  )

  d.prepare(`
    UPDATE conversations
    SET last_activity_at = ?, message_count = message_count + 1
    WHERE id = ?
  `).run(Date.now(), msg.conversationId)
}

export function loadMessages(conversationId: string): unknown[] {
  return getDb()
    .prepare(`
      SELECT * FROM messages
      WHERE conversation_id = ? AND is_deleted = 0
      ORDER BY created_at ASC
    `)
    .all(conversationId)
}

export function updateDeliveryStatus(
  messageId: string,
  status: 'sent' | 'delivered' | 'failed'
): void {
  getDb()
    .prepare('UPDATE messages SET delivery_status = ? WHERE id = ?')
    .run(status, messageId)
}

export function softDeleteMessage(messageId: string): void {
  getDb().prepare('UPDATE messages SET is_deleted = 1 WHERE id = ?').run(messageId)
}

// ── Nonce tracking ────────────────────────────────────────────────────────────

export function trackNonce(nonceValue: string): boolean {
  const d = getDb()
  // Purge expired nonces first
  d.prepare('DELETE FROM session_nonces WHERE expires_at < ?').run(Date.now())

  const exists = d
    .prepare('SELECT id FROM session_nonces WHERE nonce_value = ?')
    .get(nonceValue)

  if (exists) return false // Replay detected

  d.prepare(`
    INSERT INTO session_nonces (id, nonce_value, used_at, expires_at)
    VALUES (?,?,?,?)
  `).run(randomUUID(), nonceValue, Date.now(), Date.now() + 86_400_000)

  return true
}