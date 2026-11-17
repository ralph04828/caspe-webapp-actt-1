import { doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { MediaAsset, Visibility } from '../types';

const MAX_INPUT_FILE_BYTES = 8 * 1024 * 1024; // 8 MB input before compression
const MAX_FIRESTORE_DOC_BYTES = 720 * 1024; // Hard safety cap well under Firestore 1 MiB document limit

export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith('image/')) {
    return 'Only image files (JPG, PNG, WEBP) are supported.';
  }
  if (file.size > MAX_INPUT_FILE_BYTES) {
    return 'Selected photo is too large (max 8 MB before compression).';
  }
  return null;
}

/**
 * Draws an image onto a fresh canvas (which automatically strips EXIF metadata & GPS tags),
 * resizes to maxDim, and encodes as WebP (or PNG if alpha cutout fallback).
 */
export async function compressDataUrlToWebp(
  sourceDataUrl: string,
  maxDim = 1000,
  quality = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth || img.width;
      let h = img.naturalHeight || img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not initialize image compressor.'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      let encoded = canvas.toDataURL('image/webp', quality);
      if (!encoded.startsWith('data:image/webp')) {
        encoded = canvas.toDataURL('image/jpeg', quality);
      }
      resolve(encoded);
    };
    img.onerror = () => reject(new Error('Failed to decode image file.'));
    img.src = sourceDataUrl;
  });
}

export async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

export async function prepareCompressedImagePair(
  fileOrDataUrl: File | string
): Promise<{ fullDataUrl: string; thumbDataUrl: string; byteSize: number }> {
  let rawDataUrl: string;
  if (typeof fileOrDataUrl === 'string') {
    rawDataUrl = fileOrDataUrl;
  } else {
    const err = validateImageFile(fileOrDataUrl);
    if (err) throw new Error(err);
    rawDataUrl = await readFileAsDataUrl(fileOrDataUrl);
  }

  // First pass: 1000px WebP @ 0.8
  let fullDataUrl = await compressDataUrlToWebp(rawDataUrl, 1000, 0.8);
  const thumbDataUrl = await compressDataUrlToWebp(rawDataUrl, 256, 0.76);

  // If still above safe Firestore document budget, step down cleanly
  if (fullDataUrl.length + thumbDataUrl.length > MAX_FIRESTORE_DOC_BYTES) {
    fullDataUrl = await compressDataUrlToWebp(rawDataUrl, 800, 0.72);
  }
  if (fullDataUrl.length + thumbDataUrl.length > MAX_FIRESTORE_DOC_BYTES) {
    fullDataUrl = await compressDataUrlToWebp(rawDataUrl, 640, 0.65);
  }

  const byteSize = fullDataUrl.length + thumbDataUrl.length;
  if (byteSize > MAX_FIRESTORE_DOC_BYTES) {
    throw new Error(
      'This image is still too detailed to store in Firestore after compression. Try cropping closer or choosing a simpler photo.'
    );
  }

  return { fullDataUrl, thumbDataUrl, byteSize };
}

export interface UploadedAsset {
  imageUrl: string;
  thumbUrl: string;
  mediaId: string;
}

/**
 * Stores compressed WebP photos directly in Firestore /media/{mediaId} documents.
 * No Firebase Storage bucket is used.
 */
export async function uploadImageAsset(
  fileOrDataUrl: File | string,
  userId: string,
  visibility: Visibility,
  isDemo: boolean
): Promise<UploadedAsset> {
  const { fullDataUrl, thumbDataUrl, byteSize } = await prepareCompressedImagePair(fileOrDataUrl);
  const mediaId = `media_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  if (isDemo) {
    return {
      imageUrl: fullDataUrl,
      thumbUrl: thumbDataUrl,
      mediaId: `demo_${mediaId}`,
    };
  }

  const asset: MediaAsset = {
    id: mediaId,
    ownerId: userId,
    visibility,
    fullDataUrl,
    thumbDataUrl,
    byteSize,
    createdAt: new Date().toISOString(),
  };

  const path = `media/${mediaId}`;
  try {
    await setDoc(doc(db, 'media', mediaId), asset);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  // Note: For fast feed rendering while keeping wardrobe/post documents under 1MB,
  // we put thumbDataUrl on item/post cards if tiny or resolve full image via mediaId.
  // Keeping fullDataUrl in /media/{mediaId} prevents main docs from ever bloating past 1MB.
  return {
    imageUrl: fullDataUrl,
    thumbUrl: thumbDataUrl,
    mediaId,
  };
}

export async function getMediaAsset(mediaId: string): Promise<MediaAsset | null> {
  if (!mediaId || mediaId.startsWith('demo_')) return null;
  const path = `media/${mediaId}`;
  try {
    const snap = await getDoc(doc(db, 'media', mediaId));
    return snap.exists() ? (snap.data() as MediaAsset) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function deleteImageAsset(mediaId?: string): Promise<void> {
  if (!mediaId || mediaId.startsWith('demo_')) return;
  const path = `media/${mediaId}`;
  try {
    await deleteDoc(doc(db, 'media', mediaId));
  } catch (error) {
    console.warn('Media document cleanup notice:', error);
  }
}
