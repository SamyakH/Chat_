interface CallState {
  active: boolean
  contactId: string | null
  isIncoming: boolean
  hasLocalVideo: boolean
  hasLocalAudio: boolean
  hasRemoteVideo: boolean
  hasRemoteAudio: boolean
}

// Minimal event emitter for browser/Electron renderer
type Listener = (...args: unknown[]) => void

class SimpleEmitter {
  private listeners: Map<string, Listener[]> = new Map()

  on(event: string, fn: Listener): void {
    const arr = this.listeners.get(event) ?? []
    arr.push(fn)
    this.listeners.set(event, arr)
  }

  off(event: string, fn: Listener): void {
    const arr = this.listeners.get(event)
    if (!arr) return
    this.listeners.set(
      event,
      arr.filter((l) => l !== fn)
    )
  }

  emit(event: string, ...args: unknown[]): void {
    const arr = this.listeners.get(event)
    if (!arr) return
    for (const fn of arr) {
      try {
        fn(...args)
      } catch (err) {
        console.error('SimpleEmitter listener error', err)
      }
    }
  }
}

export class WebRTCManager extends SimpleEmitter {
  private static instance: WebRTCManager
  private peerConnection: RTCPeerConnection | null = null
  private dataChannel: RTCDataChannel | null = null
  private localStream: MediaStream | null = null
  private remoteStream: MediaStream | null = null
  private callState: CallState = {
    active: false,
    contactId: null,
    isIncoming: false,
    hasLocalVideo: false,
    hasLocalAudio: false,
    hasRemoteVideo: false,
    hasRemoteAudio: false
  }

  private constructor() {
    super()
    this.setupSignalingListener()
  }

  static getInstance(): WebRTCManager {
    if (!WebRTCManager.instance) {
      WebRTCManager.instance = new WebRTCManager()
    }
    return WebRTCManager.instance
  }

  private setupSignalingListener(): void {
    window.api.onSignalingMessage((msg) => {
      this.handleSignalingMessage(msg)
    })
  }

  private createPeerConnection(): RTCPeerConnection {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    })

    pc.onicecandidate = (e) => {
      if (e.candidate && this.callState.contactId) {
        window.api.sendSignalingCandidate({
          contactId: this.callState.contactId,
          candidate: e.candidate
        })
      }
    }

    pc.ontrack = (e) => {
      this.remoteStream = e.streams[0]
      this.emit('remote-stream', this.remoteStream)
    }

    pc.ondatachannel = (e) => {
      this.dataChannel = e.channel
      this.setupDataChannel(this.dataChannel)
    }

    pc.onconnectionstatechange = () => {
      this.emit('connection-state', pc.connectionState)
    }

    return pc
  }

  private setupDataChannel(dc: RTCDataChannel): void {
    dc.onopen = () => this.emit('datachannel-open')
    dc.onmessage = (e) => this.emit('datachannel-message', JSON.parse(e.data))
    dc.onclose = () => this.emit('datachannel-close')
  }

  async startCall(
    contactId: string,
    enableVideo: boolean = true,
    enableAudio: boolean = true
  ): Promise<void> {
    this.peerConnection = this.createPeerConnection()

    // Setup data channel
    this.dataChannel = this.peerConnection.createDataChannel('messages')
    this.setupDataChannel(this.dataChannel)

    // Get media
    this.localStream = await navigator.mediaDevices.getUserMedia({
      video: enableVideo,
      audio: enableAudio
    })

    // Add tracks
    this.localStream.getTracks().forEach((track) => {
      this.peerConnection!.addTrack(track, this.localStream!)
    })

    this.callState = {
      active: true,
      contactId,
      isIncoming: false,
      hasLocalVideo: enableVideo,
      hasLocalAudio: enableAudio,
      hasRemoteVideo: false,
      hasRemoteAudio: false
    }

    // Create offer
    const offer = await this.peerConnection.createOffer()
    await this.peerConnection.setLocalDescription(offer)

    window.api.sendCallOffer(contactId, offer)
    this.emit('local-stream', this.localStream)
    this.emit('call-started', this.callState)
  }

  async acceptCall(): Promise<void> {
    if (!this.peerConnection) return

    this.localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    })

    this.localStream.getTracks().forEach((track) => {
      this.peerConnection!.addTrack(track, this.localStream!)
    })

    const answer = await this.peerConnection.createAnswer()
    await this.peerConnection.setLocalDescription(answer)

    window.api.sendCallAnswer(this.callState.contactId!, answer)
    this.emit('local-stream', this.localStream)
  }

  async handleSignalingMessage(msg: unknown): Promise<void> {
    if (!msg || typeof msg !== 'object') return

    // msgs from main: { protocolVersion, kind, type, senderId, receiverId, data, timestamp }
    const { type, data, senderId } = msg as {
      type?: string
      data?: unknown
      senderId?: string
    }

    if (type === 'hangup') {
      // Remote party ended the call
      this.endCall()
      return
    }

    if (!this.peerConnection) {
      this.peerConnection = this.createPeerConnection()
    }

    if (type === 'offer') {
      if (!data) return
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data as RTCSessionDescriptionInit))
      this.callState = {
        active: true,
        contactId: senderId ?? null,
        isIncoming: true,
        hasLocalVideo: false,
        hasLocalAudio: false,
        hasRemoteVideo: true,
        hasRemoteAudio: true
      }
      this.emit('incoming-call', this.callState)
    } else if (type === 'answer') {
      if (!data) return
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data as RTCSessionDescriptionInit))
    } else if (type === 'candidate') {
      if (!data) return
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(data))
    }
  }

  toggleVideo(): void {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        this.callState.hasLocalVideo = videoTrack.enabled
        this.emit('call-state', this.callState)
      }
    }
  }

  toggleAudio(): void {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        this.callState.hasLocalAudio = audioTrack.enabled
        this.emit('call-state', this.callState)
      }
    }
  }

  endCall(): void {
    if (this.dataChannel) {
      this.dataChannel.close()
      this.dataChannel = null
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop())
      this.localStream = null
    }

    if (this.peerConnection) {
      this.peerConnection.close()
      this.peerConnection = null
    }

    this.callState = {
      active: false,
      contactId: null,
      isIncoming: false,
      hasLocalVideo: false,
      hasLocalAudio: false,
      hasRemoteVideo: false,
      hasRemoteAudio: false
    }

    this.emit('call-ended')
  }

  getCallState(): CallState {
    return { ...this.callState }
  }
}

export const webrtc = WebRTCManager.getInstance()
