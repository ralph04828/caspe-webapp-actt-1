import React, { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCalls } from '../context/CallContext';
import { AvatarImage } from './AvatarImage';
import {
  AlertCircle,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  RefreshCw,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const CallOverlayModal: React.FC = () => {
  const { userProfile } = useAuth();
  const {
    activeCall,
    incomingCall,
    localStream,
    remoteStream,
    isMuted,
    isCameraOff,
    speakerEnabled,
    callSeconds,
    callError,
    clearCallError,
    acceptIncomingCall,
    declineIncomingCall,
    endCurrentCall,
    toggleMute,
    toggleCamera,
    flipCamera,
    toggleSpeaker,
  } = useCalls();

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream || null;
    }
  }, [localStream, activeCall?.id]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream || null;
      remoteVideoRef.current.muted = !speakerEnabled;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream || null;
      remoteAudioRef.current.muted = !speakerEnabled;
    }
  }, [remoteStream, speakerEnabled, activeCall?.id]);

  if (!activeCall && !incomingCall && !callError) return null;

  if (!activeCall && !incomingCall && callError) {
    return (
      <div
        role="alert"
        className="fixed top-4 right-4 z-[95] max-w-sm p-3.5 rounded-card border border-red-500/40 bg-red-950 text-red-100 shadow-2xl flex items-start gap-2.5 text-xs"
      >
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <span className="flex-1 leading-relaxed">{callError}</span>
        <button
          type="button"
          onClick={clearCallError}
          aria-label="Dismiss call error"
          className="p-0.5 rounded-chip hover:opacity-75 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Incoming Ring Banner / Modal
  if (incomingCall && !activeCall) {
    return (
      <div
        className="fixed inset-0 z-[94] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Incoming call"
      >
        <div className="w-full max-w-sm rounded-modal border border-[#404040] bg-[#171717] text-[#e5e1da] p-6 text-center space-y-5 shadow-2xl">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-chip bg-[#242424] border border-[#404040] text-[11px] uppercase tracking-wider">
              {incomingCall.callType === 'video' ? (
                <>
                  <Video className="w-3.5 h-3.5" />
                  <span>Incoming Video Call</span>
                </>
              ) : (
                <>
                  <Phone className="w-3.5 h-3.5" />
                  <span>Incoming Voice Call</span>
                </>
              )}
            </span>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="ring-4 ring-emerald-500/40 rounded-full p-1 animate-pulse">
              <AvatarImage
                src={incomingCall.callerPhotoUrl}
                name={incomingCall.callerName || incomingCall.callerUsername}
                sizeClass="w-20 h-20"
                textSizeClass="text-2xl"
              />
            </div>
            <div>
              <h3 className="font-display text-xl font-bold">{incomingCall.callerName}</h3>
              <p className="text-xs text-[#b0b0b0]">@{incomingCall.callerUsername}</p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-5 pt-2">
            <button
              type="button"
              onClick={declineIncomingCall}
              aria-label="Decline call"
              className="w-14 h-14 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 cursor-pointer shadow-lg"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
            <button
              type="button"
              onClick={acceptIncomingCall}
              aria-label="Accept call"
              className="w-14 h-14 rounded-full bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 cursor-pointer shadow-lg"
            >
              {incomingCall.callType === 'video' ? (
                <Video className="w-6 h-6" />
              ) : (
                <Phone className="w-6 h-6" />
              )}
            </button>
          </div>

          <p className="text-[11px] text-[#a5a5a5]">
            Calls only ring while SWOOOSH is open.
          </p>
        </div>
      </div>
    );
  }

  if (!activeCall) return null;

  const isCaller = activeCall.callerId === userProfile?.uid;
  const peerName = isCaller ? activeCall.calleeName : activeCall.callerName;
  const peerUsername = isCaller ? activeCall.calleeUsername : activeCall.callerUsername;
  const peerPhoto = isCaller ? activeCall.calleePhotoUrl : activeCall.callerPhotoUrl;
  const isVideo = activeCall.callType === 'video';
  const hasRemoteVideo = Boolean(remoteStream && remoteStream.getVideoTracks().length > 0);

  return (
    <div
      className="fixed inset-0 z-[94] bg-[#111111] text-[#f5f4f0] flex flex-col justify-between"
      role="dialog"
      aria-modal="true"
      aria-label={`${isVideo ? 'Video' : 'Voice'} call with ${peerName}`}
    >
      {/* Hidden audio element ensures voice playback even when video tracks aren't shown */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Top Bar */}
      <div className="relative z-10 px-5 pt-5 pb-3 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent">
        <div>
          <p className="text-xs uppercase tracking-wider text-[#b0b0b0]">
            {isVideo ? 'Video Call' : 'Voice Call'}
          </p>
          <h2 className="font-display text-lg font-bold">
            {peerName} <span className="text-xs font-normal text-[#b0b0b0]">@{peerUsername}</span>
          </h2>
          <p className="text-xs font-mono-num text-emerald-400 mt-0.5">
            {activeCall.status === 'ringing' ? 'Ringing...' : formatTimer(callSeconds)}
          </p>
        </div>

        <button
          type="button"
          onClick={endCurrentCall}
          aria-label="Close and end call"
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Media Area */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden px-4">
        {isVideo && hasRemoteVideo ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-4 text-center">
            <div
              className={`rounded-full p-1.5 ${
                activeCall.status === 'ringing' ? 'ring-4 ring-white/25 animate-pulse' : 'ring-2 ring-emerald-500/50'
              }`}
            >
              <AvatarImage
                src={peerPhoto}
                name={peerName || peerUsername}
                sizeClass="w-28 h-28"
                textSizeClass="text-3xl"
              />
            </div>
            <div>
              <p className="font-display text-xl font-bold">{peerName}</p>
              <p className="text-xs text-[#b0b0b0] mt-1">
                {activeCall.status === 'ringing'
                  ? 'Waiting for answer...'
                  : isVideo
                  ? 'Connecting video...'
                  : 'Voice connected'}
              </p>
            </div>
          </div>
        )}

        {/* Picture-in-Picture Local Video */}
        {isVideo && localStream && !isCameraOff && (
          <div className="absolute bottom-4 right-4 w-28 sm:w-36 aspect-[3/4] rounded-card overflow-hidden border border-white/25 bg-black shadow-2xl">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>
        )}
      </div>

      {/* Error & Controls Footer */}
      <div className="relative z-10 px-5 pb-6 pt-4 bg-gradient-to-t from-black/85 to-transparent space-y-3">
        {callError && (
          <div
            role="alert"
            className="max-w-md mx-auto p-2.5 rounded-control bg-red-950/90 border border-red-500/40 text-red-100 text-xs text-center"
          >
            {callError}
          </div>
        )}

        <div className="flex items-center justify-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            className={`w-12 h-12 rounded-full flex items-center justify-center border cursor-pointer ${
              isMuted
                ? 'bg-white text-[#171717] border-white'
                : 'bg-white/15 text-white border-white/20 hover:bg-white/25'
            }`}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {isVideo && (
            <>
              <button
                type="button"
                onClick={toggleCamera}
                aria-label={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
                className={`w-12 h-12 rounded-full flex items-center justify-center border cursor-pointer ${
                  isCameraOff
                    ? 'bg-white text-[#171717] border-white'
                    : 'bg-white/15 text-white border-white/20 hover:bg-white/25'
                }`}
              >
                {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </button>

              <button
                type="button"
                onClick={flipCamera}
                aria-label="Flip camera"
                className="w-12 h-12 rounded-full bg-white/15 text-white border border-white/20 hover:bg-white/25 flex items-center justify-center cursor-pointer"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={toggleSpeaker}
            aria-label={speakerEnabled ? 'Mute speaker' : 'Enable speaker'}
            className={`w-12 h-12 rounded-full flex items-center justify-center border cursor-pointer ${
              !speakerEnabled
                ? 'bg-white text-[#171717] border-white'
                : 'bg-white/15 text-white border-white/20 hover:bg-white/25'
            }`}
          >
            {speakerEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          <button
            type="button"
            onClick={endCurrentCall}
            aria-label="End call"
            className="px-5 h-12 rounded-full bg-red-600 text-white font-semibold text-xs flex items-center gap-2 hover:bg-red-700 cursor-pointer shadow-lg"
          >
            <PhoneOff className="w-4 h-4" />
            <span>End</span>
          </button>
        </div>

        <p className="text-[11px] text-center text-[#a5a5a5]">
          Calls only ring while SWOOOSH is open. If a call can&apos;t connect, try Wi-Fi.
        </p>
      </div>
    </div>
  );
};
