/// <reference types="vite/client" />

declare global {
  interface Window {
    api: {
      // Identity
      getIdentityState: () => Promise<{
        hasIdentity: boolean
        isUnlocked: boolean
        profile: { displayName: string; statusLine: string; publicId: string } | null
      }>
      createIdentity: (payload: {
        displayName: string
        statusLine: string
        passcode: string
      }) => Promise<{
        hasIdentity: boolean
        isUnlocked: boolean
        profile: { displayName: string; statusLine: string; publicId: string } | null
      }>
      unlockIdentity: (payload: { passcode: string }) => Promise<{
        hasIdentity: boolean
        isUnlocked: boolean
        profile: { displayName: string; statusLine: string; publicId: string } | null
      }>
      lockIdentity: () => Promise<void>
      updateIdentityProfile: (payload: {
        displayName: string
        statusLine: string
      }) => Promise<void>
      regenerateIdentityId: () => Promise<void>
      getQrCode: () => Promise<{
        qrData: string
        publicId: string
        displayName: string
      }>

      // Workspace
      initWorkspace: () => Promise<void>
      getWorkspaceSummary: () => Promise<any>

      // Contacts
      listContacts: () => Promise<Array<{
        id: string
        displayName: string
        fingerprint: string
        edPublicKey: string
        xPublicKey: string
        note?: string
        isBlocked?: boolean
        createdAt: number
      }>>
      addContact: (payload: {
        displayName: string
        edPublicKey: string
        xPublicKey: string
        note?: string
      }) => Promise<{
        id: string
        displayName: string
        fingerprint: string
        edPublicKey: string
        xPublicKey: string
        note?: string
      }>
      addContactFromQr: (payload: { qrData: string }) => Promise<{
        id: string
        displayName: string
        fingerprint: string
        edPublicKey: string
        xPublicKey: string
        note?: string
      }>
      deleteContact: (id: string) => Promise<void>
      blockContact: (id: string) => Promise<void>

      // Messages
      loadMessages: (conversationId: string) => Promise<Array<{
        id: string
        conversationId: string
        contactId: string
        direction: 'incoming' | 'outgoing'
        plaintext: string
        ciphertext?: string
        nonce?: string
        signature?: string
        deliveryStatus?: string
        createdAt: number
      }>>
      sendMessage: (payload: {
        contactId: string
        conversationId: string
        text: string
      }) => Promise<{
        id: string
        conversationId: string
        contactId: string
        direction: 'outgoing'
        plaintext: string
        ciphertext?: string
        nonce?: string
        signature?: string
        deliveryStatus: string
      }>
      deleteMessage: (messageId: string) => Promise<void>
      updateMessageStatus: (payload: {
        messageId: string
        status: 'sent' | 'delivered' | 'failed'
      }) => Promise<void>

      // Emergency Wipe
      executeWipe: (payload: { confirmation: 'DESTROY' }) => Promise<void>
    }
  }
}
