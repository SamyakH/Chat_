import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { registerIdentityIpc } from './ipc/identity.ipc'
import { registerWorkspaceIpc } from './ipc/workspace.ipc'
import { registerContactsIpc } from './ipc/contacts.ipc'
import { registerMessagesIpc } from './ipc/messages.ipc'
import { registerWipeIpc } from './ipc/wipe.ipc'

const isDev = !app.isPackaged
let ipcRegistered = false

function registerIpcHandlers(): void {
  if (ipcRegistered) return

  registerIdentityIpc(ipcMain)
  registerWorkspaceIpc(ipcMain)
  registerContactsIpc(ipcMain)
  registerMessagesIpc(ipcMain)
  registerWipeIpc(ipcMain)

  ipcRegistered = true
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#030712',
    title: 'Anon Chat',
    frame: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
