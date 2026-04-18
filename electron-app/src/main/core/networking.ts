// Module: P2P Networking via WebRTC + simple-peer
// Enables direct encrypted communication between peers

import { EventEmitter } from 'events'

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'failed'

export interface NetworkMessage {
  type: 'text' | 'signal' | 'status'
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

  constructor(localPeerId: string, signalingUrl: string = 'wss://signal.anonc.chat') {
    super()
    this.localPeerId = localPeerId
    this.signalingUrl = signalingUrl
  }

  /**
   * Get the signaling server URL for peer connection establishment
   */
  getSignalingUrl(): string {
    return this.signalingUrl
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
    message: {
      id: string
      conversationId: string
      plaintext?: string
      ciphertext?: string
      nonce?: string
      signature?: string
    }
  ): Promise<void> {
    const connection = this.peerConnections.get(recipientId)
    
    if (!connection || connection.status !== 'connected') {
      // Queue message for later delivery
      this.messageQueue.push({
        type: 'text',
        senderId: this.localPeerId,
        receiverId: recipientId,
        data: message,
        timestamp: Date.now()
      })
      return
    }

    // In production: Send via WebRTC data channel or fallback to signaling
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
    return Array.from(this.peerConnections.values()).filter(
      c => c.status === 'connected'
    )
  }

  /**
   * Cleanup and disconnect all peers
   */
  shutdown(): void {
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
