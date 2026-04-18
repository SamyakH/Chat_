import { useEffect, useRef, useState } from 'react'
import { PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react'
import { webrtc } from '../core/webrtc-manager'

interface CallWindowProps {
  onClose: () => void
}

export default function CallWindow({ onClose }: CallWindowProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const [callState, setCallState] = useState(webrtc.getCallState())

  useEffect(() => {
    const onLocalStream = (stream: MediaStream) => {
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }
    }

    const onRemoteStream = (stream: MediaStream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream
      }
    }

    const onState = (state: any) => setCallState(state)
    const onEnd = () => onClose()

    webrtc.on('local-stream', onLocalStream)
    webrtc.on('remote-stream', onRemoteStream)
    webrtc.on('call-state', onState)
    webrtc.on('call-ended', onEnd)

    return () => {
      webrtc.off('local-stream', onLocalStream)
      webrtc.off('remote-stream', onRemoteStream)
      webrtc.off('call-state', onState)
      webrtc.off('call-ended', onEnd)
    }
  }, [onClose])

  const toggleVideo = () => webrtc.toggleVideo()
  const toggleAudio = () => webrtc.toggleAudio()
  const endCall = () => webrtc.endCall()

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
      {/* Remote Video */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        muted={false}
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Local Video PiP */}
      <div className="absolute bottom-20 right-6 w-48 h-36 rounded-xl overflow-hidden shadow-2xl border border-gray-700">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover transform scale-x-[-1]"
        />
      </div>

      {/* Controls Bar */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-black/50 backdrop-blur-lg px-8 py-4 rounded-2xl">
        <button
          onClick={toggleAudio}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
            callState.hasLocalAudio
              ? 'bg-gray-700 hover:bg-gray-600'
              : 'bg-red-600 hover:bg-red-500'
          }`}
        >
          {callState.hasLocalAudio ? (
            <Mic className="w-5 h-5 text-white" />
          ) : (
            <MicOff className="w-5 h-5 text-white" />
          )}
        </button>

        <button
          onClick={toggleVideo}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
            callState.hasLocalVideo
              ? 'bg-gray-700 hover:bg-gray-600'
              : 'bg-red-600 hover:bg-red-500'
          }`}
        >
          {callState.hasLocalVideo ? (
            <Video className="w-5 h-5 text-white" />
          ) : (
            <VideoOff className="w-5 h-5 text-white" />
          )}
        </button>

        <button
          onClick={endCall}
          className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-colors"
        >
          <PhoneOff className="w-6 h-6 text-white" />
        </button>
      </div>
    </div>
  )
}
