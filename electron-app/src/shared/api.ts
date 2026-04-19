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
  publicId: string
  displayName: string
  fingerprint: string
  edPublicKey: string
  xPublicKey: string
  note: string
  isBlocked: boolean
  createdAt: number
  lastMessageAt: number | null
}

export interface Message {
  id: string
  conversationId: string
  contactId: string
  direction: 'incoming' | 'outgoing'
  plaintext: string
  ciphertext: string | null
  nonce: string | null
  signature: string | null
  deliveryStatus: 'sent' | 'delivered' | 'failed'
  messageType: string
  isEdited: boolean
  isDeleted: boolean
  createdAt: number
}

export interface WorkspaceSummary {
  profile: IdentityProfile
  contactCount: number
}

export interface QrCodePayload {
  qrData: string
  publicId: string
  displayName: string
  edPublicKey: string
  xPublicKey: string
}

export interface Api {
  getIdentityState(): Promise<IdentityState>
  createIdentity(p: {
    displayName: string
    statusLine: string
    passcode: string
  }): Promise<IdentityState>
  unlockIdentity(p: { passcode: string }): Promise<IdentityState>
  lockIdentity(): Promise<IdentityState>
  updateIdentityProfile(p: { displayName: string; statusLine: string }): Promise<IdentityState>
  regenerateIdentityId(): Promise<IdentityState>
  getQrCode(): Promise<QrCodePayload>
  burnAccount(): Promise<void>

  listIncomingContactRequests(): Promise<{
    id: string
    publicId: string
    displayName: string
    createdAt: number
  }[]>
  acceptContactRequest(requestId: string): Promise<{ ok: boolean }>
  declineContactRequest(requestId: string): Promise<{ ok: boolean }>

  initWorkspace(): Promise<{ ok: boolean }>
  getWorkspaceSummary(): Promise<WorkspaceSummary>

  listContacts(): Promise<Contact[]>
  listBlockedContacts(): Promise<Contact[]>
  addContact(p: {
    displayName: string
    publicId: string
    edPublicKey: string
    xPublicKey: string
    note?: string
  }): Promise<Contact>
  addContactFromQr(p: { qrData: string }): Promise<Contact>
  deleteContact(id: string): Promise<{ ok: boolean }>
  updateContact: (p: { id: string; displayName?: string; note?: string }) => Promise<Contact>
  blockContact(id: string): Promise<{ ok: boolean }>
  unblockContact(id: string): Promise<{ ok: boolean }>

  loadMessages(conversationId: string): Promise<Message[]>
  sendMessage(p: { contactId: string; conversationId: string; text: string }): Promise<Message>
  editMessage: (p: { messageId: string; text: string }) => Promise<Message>
  deleteMessage(messageId: string): Promise<{ ok: boolean }>
  updateMessageStatus(p: {
    messageId: string
    status: 'sent' | 'delivered' | 'failed'
  }): Promise<{ ok: boolean }>

  executeWipe(p: { confirmation: 'DESTROY' }): Promise<{ ok: boolean }>

  // Calling
  hangupCall: (contactId: string) => Promise<void>
  sendSignalingMessage: (p: { contactId: string; type: string; data: any }) => Promise<void>
  sendSignalingCandidate: (p: { contactId: string; candidate: any }) => Promise<void>
  sendCallOffer: (contactId: string, offer: any) => Promise<void>
  sendCallAnswer: (contactId: string, answer: any) => Promise<void>
  onSignalingMessage: (callback: (msg: any) => void) => void

   // Events
  onIncomingContactRequest: (callback: (req: {
    id: string
    publicId: string
    displayName: string
    createdAt: number
  }) => void) => void

  onMessageReceived: (callback: (p: { conversationId: string }) => void) => void

}
