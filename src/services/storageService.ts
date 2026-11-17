import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith('image/')) {
    return 'Only image files (JPG, PNG, WEBP) are supported.';
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return 'Image file size must be under 5 MB.';
  }
  return null;
}

export async function fileToCompressedDataUrl(file: File, maxDim = 900, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Could not process image file.'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Could not read image file.'));
    reader.readAsDataURL(file);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return await res.blob();
}

export interface UploadedAsset {
  imageUrl: string;
  storagePath: string;
}

export async function uploadImageAsset(
  file: File,
  userId: string,
  folder: 'wardrobe' | 'outfits' | 'wishlist' | 'profiles',
  isDemo: boolean
): Promise<UploadedAsset> {
  const validationError = validateImageFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  // Compress image so it's fast and crisp
  const compressedDataUrl = await fileToCompressedDataUrl(file, folder === 'profiles' ? 512 : 900, 0.82);

  if (isDemo) {
    return {
      imageUrl: compressedDataUrl,
      storagePath: `demo/${folder}/${Date.now()}_${file.name}`,
    };
  }

  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `users/${userId}/${folder}/${Date.now()}_${cleanName}`;

  try {
    const blob = await dataUrlToBlob(compressedDataUrl);
    const storageRef = ref(storage, storagePath);
    const snapshot = await uploadBytes(storageRef, blob, {
      contentType: 'image/jpeg',
    });
    const downloadUrl = await getDownloadURL(snapshot.ref);
    return {
      imageUrl: downloadUrl,
      storagePath,
    };
  } catch (err) {
    // If Firebase Storage bucket isn't initialized in Spark preview, fall back to compressed Data URL
    // (capped well under Firestore 500KB rule limit)
    console.warn('Firebase Storage fallback to compressed inline asset:', err);
    if (compressedDataUrl.length < 480000) {
      return {
        imageUrl: compressedDataUrl,
        storagePath: `inline://${folder}/${Date.now()}`,
      };
    }
    const smallerDataUrl = await fileToCompressedDataUrl(file, 600, 0.7);
    return {
      imageUrl: smallerDataUrl,
      storagePath: `inline://${folder}/${Date.now()}`,
    };
  }
}

export async function deleteImageAsset(storagePath?: string): Promise<void> {
  if (!storagePath || storagePath.startsWith('demo/') || storagePath.startsWith('inline://')) {
    return;
  }
  try {
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
  } catch (err) {
    console.warn('Storage asset cleanup notice:', err);
  }
}
