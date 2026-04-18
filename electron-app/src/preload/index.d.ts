export interface IdentityProfile {
  displayName: string
  statusLine: string
  publicId: string
}

export interface IdentityState {
  hasIdentity: boolean
  isUnlocked: boolean
  profile: IdentityProfile | null
}

export interface Contact {
  id: string
  display_name: string
  fingerprint: string
  ed_public_key: string
  x_public_key: string
  note: string
  is_blocked: number
  created_at: number
  last_message_at: number | null
}

export interface Message {
  id: string
  conversation_id: string
  contact_id: string
  direction: 'incoming' | 'outgoing'
  plaintext: string
  delivery_status: 'sent' | 'delivered' | 'failed'
  message_type: string
  is_edited: number
  is_deleted: number
  created_at: number
}

declare global {
  interface Window {
    api: {
      getIdentityState(): Promise<IdentityState>
      createIdentity(p: { displayName: string; statusLine: string; passcode: string }): Promise<IdentityState>
      unlockIdentity(p: { passcode: string }): Promise<IdentityState>
      lockIdentity(): Promise<IdentityState>
      updateIdentityProfile(p: { displayName: string; statusLine: string }): Promise<IdentityState>
      regenerateIdentityId(): Promise<IdentityState>

      initWorkspace(): Promise<{ ok: boolean }>
      getWorkspaceSummary(): Promise<{ profile: IdentityProfile; contactCount: number }>

      listContacts(): Promise<Contact[]>
      addContact(p: { displayName: string; edPublicKey: string; xPublicKey: string; note?: string }): Promise<Contact>
      deleteContact(id: string): Promise<{ ok: boolean }>
      blockContact(id: string): Promise<{ ok: boolean }>

      loadMessages(conversationId: string): Promise<Message[]>
      sendMessage(p: { contactId: string; conversationId: string; text: string }): Promise<Message>
      deleteMessage(messageId: string): Promise<{ ok: boolean }>
      updateMessageStatus(p: { messageId: string; status: 'sent' | 'delivered' | 'failed' }): Promise<{ ok: boolean }>

      executeWipe(p: { confirmation: 'DESTROY' }): Promise<{ ok: boolean }>
    }
  }
}