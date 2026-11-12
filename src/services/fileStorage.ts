import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase';

const DB_NAME = 'SwoooshzLocalCache';
const STORE_NAME = 'fileBlobs';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function storeFileBlobLocally(id: string, file: Blob, fileName: string, fileType: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ id, blob: file, fileName, fileType, storedAt: Date.now() });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
  } catch (err) {
    console.warn('Could not cache file in IndexedDB:', err);
  }
}

export async function getLocalFileBlob(id: string): Promise<Blob | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    return new Promise((resolve) => {
      req.onsuccess = () => {
        resolve(req.result ? req.result.blob : null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function removeLocalFileBlob(id: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
  } catch (err) {
    console.warn('Could not remove file from IndexedDB:', err);
  }
}

export interface UploadResult {
  fileUrl: string;
  storagePath: string;
}

export async function uploadFileToStorage(
  file: File,
  userId: string,
  fileId: string,
  onProgress?: (percent: number) => void
): Promise<UploadResult> {
  // Always cache blob locally for fast previews and offline resiliency
  await storeFileBlobLocally(fileId, file, file.name, file.type);

  const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `users/${userId}/${fileId}_${cleanFileName}`;

  try {
    const storageReference = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageReference, file);

    return await new Promise<UploadResult>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) onProgress(Math.round(progress));
        },
        async (error) => {
          console.warn('Firebase Storage upload failed, using local blob cache:', error.message);
          // Fallback to local object URL if storage rules or bucket access has issues
          const localUrl = URL.createObjectURL(file);
          if (onProgress) onProgress(100);
          resolve({
            fileUrl: localUrl,
            storagePath: `local://${fileId}`,
          });
        },
        async () => {
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            if (onProgress) onProgress(100);
            resolve({
              fileUrl: downloadUrl,
              storagePath,
            });
          } catch (urlErr) {
            const localUrl = URL.createObjectURL(file);
            resolve({
              fileUrl: localUrl,
              storagePath,
            });
          }
        }
      );
    });
  } catch (err) {
    console.warn('Storage initialization fallback:', err);
    const localUrl = URL.createObjectURL(file);
    if (onProgress) onProgress(100);
    return {
      fileUrl: localUrl,
      storagePath: `local://${fileId}`,
    };
  }
}

export async function deleteStorageFile(storagePath?: string, fileId?: string): Promise<void> {
  if (fileId) {
    await removeLocalFileBlob(fileId);
  }
  if (storagePath && !storagePath.startsWith('local://')) {
    try {
      const storageReference = ref(storage, storagePath);
      await deleteObject(storageReference);
    } catch (err) {
      console.warn('Could not delete from Firebase Storage (might have been removed):', err);
    }
  }
}

export async function downloadFile(fileId: string, fileName: string, fileUrl?: string): Promise<void> {
  try {
    // Check if we have the blob in local IndexedDB first for fastest zero-latency download
    const localBlob = await getLocalFileBlob(fileId);
    if (localBlob) {
      const url = URL.createObjectURL(localBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      return;
    }

    if (fileUrl) {
      // Trigger download via fetch or direct link
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      return;
    }
  } catch (err) {
    console.warn('Direct blob download failed, falling back to window navigation:', err);
    if (fileUrl) {
      const a = document.createElement('a');
      a.href = fileUrl;
      a.target = '_blank';
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }
}
