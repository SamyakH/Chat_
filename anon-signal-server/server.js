// server.js
// Minimal signaling/relay server for Anon Chat
const WebSocket = require('ws')

const PORT = process.env.PORT || 8080
const wss = new WebSocket.Server({ port: PORT })

const peers = new Map() // peerId -> ws

function safeJsonParse(buf) {
  try {
    return JSON.parse(buf.toString())
  } catch {
    return null
  }
}

wss.on('connection', (ws) => {
  let peerId = null

  ws.on('message', (data) => {
    const msg = safeJsonParse(data)
    if (!msg || typeof msg !== 'object') return

    const { kind, type, senderId, receiverId, data: payload } = msg

    // Registration
    if (kind === 'system' && type === 'register') {
      peerId = senderId || (payload && payload.peerId) || null
      if (!peerId) {
        console.warn('Register message missing peerId', msg)
        return
      }
      peers.set(peerId, ws)
      console.log('Registered peer:', peerId)
      return
    }

    if (!receiverId) {
      console.warn('Message missing receiverId', msg)
      return
    }

    const targetWs = peers.get(receiverId)
    if (!targetWs || targetWs.readyState !== WebSocket.OPEN) {
      console.log(
        `No connected peer for receiverId=${receiverId}. Dropping type=${type} from senderId=${senderId}`
      )
      return
    }

    try {
      targetWs.send(JSON.stringify(msg))
      console.log(`Forwarded ${kind}/${type} from ${senderId} to ${receiverId}`)
    } catch (err) {
      console.error('Error forwarding message', err)
    }
  })

  ws.on('close', () => {
    if (peerId) {
      peers.delete(peerId)
      console.log('Peer disconnected:', peerId)
      peerId = null
    }
  })

  ws.on('error', (err) => {
    console.error('WebSocket error:', err)
  })
})

console.log(`Anon Chat signaling server listening on ws://localhost:${PORT}`)
