import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import { assertOnlineForWrite, db, handleFirestoreError, OperationType } from '../firebase';
import { CallSession } from '../types';
import { cleanData } from '../utils/cleanData';

export function buildIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    {
      urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'],
    },
  ];
  const turnUrl = import.meta.env.VITE_TURN_URL?.trim();
  if (turnUrl) {
    const turnUser = import.meta.env.VITE_TURN_USERNAME?.trim();
    const turnCred = import.meta.env.VITE_TURN_CREDENTIAL?.trim();
    servers.push({
      urls: turnUrl,
      ...(turnUser ? { username: turnUser } : {}),
      ...(turnCred ? { credential: turnCred } : {}),
    });
  }
  return servers;
}

export async function createCallDoc(session: CallSession): Promise<void> {
  const path = `calls/${session.id}`;
  try {
    assertOnlineForWrite('start this call');
    await setDoc(doc(db, 'calls', session.id), cleanData(session));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateCallDoc(callId: string, patch: Record<string, any>): Promise<void> {
  const path = `calls/${callId}`;
  try {
    await updateDoc(doc(db, 'calls', callId), cleanData(patch));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function addCallCandidate(
  callId: string,
  role: 'caller' | 'callee',
  candidate: RTCIceCandidateInit
): Promise<void> {
  const sub = role === 'caller' ? 'callerCandidates' : 'calleeCandidates';
  const cid = `ice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    await setDoc(
      doc(db, 'calls', callId, sub, cid),
      cleanData({
        candidate: candidate.candidate || '',
        sdpMid: candidate.sdpMid ?? null,
        sdpMLineIndex: candidate.sdpMLineIndex ?? null,
        createdAt: new Date().toISOString(),
      })
    );
  } catch (err) {
    console.warn(`Failed adding ${sub}:`, err);
  }
}

export function subscribeCallDoc(
  callId: string,
  onChange: (session: CallSession | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'calls', callId),
    (snap) => {
      onChange(snap.exists() ? (snap.data() as CallSession) : null);
    },
    (error) => {
      if (onError) onError(error);
    }
  );
}

export function subscribeIncomingCalls(
  uid: string,
  onIncoming: (calls: CallSession[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, 'calls'),
    where('calleeId', '==', uid),
    where('status', '==', 'ringing')
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: CallSession[] = [];
      snap.forEach((d) => list.push(d.data() as CallSession));
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onIncoming(list);
    },
    (error) => {
      if (onError) onError(error);
    }
  );
}

export function subscribeCallCandidates(
  callId: string,
  role: 'caller' | 'callee',
  onCandidate: (candidate: RTCIceCandidateInit) => void
): Unsubscribe {
  const sub = role === 'caller' ? 'callerCandidates' : 'calleeCandidates';
  return onSnapshot(collection(db, 'calls', callId, sub), (snap) => {
    snap.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const data = change.doc.data() as RTCIceCandidateInit;
        if (data?.candidate) {
          onCandidate({
            candidate: data.candidate,
            sdpMid: data.sdpMid ?? undefined,
            sdpMLineIndex: data.sdpMLineIndex ?? undefined,
          });
        }
      }
    });
  });
}

export async function cleanupCallSignaling(callId: string): Promise<void> {
  try {
    await updateDoc(
      doc(db, 'calls', callId),
      cleanData({
        offerSdp: null,
        answerSdp: null,
      })
    ).catch(() => {});

    for (const sub of ['callerCandidates', 'calleeCandidates'] as const) {
      const snap = await getDocs(collection(db, 'calls', callId, sub)).catch(() => null);
      if (snap && !snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit().catch(() => {
          snap.docs.forEach((d) => deleteDoc(d.ref).catch(() => {}));
        });
      }
    }
  } catch {
    // Best-effort cleanup
  }
}
