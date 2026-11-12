import {
  collection,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { FileRecord, UserProfile } from '../types';

export async function createUserProfile(profile: UserProfile): Promise<void> {
  const path = `users/${profile.uid}`;
  try {
    await setDoc(doc(db, 'users', profile.uid), profile);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const path = `users/${uid}`;
  try {
    const docSnap = await getDoc(doc(db, 'users', uid));
    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function subscribeUserFiles(
  userId: string,
  onUpdate: (files: FileRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'files';
  const q = query(collection(db, path), where('userId', '==', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const files: FileRecord[] = [];
      snapshot.forEach((doc) => {
        files.push(doc.data() as FileRecord);
      });
      // Sort client-side by createdAt descending by default
      files.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(files);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError) onError(wrapped as Error);
      }
    }
  );
}

export async function addFileRecord(file: FileRecord): Promise<void> {
  const path = `files/${file.id}`;
  try {
    await setDoc(doc(db, 'files', file.id), file);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateFileRecord(fileId: string, updates: Partial<FileRecord>): Promise<void> {
  const path = `files/${fileId}`;
  try {
    await updateDoc(doc(db, 'files', fileId), {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteFileRecord(fileId: string): Promise<void> {
  const path = `files/${fileId}`;
  try {
    await deleteDoc(doc(db, 'files', fileId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function seedSampleFiles(userId: string): Promise<void> {
  const now = new Date();
  const sampleItems: Omit<FileRecord, 'id' | 'userId'>[] = [
    {
      fileName: 'Acme-Brand-Guidelines-2026.pdf',
      fileSize: 4280500, // 4.1 MB
      fileType: 'application/pdf',
      clientName: 'Acme Studio Co.',
      category: 'Brand Guidelines',
      notes: 'Final approved brand typography, hex palettes, and grid systems.',
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    },
    {
      fileName: 'Hero-Header-Mockup-v3.png',
      fileSize: 2150000, // 2.1 MB
      fileType: 'image/png',
      clientName: 'Bloom Health',
      category: 'Design Assets',
      notes: 'High-res desktop & mobile hero section exploration in light pink aesthetic.',
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    },
    {
      fileName: 'Project-Statement-Of-Work-Signed.pdf',
      fileSize: 845000, // 825 KB
      fileType: 'application/pdf',
      clientName: 'Horizon Creative',
      category: 'Contracts & Briefs',
      notes: 'Countersigned Q4 deliverable agreement with milestone schedule.',
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
    },
    {
      fileName: 'Product-Icons-Vector-Kit.svg',
      fileSize: 340000, // 332 KB
      fileType: 'image/svg+xml',
      clientName: 'Acme Studio Co.',
      category: 'Design Assets',
      notes: 'Complete set of 48 clean line icons in 24px and 32px variants.',
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 72).toISOString(), // 3 days ago
    },
  ];

  for (let i = 0; i < sampleItems.length; i++) {
    const id = `sample_${Date.now()}_${i}`;
    const record: FileRecord = {
      ...sampleItems[i],
      id,
      userId,
    };
    await addFileRecord(record);
  }
}
