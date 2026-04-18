import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // ── Identity ──────────────────────────────────────────────────────────────
  getIdentityState: () =>
    ipcRenderer.invoke('identity:get-state'),
  createIdentity: (p: { displayName: string; statusLine: string; passcode: string }) =>
    ipcRenderer.invoke('identity:create', p),
  unlockIdentity: (p: { passcode: string }) =>
    ipcRenderer.invoke('identity:unlock', p),
  lockIdentity: () =>
    ipcRenderer.invoke('identity:lock'),
  updateIdentityProfile: (p: { displayName: string; statusLine: string }) =>
    ipcRenderer.invoke('identity:update-profile', p),
  regenerateIdentityId: () =>
    ipcRenderer.invoke('identity:regenerate-id'),

  // ── Workspace ─────────────────────────────────────────────────────────────
  initWorkspace: () =>
    ipcRenderer.invoke('workspace:init'),
  getWorkspaceSummary: () =>
    ipcRenderer.invoke('workspace:get-summary'),

  // ── Contacts ──────────────────────────────────────────────────────────────
  listContacts: () =>
    ipcRenderer.invoke('contacts:list'),
  addContact: (p: {
    displayName: string
    edPublicKey: string
    xPublicKey: string
    note?: string
  }) => ipcRenderer.invoke('contacts:add', p),
  deleteContact: (id: string) =>
    ipcRenderer.invoke('contacts:delete', id),
  blockContact: (id: string) =>
    ipcRenderer.invoke('contacts:block', id),

  // ── Messages ──────────────────────────────────────────────────────────────
  loadMessages: (conversationId: string) =>
    ipcRenderer.invoke('messages:load', conversationId),
  sendMessage: (p: { contactId: string; conversationId: string; text: string }) =>
    ipcRenderer.invoke('messages:send', p),
  deleteMessage: (messageId: string) =>
    ipcRenderer.invoke('messages:delete', messageId),
  updateMessageStatus: (p: { messageId: string; status: 'sent' | 'delivered' | 'failed' }) =>
    ipcRenderer.invoke('messages:update-status', p),

  // ── Emergency Wipe ────────────────────────────────────────────────────────
  executeWipe: (p: { confirmation: 'DESTROY' }) =>
    ipcRenderer.invoke('wipe:execute', p)
})