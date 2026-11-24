import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CallSession, CallType, ChatConversation, ChatMessage } from '../types';
import { useAuth } from './AuthContext';
import { useSocial } from './SocialContext';
import {
  addCallCandidate,
  buildIceServers,
  cleanupCallSignaling,
  createCallDoc,
  subscribeCallCandidates,
  subscribeCallDoc,
  subscribeIncomingCalls,
  updateCallDoc,
} from '../services/callService';
import { sendConversationMessageFirestore } from '../services/firestoreService';
import { cleanData } from '../utils/cleanData';

interface PeerTargetInfo {
  displayName: string;
  username: string;
  photoUrl?: string;
}

interface CallContextType {
  activeCall: CallSession | null;
  incomingCall: CallSession | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isCameraOff: boolean;
  speakerEnabled: boolean;
  callSeconds: number;
  callError: string | null;
  clearCallError: () => void;
  startCall: (
    conv: ChatConversation,
    targetUid: string,
    peerInfo: PeerTargetInfo,
    callType: CallType
  ) => Promise<void>;
  acceptIncomingCall: () => Promise<void>;
  declineIncomingCall: () => Promise<void>;
  endCurrentCall: () => Promise<void>;
  toggleMute: () => void;
  toggleCamera: () => void;
  flipCamera: () => Promise<void>;
  toggleSpeaker: () => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

function formatCallDurationText(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const CallContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile, isDemoMode } = useAuth();
  const { conversations, isBlocked, isMuted: isUserMuted } = useSocial();

  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [callSeconds, setCallSeconds] = useState(0);
  const [callError, setCallError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const activeCallRef = useRef<CallSession | null>(null);
  const activeConvRef = useRef<ChatConversation | null>(null);
  const facingModeRef = useRef<'user' | 'environment'>('user');
  const remoteDescSetRef = useRef(false);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const ringTimeoutRef = useRef<number | null>(null);
  const callTimerRef = useRef<number | null>(null);
  const callSecondsRef = useRef(0);
  const loggedSummaryForCallRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    callSecondsRef.current = callSeconds;
  }, [callSeconds]);

  const clearCallError = useCallback(() => setCallError(null), []);

  const stopAllMediaAndPeer = useCallback(() => {
    if (ringTimeoutRef.current) {
      window.clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
    if (callTimerRef.current) {
      window.clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    if (pcRef.current) {
      try {
        pcRef.current.ontrack = null;
        pcRef.current.onicecandidate = null;
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.close();
      } catch {
        // ignore
      }
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // ignore
        }
      });
      localStreamRef.current = null;
    }
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // ignore
        }
      });
      remoteStreamRef.current = null;
    }
    remoteDescSetRef.current = false;
    pendingIceRef.current = [];
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsCameraOff(false);
    setCallSeconds(0);
  }, []);

  const logCallSummaryToDm = useCallback(
    async (session: CallSession, text: string) => {
      if (!userProfile || isDemoMode) return;
      if (loggedSummaryForCallRef.current.has(session.id)) return;
      loggedSummaryForCallRef.current.add(session.id);

      const conv =
        activeConvRef.current?.id === session.conversationId
          ? activeConvRef.current
          : conversations.find((c) => c.id === session.conversationId);
      if (!conv) return;

      const msg: ChatMessage = cleanData({
        id: `msg_call_${session.id}`,
        conversationId: conv.id,
        senderId: userProfile.uid,
        senderName: userProfile.displayName,
        senderUsername: userProfile.username,
        senderPhotoUrl: userProfile.photoURL,
        text,
        createdAt: new Date().toISOString(),
      });
      await sendConversationMessageFirestore(conv, msg).catch((err) => {
        console.warn('Could not log call summary message:', err);
      });
    },
    [userProfile, isDemoMode, conversations]
  );

  const acquireLocalMedia = useCallback(async (callType: CallType): Promise<MediaStream> => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Voice and video calls require a browser with camera/microphone support (HTTPS).');
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video' ? { facingMode: facingModeRef.current } : false,
      });
      return stream;
    } catch (err: any) {
      const name = err?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        throw new Error(
          `Permission denied for ${
            callType === 'video' ? 'camera & microphone' : 'microphone'
          }. Allow access in your browser settings and try again.`
        );
      }
      if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        throw new Error(
          `No ${callType === 'video' ? 'camera or microphone' : 'microphone'} device was found.`
        );
      }
      throw new Error(err?.message || 'Could not access microphone or camera.');
    }
  }, []);

  const setupPeerConnection = useCallback(
    (callId: string, role: 'caller' | 'callee', stream: MediaStream): RTCPeerConnection => {
      const pc = new RTCPeerConnection({ iceServers: buildIceServers() });
      const remote = new MediaStream();
      remoteStreamRef.current = remote;
      setRemoteStream(remote);

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      pc.ontrack = (event) => {
        event.streams?.[0]?.getTracks().forEach((track) => {
          remote.addTrack(track);
        });
        if (!event.streams?.length && event.track) {
          remote.addTrack(event.track);
        }
        setRemoteStream(new MediaStream(remote.getTracks()));
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addCallCandidate(callId, role, event.candidate.toJSON());
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          setCallError("Connection couldn't be established over this network. Try switching to Wi-Fi.");
        }
      };

      pcRef.current = pc;
      return pc;
    },
    []
  );

  // Listen for incoming ringing calls
  useEffect(() => {
    if (!userProfile?.uid || isDemoMode) {
      setIncomingCall(null);
      return;
    }
    const unsub = subscribeIncomingCalls(
      userProfile.uid,
      (calls) => {
        const now = Date.now();
        const valid = calls.find((c) => {
          if (isBlocked(c.callerId) || isUserMuted(c.callerId)) return false;
          const age = now - new Date(c.createdAt).getTime();
          return !Number.isNaN(age) && age < 60_000;
        });
        if (!activeCallRef.current) {
          setIncomingCall(valid || null);
        } else {
          setIncomingCall(null);
        }
      },
      (err) => {
        console.warn('Incoming calls listener warning:', err);
      }
    );
    return () => unsub();
  }, [userProfile?.uid, isDemoMode, isBlocked, isUserMuted]);

  // Subscribe to active call doc & ICE candidates
  useEffect(() => {
    const current = activeCall;
    if (!current || !userProfile) return;

    const isCaller = current.callerId === userProfile.uid;
    const remoteRole: 'caller' | 'callee' = isCaller ? 'callee' : 'caller';

    const unsubDoc = subscribeCallDoc(
      current.id,
      async (updated) => {
        if (!updated) {
          stopAllMediaAndPeer();
          setActiveCall(null);
          return;
        }
        setActiveCall(updated);

        // Apply callee answer SDP on caller
        if (isCaller && updated.answerSdp && pcRef.current && !remoteDescSetRef.current) {
          try {
            remoteDescSetRef.current = true;
            await pcRef.current.setRemoteDescription(
              new RTCSessionDescription({ type: 'answer', sdp: updated.answerSdp })
            );
            for (const c of pendingIceRef.current) {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
            }
            pendingIceRef.current = [];
          } catch (err) {
            console.error('Failed setting answer SDP:', err);
          }
        }

        if (updated.status === 'active') {
          if (ringTimeoutRef.current) {
            window.clearTimeout(ringTimeoutRef.current);
            ringTimeoutRef.current = null;
          }
          if (!callTimerRef.current) {
            callTimerRef.current = window.setInterval(() => {
              setCallSeconds((s) => s + 1);
            }, 1000);
          }
        }

        if (
          updated.status === 'ended' ||
          updated.status === 'declined' ||
          updated.status === 'missed'
        ) {
          const typeLabel = updated.callType === 'video' ? 'Video call' : 'Voice call';
          if (isCaller) {
            if (updated.status === 'declined') {
              await logCallSummaryToDm(updated, `Declined ${typeLabel.toLowerCase()}`);
            } else if (updated.status === 'missed') {
              await logCallSummaryToDm(updated, `Missed ${typeLabel.toLowerCase()}`);
            } else if (updated.status === 'ended') {
              const dur = updated.durationSeconds ?? callSecondsRef.current;
              await logCallSummaryToDm(updated, `${typeLabel}, ${formatCallDurationText(dur)}`);
            }
          }
          if (updated.status === 'declined') {
            setCallError(`${updated.calleeName || '@' + updated.calleeUsername} declined the call.`);
          } else if (updated.status === 'missed') {
            setCallError('No answer.');
          }
          await cleanupCallSignaling(updated.id);
          stopAllMediaAndPeer();
          setActiveCall(null);
        }
      },
      (err) => {
        console.error('Active call doc error:', err);
        setCallError(err?.message || 'Call connection interrupted.');
      }
    );

    const unsubCandidates = subscribeCallCandidates(current.id, remoteRole, async (cand) => {
      const pc = pcRef.current;
      if (!pc) return;
      if (remoteDescSetRef.current && pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
      } else {
        pendingIceRef.current.push(cand);
      }
    });

    return () => {
      unsubDoc();
      unsubCandidates();
    };
  }, [activeCall?.id, userProfile?.uid, logCallSummaryToDm, stopAllMediaAndPeer]);

  // Cleanup active call if tab closes
  useEffect(() => {
    const onUnload = () => {
      const c = activeCallRef.current;
      if (c && userProfile) {
        updateCallDoc(c.id, {
          status: c.status === 'active' ? 'ended' : 'missed',
          endedAt: new Date().toISOString(),
          endedBy: userProfile.uid,
          durationSeconds: callSecondsRef.current,
        }).catch(() => {});
      }
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [userProfile?.uid]);

  const startCall: CallContextType['startCall'] = async (conv, targetUid, peerInfo, callType) => {
    if (!userProfile) return;
    setCallError(null);
    if (isDemoMode) {
      const msg = 'Voice & video calls require a live signed-in account.';
      setCallError(msg);
      throw new Error(msg);
    }
    if (activeCallRef.current) {
      throw new Error('You already have a call in progress.');
    }

    activeConvRef.current = conv;
    facingModeRef.current = 'user';

    const stream = await acquireLocalMedia(callType);
    localStreamRef.current = stream;
    setLocalStream(stream);

    const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const pc = setupPeerConnection(callId, 'caller', stream);

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType === 'video',
      });
      await pc.setLocalDescription(offer);

      const now = new Date().toISOString();
      const session: CallSession = cleanData({
        id: callId,
        conversationId: conv.id,
        callerId: userProfile.uid,
        callerName: userProfile.displayName,
        callerUsername: userProfile.username,
        callerPhotoUrl: userProfile.photoURL,
        calleeId: targetUid,
        calleeName: peerInfo.displayName,
        calleeUsername: peerInfo.username,
        calleePhotoUrl: peerInfo.photoUrl,
        callType,
        status: 'ringing',
        participants: [userProfile.uid, targetUid].sort() as [string, string],
        offerSdp: offer.sdp || '',
        createdAt: now,
      });

      await createCallDoc(session);
      setActiveCall(session);

      ringTimeoutRef.current = window.setTimeout(async () => {
        const cur = activeCallRef.current;
        if (cur && cur.id === callId && cur.status === 'ringing') {
          await updateCallDoc(callId, {
            status: 'missed',
            endedAt: new Date().toISOString(),
            endedBy: userProfile.uid,
          }).catch(() => {});
        }
      }, 45_000);
    } catch (err: any) {
      stopAllMediaAndPeer();
      const msg = err?.message || 'Could not start call.';
      setCallError(msg);
      throw new Error(msg);
    }
  };

  const acceptIncomingCall = async () => {
    if (!incomingCall || !userProfile) return;
    setCallError(null);
    const targetCall = incomingCall;
    setIncomingCall(null);
    facingModeRef.current = 'user';

    try {
      const stream = await acquireLocalMedia(targetCall.callType);
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = setupPeerConnection(targetCall.id, 'callee', stream);
      if (!targetCall.offerSdp) {
        throw new Error('Missing call offer from caller.');
      }

      remoteDescSetRef.current = true;
      await pc.setRemoteDescription(
        new RTCSessionDescription({ type: 'offer', sdp: targetCall.offerSdp })
      );
      for (const c of pendingIceRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
      }
      pendingIceRef.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const now = new Date().toISOString();
      await updateCallDoc(targetCall.id, {
        status: 'active',
        answerSdp: answer.sdp || '',
        answeredAt: now,
      });

      setActiveCall({
        ...targetCall,
        status: 'active',
        answerSdp: answer.sdp || '',
        answeredAt: now,
      });
    } catch (err: any) {
      stopAllMediaAndPeer();
      const msg = err?.message || 'Could not answer call.';
      setCallError(msg);
      await updateCallDoc(targetCall.id, {
        status: 'declined',
        endedAt: new Date().toISOString(),
        endedBy: userProfile.uid,
      }).catch(() => {});
    }
  };

  const declineIncomingCall = async () => {
    if (!incomingCall || !userProfile) return;
    const targetCall = incomingCall;
    setIncomingCall(null);
    await updateCallDoc(targetCall.id, {
      status: 'declined',
      endedAt: new Date().toISOString(),
      endedBy: userProfile.uid,
    }).catch(() => {});
  };

  const endCurrentCall = async () => {
    const cur = activeCallRef.current;
    if (!cur || !userProfile) {
      stopAllMediaAndPeer();
      setActiveCall(null);
      return;
    }
    const nextStatus = cur.status === 'active' ? 'ended' : 'missed';
    const dur = cur.status === 'active' ? callSecondsRef.current : 0;
    const isCaller = cur.callerId === userProfile.uid;
    const typeLabel = cur.callType === 'video' ? 'Video call' : 'Voice call';

    if (isCaller) {
      await logCallSummaryToDm(
        cur,
        nextStatus === 'ended'
          ? `${typeLabel}, ${formatCallDurationText(dur)}`
          : `Missed ${typeLabel.toLowerCase()}`
      );
    }

    await updateCallDoc(cur.id, {
      status: nextStatus,
      endedAt: new Date().toISOString(),
      endedBy: userProfile.uid,
      durationSeconds: dur,
    }).catch(() => {});

    await cleanupCallSignaling(cur.id);
    stopAllMediaAndPeer();
    setActiveCall(null);
  };

  const toggleMute = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !isMuted;
    stream.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
    setIsMuted(next);
  };

  const toggleCamera = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !isCameraOff;
    stream.getVideoTracks().forEach((t) => {
      t.enabled = !next;
    });
    setIsCameraOff(next);
  };

  const flipCamera = async () => {
    const stream = localStreamRef.current;
    const pc = pcRef.current;
    if (!stream || !pc || !navigator.mediaDevices?.getUserMedia) return;
    const nextFacing = facingModeRef.current === 'user' ? 'environment' : 'user';
    try {
      const camStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextFacing },
      });
      const newTrack = camStream.getVideoTracks()[0];
      if (!newTrack) return;
      facingModeRef.current = nextFacing;
      const oldTrack = stream.getVideoTracks()[0];
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) {
        await sender.replaceTrack(newTrack);
      }
      if (oldTrack) {
        stream.removeTrack(oldTrack);
        oldTrack.stop();
      }
      stream.addTrack(newTrack);
      newTrack.enabled = !isCameraOff;
      setLocalStream(new MediaStream(stream.getTracks()));
    } catch (err: any) {
      setCallError(err?.message || 'Could not switch camera.');
    }
  };

  const toggleSpeaker = () => {
    setSpeakerEnabled((prev) => !prev);
  };

  return (
    <CallContext.Provider
      value={{
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
        startCall,
        acceptIncomingCall,
        declineIncomingCall,
        endCurrentCall,
        toggleMute,
        toggleCamera,
        flipCamera,
        toggleSpeaker,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export function useCalls() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCalls must be used within CallContextProvider');
  return ctx;
}
