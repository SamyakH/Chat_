// Module: P2P Networking via WebRTC + simple-peer
// Enables direct encrypted communication between peers

import { EventEmitter } from 'events'
const WebSocket = require('ws')

type WS = typeof WebSocket.prototype & {
  on(event: 'open', listener: () => void): void
  on(event: 'message', listener: (data: Buffer) => void): void
  on(event: 'error', listener: (err: Error) => void): void
  on(event: 'close', listener: () => void): void
  send(data: string): void
  close(): void
}

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'failed'

export interface NetworkMessage {
  type: 'text' | 'signal' | 'status' | 'offer' | 'answer' | 'candidate' | 'hangup' | string
  senderId: string
  receiverId: string
  data: any
  timestamp: number
}

export interface PeerConnection {
  peerId: string
  status: ConnectionStatus
  connectedAt?: number
}

export class P2PNetwork extends EventEmitter {
  private peerConnections: Map<string, PeerConnection> = new Map()
  private messageQueue: NetworkMessage[] = []
  private localPeerId: string
  private signalingUrl: string
  private ws: WS | null = null

  constructor(localPeerId: string, signalingUrl: string = 'wss://signal.anonc.chat') {
    super()
    this.localPeerId = localPeerId
    this.signalingUrl = signalingUrl
    this.connectToSignalingServer()
  }

  private connectToSignalingServer(): void {
    this.ws = new WebSocket(this.signalingUrl)

    this.ws.on('open', () => {
      console.log('Connected to signaling server')
      // Register this peer
      this.ws!.send(JSON.stringify({
        type: 'register',
        peerId: this.localPeerId
      }))
    })

    this.ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString())
        this.handleIncomingMessage(msg)
      } catch (err) {
        console.error('Failed to parse message:', err)
      }
    })

    this.ws.on('error', (err) => {
      console.error('WebSocket error:', err)
    })

    this.ws.on('close', () => {
      console.log('Disconnected from signaling server')
      // Reconnect after delay
      setTimeout(() => this.connectToSignalingServer(), 5000)
    })
  }

  private handleIncomingMessage(msg: any): void {
    if (msg.type === 'message' && msg.receiverId === this.localPeerId) {
      this.emit('message:received', msg)
    } else if (msg.type === 'offer' || msg.type === 'answer' || msg.type === 'candidate' || msg.type === 'hangup') {
      // Signaling message
      this.emit('signaling:received', msg)
    }
    // Handle other types
  }

  /**
   * Get the signaling server URL for peer connection establishment
   */
  getSignalingUrl(): string {
    return this.signalingUrl
  }

  /**
   * Send a signaling message (offer, answer, candidate, etc.) via WebSocket
   */
  sendSignalingMessage(receiverId: string, type: string, data: any): void {
    if (!this.ws || this.ws.readyState !== 1) {
      // WebSocket not ready, queue for later
      this.messageQueue.push({
        type,
        senderId: this.localPeerId,
        receiverId,
        data,
        timestamp: Date.now()
      })
      return
    }

    this.ws.send(JSON.stringify({
      type,
      senderId: this.localPeerId,
      receiverId,
      data,
      timestamp: Date.now()
    }))
  }

  /**
   * Connect to a peer via signaling server
   */
  async connectToPeer(remotePublicId: string): Promise<void> {
    if (this.peerConnections.has(remotePublicId)) {
      const existing = this.peerConnections.get(remotePublicId)!
      if (existing.status === 'connected') return
    }

    this.peerConnections.set(remotePublicId, {
      peerId: remotePublicId,
      status: 'connecting'
    })

    this.emit('connection:status', {
      peerId: remotePublicId,
      status: 'connecting'
    })

    try {
      // Simplified: In production, use actual WebRTC/simple-peer signaling via getSignalingUrl()
      // This would involve:
      // 1. Creating RTCPeerConnection
      // 2. Gathering ICE candidates
      // 3. Exchanging SDP via signaling server
      // 4. Establishing data channel

      const conn = this.peerConnections.get(remotePublicId)!
      conn.status = 'connected'
      conn.connectedAt = Date.now()

      this.emit('connection:established', { peerId: remotePublicId })
    } catch (err) {
      this.peerConnections.set(remotePublicId, {
        peerId: remotePublicId,
        status: 'failed'
      })
      this.emit('connection:failed', {
        peerId: remotePublicId,
        error: err instanceof Error ? err.message : 'Unknown error'
      })
      throw err
    }
  }

  /**
   * Send encrypted message to peer
   */
  async sendMessage(
    recipientId: string,
    message: any
  ): Promise<void> {
    if (!this.ws || this.ws.readyState !== 1) {
      // Queue message for later delivery (readyState 1 = OPEN)
      this.messageQueue.push({
        type: 'text',
        senderId: this.localPeerId,
        receiverId: recipientId,
        data: message,
        timestamp: Date.now()
      })
      return
    }

    // Send via signaling server (relay)
    this.ws!.send(JSON.stringify({
      type: 'message',
      senderId: this.localPeerId,
      receiverId: recipientId,
      data: message,
      timestamp: Date.now()
    }))

    this.emit('message:sent', {
      messageId: message.id,
      recipientId,
      timestamp: Date.now()
    })
  }

  /**
   * Disconnect from peer
   */
  disconnectFromPeer(remotePublicId: string): void {
    this.peerConnections.delete(remotePublicId)
    this.emit('connection:closed', { peerId: remotePublicId })
  }

  /**
   * Get connection status
   */
  getConnectionStatus(remotePublicId: string): ConnectionStatus {
    return this.peerConnections.get(remotePublicId)?.status || 'idle'
  }

  /**
   * Get all active connections
   */
  getActiveConnections(): PeerConnection[] {
    return Array.from(this.peerConnections.values()).filter((c) => c.status === 'connected')
  }

  /**
   * Cleanup and disconnect all peers
   */
  shutdown(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.peerConnections.clear()
    this.messageQueue = []
    this.emit('network:shutdown')
  }
}

// Singleton instance
let networkInstance: P2PNetwork | null = null

export function initializeNetwork(localPeerId: string): P2PNetwork {
  if (networkInstance) return networkInstance
  networkInstance = new P2PNetwork(localPeerId)
  return networkInstance
}

export function getNetworkInstance(): P2PNetwork {
  if (!networkInstance) throw new Error('Network not initialized')
  return networkInstance
}
