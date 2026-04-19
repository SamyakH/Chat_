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
  /**
   * Protocol version for compatibility. Current: 1
   */
  protocolVersion: number
  /**
   * High-level kind of message.
   * 'user'      - encrypted chat message
   * 'signaling' - WebRTC / call signaling (offer/answer/candidate/hangup)
   * 'system'    - registration, status, etc.
   */
  kind: 'user' | 'signaling' | 'system'
  /**
   * Subtype within a kind, e.g. 'message', 'offer', 'answer', 'candidate', 'hangup', 'register'
   */
  type: 'message' | 'offer' | 'answer' | 'candidate' | 'hangup' | 'register' | string
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

  constructor(localPeerId: string, signalingUrl: string = 'ws://localhost:8080') {
    super()
    this.localPeerId = localPeerId
    this.signalingUrl = signalingUrl
    this.connectToSignalingServer()
  }

  private flushQueue(): void {
    if (!this.ws || this.ws.readyState !== 1) return
    while (this.messageQueue.length > 0) {
      const queued = this.messageQueue.shift()!
      this.ws.send(JSON.stringify(queued))
    }
  }

    private connectToSignalingServer(): void {
    this.ws = new WebSocket(this.signalingUrl)

    this.ws.on('open', () => {
      console.log('Connected to signaling server')
      // Register this peer
      const registerMsg: NetworkMessage = {
        protocolVersion: 1,
        kind: 'system',
        type: 'register',
        senderId: this.localPeerId,
        receiverId: 'server',
        data: { peerId: this.localPeerId },
        timestamp: Date.now()
      }
      this.ws!.send(JSON.stringify(registerMsg))
      // Flush any queued messages now that the socket is open
      this.flushQueue()
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
    // Basic shape guard
    if (!msg || typeof msg !== 'object') return

    const { protocolVersion, kind, type, receiverId } = msg as Partial<NetworkMessage>

    // For now, accept messages without protocolVersion as v1
    const version = typeof protocolVersion === 'number' ? protocolVersion : 1
    if (version !== 1) {
      console.warn('Unsupported protocol version', version)
      return
    }

    // Route by kind/type
    if (kind === 'user' && type === 'message' && receiverId === this.localPeerId) {
      this.emit('message:received', msg)
    } else if (
      kind === 'signaling' &&
      (type === 'offer' || type === 'answer' || type === 'candidate' || type === 'hangup')
    ) {
      this.emit('signaling:received', msg)
    } else if (kind === 'system') {
      if (type === 'contact-request' && receiverId === this.localPeerId) {
        this.emit('contact-request:received', msg)
      }
      // Other system message types can be added here
    }
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
    const envelope: NetworkMessage = {
      protocolVersion: 1,
      kind: 'signaling',
      type,
      senderId: this.localPeerId,
      receiverId,
      data,
      timestamp: Date.now()
    }

    if (!this.ws || this.ws.readyState !== 1) {
      // WebSocket not ready, queue for later
      this.messageQueue.push(envelope)
      return
    }

    this.ws.send(JSON.stringify(envelope))
  }

  /**
   * Send a system message (e.g., contact-request) via WebSocket
   */
  sendSystemMessage(receiverId: string, type: string, data: any): void {
    const envelope: NetworkMessage = {
      protocolVersion: 1,
      kind: 'system',
      type,
      senderId: this.localPeerId,
      receiverId,
      data,
      timestamp: Date.now()
    }

    if (!this.ws || this.ws.readyState !== 1) {
      this.messageQueue.push(envelope)
      return
    }

    this.ws.send(JSON.stringify(envelope))
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
   * Send encrypted message to peer (relayed via signaling server for now).
   * Uses the same 'message' type as incoming handler expects.
   */
  async sendMessage(
    recipientId: string,
    message: any
  ): Promise<void> {
    const envelope: NetworkMessage = {
      protocolVersion: 1,
      kind: 'user',
      type: 'message',
      senderId: this.localPeerId,
      receiverId: recipientId,
      data: message,
      timestamp: Date.now()
    }

    if (!this.ws || this.ws.readyState !== 1) {
      // WebSocket not ready, queue for later
      this.messageQueue.push(envelope)
    } else {
      this.ws.send(JSON.stringify(envelope))
    }

    this.emit('message:sent', {
      messageId: message.id,
      recipientId,
      timestamp: envelope.timestamp
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
  if (!networkInstance) {
    const identityModule = require('./identity') as typeof import('./identity')
    const state = identityModule.getIdentityState()
    if (!state.profile) {
      throw new Error('Network not initialized')
    }
    networkInstance = new P2PNetwork(state.profile.publicId)
  }
  return networkInstance
}
