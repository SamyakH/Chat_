import { EventEmitter } from 'events'

interface CallState {
  active: boolean
  contactId: string | null
  isIncoming: boolean
  hasLocalVideo: boolean
  hasLocalAudio: boolean
  hasRemoteVideo: boolean
  hasRemoteAudio: boolean
}

export class WebRTCManager extends EventEmitter {
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
      if (e.candidate) {
        window.api.sendSignalingCandidate(e.candidate)
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

  async startCall(contactId: string, enableVideo: boolean = true, enableAudio: boolean = true): Promise<void> {
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
    this.localStream.getTracks().forEach(track => {
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

    this.localStream.getTracks().forEach(track => {
      this.peerConnection!.addTrack(track, this.localStream!)
    })

    const answer = await this.peerConnection.createAnswer()
    await this.peerConnection.setLocalDescription(answer)

    window.api.sendCallAnswer(this.callState.contactId!, answer)
    this.emit('local-stream', this.localStream)
  }

  async handleSignalingMessage(msg: any): Promise<void> {
    if (!this.peerConnection) {
      this.peerConnection = this.createPeerConnection()
    }

    if (msg.type === 'offer') {
      await this.peerConnection.setRemoteDescription(msg.offer)
      this.callState = {
        active: true,
        contactId: msg.contactId,
        isIncoming: true,
        hasLocalVideo: false,
        hasLocalAudio: false,
        hasRemoteVideo: true,
        hasRemoteAudio: true
      }
      this.emit('incoming-call', this.callState)
    } else if (msg.type === 'answer') {
      await this.peerConnection.setRemoteDescription(msg.answer)
    } else if (msg.type === 'candidate') {
      await this.peerConnection.addIceCandidate(msg.candidate)
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
      this.localStream.getTracks().forEach(track => track.stop())
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