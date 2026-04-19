import { contextBridge, ipcRenderer } from 'electron'
import type { Api } from '../shared/api'

const api: Api = {
  // ── Identity ──────────────────────────────────────────────────────────────
  getIdentityState: () => ipcRenderer.invoke('identity:get-state'),
  createIdentity: (p: { displayName: string; statusLine: string; passcode: string }) =>
    ipcRenderer.invoke('identity:create', p),
  unlockIdentity: (p: { passcode: string }) => ipcRenderer.invoke('identity:unlock', p),
  lockIdentity: () => ipcRenderer.invoke('identity:lock'),
  updateIdentityProfile: (p: { displayName: string; statusLine: string }) =>
    ipcRenderer.invoke('identity:update-profile', p),
  regenerateIdentityId: () => ipcRenderer.invoke('identity:regenerate-id'),
  getQrCode: () => ipcRenderer.invoke('identity:get-qr-code'),
  burnAccount: () => ipcRenderer.invoke('identity:burn-account'),

  // ── Workspace ─────────────────────────────────────────────────────────────
  initWorkspace: () => ipcRenderer.invoke('workspace:init'),
  getWorkspaceSummary: () => ipcRenderer.invoke('workspace:get-summary'),

  // ── Contacts ──────────────────────────────────────────────────────────────
  listContacts: () => ipcRenderer.invoke('contacts:list'),
  listBlockedContacts: () => ipcRenderer.invoke('contacts:blocked:list'),
  listIncomingContactRequests: () => ipcRenderer.invoke('contacts:requests:list'),
  acceptContactRequest: (id: string) => ipcRenderer.invoke('contacts:request:accept', id),
  declineContactRequest: (id: string) => ipcRenderer.invoke('contacts:request:decline', id),
  addContact: (p: {
    displayName: string
    publicId: string
    edPublicKey: string
    xPublicKey: string
    note?: string
  }) => ipcRenderer.invoke('contacts:add', p),
  addContactFromQr: (p: { qrData: string }) => ipcRenderer.invoke('contacts:add-from-qr', p),
  deleteContact: (id: string) => ipcRenderer.invoke('contacts:delete', id),
  updateContact: (p: { id: string; displayName?: string; note?: string }) =>
    ipcRenderer.invoke('contacts:update', p),
  blockContact: (id: string) => ipcRenderer.invoke('contacts:block', id),
  unblockContact: (id: string) => ipcRenderer.invoke('contacts:unblock', id),

  // ── Messages ──────────────────────────────────────────────────────────────
  loadMessages: (conversationId: string) => ipcRenderer.invoke('messages:load', conversationId),
  sendMessage: (p: { contactId: string; conversationId: string; text: string }) =>
    ipcRenderer.invoke('messages:send', p),
  editMessage: (p: { messageId: string; text: string }) => ipcRenderer.invoke('messages:edit', p),
  deleteMessage: (messageId: string) => ipcRenderer.invoke('messages:delete', messageId),
  updateMessageStatus: (p: { messageId: string; status: 'sent' | 'delivered' | 'failed' }) =>
    ipcRenderer.invoke('messages:update-status', p),

  // ── Emergency Wipe ────────────────────────────────────────────────────────
  executeWipe: (p: { confirmation: 'DESTROY' }) => ipcRenderer.invoke('wipe:execute', p),

  // ── Calling ───────────────────────────────────────────────────────────────
  hangupCall: (contactId: string) => ipcRenderer.invoke('calls:hangup', contactId),
  sendSignalingMessage: (p: { contactId: string; type: string; data: any }) =>
    ipcRenderer.invoke('calls:signaling', p),
  sendSignalingCandidate: (p: { contactId: string; candidate: any }) =>
    ipcRenderer.invoke('calls:candidate', p),
  sendCallOffer: (contactId: string, offer: any) => ipcRenderer.invoke('calls:offer', contactId, offer),
  sendCallAnswer: (contactId: string, answer: any) => ipcRenderer.invoke('calls:answer-send', contactId, answer),
  onSignalingMessage: (callback: (msg: any) => void) => {
    ipcRenderer.on('signaling:message', (_, msg) => callback(msg))
  },

  onIncomingContactRequest: (callback) => {
    ipcRenderer.on('contacts:request:incoming', (_, req) => callback(req))
  },

  onMessageReceived: (callback) => {
    ipcRenderer.on('messages:received', (_, payload) => callback(payload))
  }
}

contextBridge.exposeInMainWorld('api', api)
