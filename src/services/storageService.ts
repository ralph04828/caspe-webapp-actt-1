import { doc, setDoc, deleteDoc, getDoc, updateDoc } from 'firebase/firestore';
import { assertOnlineForWrite, db, handleFirestoreError, OperationType } from '../firebase';
import { MediaAsset, MediaChunk, Visibility } from '../types';
import { cleanData } from '../utils/cleanData';

export const MAX_INPUT_FILE_BYTES = 12 * 1024 * 1024; // 12 MB input file cap before browser compression
export const MAX_FULL_DIMENSION = 1000;
export const MAX_THUMB_DIMENSION = 256;
export const WEBP_QUALITY = 0.8;
export const MAX_SINGLE_DOC_BYTES = 700 * 1024; // Well below Firestore's 1 MiB (1,048,576 B) doc limit
export const CHUNK_CHAR_SIZE = 420 * 1024; // Safe chunk size (< 450 KB UTF-8 + metadata)
export const MAX_CHUNKS = 8;

const DEMO_MEDIA_STORAGE_KEY = 'swooosh_demo_media_v1';

const mediaCache = new Map<string, MediaAsset>();
const inflightReads = new Map<string, Promise<MediaAsset | null>>();

export interface CompressedVariant {
  dataUrl: string;
  contentType: string;
  width: number;
  height: number;
}

export interface PreparedMediaPayload {
  fullDataUrl: string;
  thumbDataUrl: string;
  contentType: string;
  width: number;
  height: number;
  thumbWidth: number;
  thumbHeight: number;
  byteSize: number;
  chunks: MediaChunk[];
}

export interface UploadedAsset {
  imageUrl: string; // Persistent compact ref: "media:<mediaId>"
  thumbUrl: string; // Persistent compact ref: "media-thumb:<mediaId>"
  mediaId: string;
  width: number;
  height: number;
  contentType: string;
  byteSize: number;
}

export type MediaResolutionStatus =
  | 'ready'
  | 'empty'
  | 'local-only'
  | 'permission-denied'
  | 'not-found'
  | 'error';

export interface ResolvedMediaResult {
  url: string | null;
  status: MediaResolutionStatus;
  reason?: string;
  width?: number;
  height?: number;
}

export function utf8ByteLength(value: string): number {
  if (!value) return 0;
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).length;
  }
  return unescape(encodeURIComponent(value)).length;
}

export function makeMediaRef(mediaId: string, variant: 'full' | 'thumb' = 'full'): string {
  return variant === 'thumb' ? `media-thumb:${mediaId}` : `media:${mediaId}`;
}

export function parseMediaRef(
  value?: string | null
): { mediaId: string; variant: 'full' | 'thumb' } | null {
  if (!value || typeof value !== 'string') return null;
  if (value.startsWith('media-thumb:')) {
    const mediaId = value.slice('media-thumb:'.length).trim();
    return mediaId ? { mediaId, variant: 'thumb' } : null;
  }
  if (value.startsWith('media:')) {
    const mediaId = value.slice('media:'.length).trim();
    return mediaId ? { mediaId, variant: 'full' } : null;
  }
  return null;
}

export function extractMediaId(value?: string | null, fallbackMediaId?: string): string | undefined {
  const parsed = parseMediaRef(value);
  return parsed?.mediaId || fallbackMediaId || undefined;
}

export function isLegacyLocalOnlyUrl(value?: string | null): boolean {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('file:') ||
    trimmed.startsWith('webkit-fake-url:') ||
    trimmed.startsWith('content:') ||
    trimmed.startsWith('ph:') ||
    trimmed.startsWith('assets-library:')
  ) {
    return true;
  }
  // Windows drive path (e.g. C:\...) or local device filesystem prefixes
  if (/^[a-zA-Z]:\\/.test(trimmed)) return true;
  if (
    trimmed.startsWith('/Users/') ||
    trimmed.startsWith('/home/') ||
    trimmed.startsWith('/storage/') ||
    trimmed.startsWith('/var/mobile/') ||
    trimmed.startsWith('C:/')
  ) {
    return true;
  }
  return false;
}

export function revokeTempUrl(url?: string | null): void {
  if (url && typeof url === 'string' && url.startsWith('blob:') && typeof URL !== 'undefined') {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore revoke errors
    }
  }
}

export function validateImageFile(file: File): string | null {
  if (!file.type || !file.type.startsWith('image/')) {
    return 'Only image files (JPG, PNG, WEBP) are supported.';
  }
  if (file.size > MAX_INPUT_FILE_BYTES) {
    return 'Selected photo is too large (max 12 MB before browser compression).';
  }
  return null;
}

function parseDataUrlContentType(dataUrl: string): string {
  const match = /^data:([^;,]+)/i.exec(dataUrl);
  return match?.[1] || 'image/webp';
}

function loadHtmlImage(sourceUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (/^https?:\/\//i.test(sourceUrl)) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode image file.'));
    img.src = sourceUrl;
  });
}

/**
 * Draws an image onto a fresh HTML5 canvas (stripping EXIF & GPS metadata),
 * resizes proportionally so longest edge <= maxDim, and encodes as WebP @ ~0.8.
 */
export async function compressSourceToWebp(
  sourceUrl: string,
  maxDim = MAX_FULL_DIMENSION,
  quality = WEBP_QUALITY
): Promise<CompressedVariant> {
  const img = await loadHtmlImage(sourceUrl);
  const naturalW = img.naturalWidth || img.width;
  const naturalH = img.naturalHeight || img.height;

  if (!naturalW || !naturalH) {
    throw new Error('Image dimensions could not be determined.');
  }

  let w = naturalW;
  let h = naturalH;
  if (w > maxDim || h > maxDim) {
    if (w >= h) {
      h = Math.max(1, Math.round((h * maxDim) / w));
      w = maxDim;
    } else {
      w = Math.max(1, Math.round((w * maxDim) / h));
      h = maxDim;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not initialize browser image compressor.');
  }

  ctx.drawImage(img, 0, 0, w, h);

  let dataUrl = canvas.toDataURL('image/webp', quality);
  if (!dataUrl.startsWith('data:image/webp')) {
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }

  return {
    dataUrl,
    contentType: parseDataUrlContentType(dataUrl),
    width: w,
    height: h,
  };
}

/**
 * Backward-compatible wrapper returning compressed WebP Data URL string.
 */
export async function compressDataUrlToWebp(
  sourceDataUrl: string,
  maxDim = MAX_FULL_DIMENSION,
  quality = WEBP_QUALITY
): Promise<string> {
  const res = await compressSourceToWebp(sourceDataUrl, maxDim, quality);
  return res.dataUrl;
}

export async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Compresses a File into a preview WebP variant (max 1000px @ 0.8) with exact dimensions.
 */
export async function preparePreviewAsset(file: File): Promise<CompressedVariant> {
  const err = validateImageFile(file);
  if (err) throw new Error(err);

  const objectUrl =
    typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
      ? URL.createObjectURL(file)
      : null;

  try {
    const src = objectUrl || (await readFileAsDataUrl(file));
    return await compressSourceToWebp(src, MAX_FULL_DIMENSION, WEBP_QUALITY);
  } finally {
    if (objectUrl) revokeTempUrl(objectUrl);
  }
}

/**
 * Compresses a File or Data URL into an immediately usable WebP Data URL (max 1000px @ 0.8)
 * for previewing / background removal without holding raw multi-MB files or blob URLs.
 */
export async function preparePreviewDataUrl(file: File): Promise<string> {
  const compressed = await preparePreviewAsset(file);
  return compressed.dataUrl;
}

function estimateFirestoreMediaDocBytes(
  fullDataUrl: string,
  thumbDataUrl: string
): number {
  // Include Base64 string bytes plus ~2 KB headroom for doc ID, metadata, and Firestore encoding overhead
  return utf8ByteLength(fullDataUrl) + utf8ByteLength(thumbDataUrl) + 2048;
}

function splitIntoChunks(data: string): MediaChunk[] {
  const chunks: MediaChunk[] = [];
  for (let i = 0; i < data.length; i += CHUNK_CHAR_SIZE) {
    const slice = data.slice(i, i + CHUNK_CHAR_SIZE);
    chunks.push({
      index: chunks.length,
      data: slice,
      byteSize: utf8ByteLength(slice),
    });
  }
  return chunks;
}

/**
 * Compresses image into max 1000px full WebP (~0.8) + max 256px thumbnail WebP (~0.8),
 * strips EXIF metadata, enforces safe Firestore per-document size limits, and chunks if needed.
 */
export async function prepareCompressedImagePair(
  fileOrDataUrl: File | string
): Promise<PreparedMediaPayload> {
  let tempObjectUrl: string | null = null;
  let sourceUrl: string;

  if (typeof fileOrDataUrl === 'string') {
    if (!fileOrDataUrl) {
      throw new Error('No image data provided.');
    }
    sourceUrl = fileOrDataUrl;
  } else {
    const err = validateImageFile(fileOrDataUrl);
    if (err) throw new Error(err);
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      tempObjectUrl = URL.createObjectURL(fileOrDataUrl);
      sourceUrl = tempObjectUrl;
    } else {
      sourceUrl = await readFileAsDataUrl(fileOrDataUrl);
    }
  }

  try {
    let full = await compressSourceToWebp(sourceUrl, MAX_FULL_DIMENSION, WEBP_QUALITY);
    const thumb = await compressSourceToWebp(sourceUrl, MAX_THUMB_DIMENSION, WEBP_QUALITY);

    // Step down quality slightly if single document would come close to safe ceiling
    if (estimateFirestoreMediaDocBytes(full.dataUrl, thumb.dataUrl) > MAX_SINGLE_DOC_BYTES) {
      const stepped = await compressSourceToWebp(sourceUrl, 900, 0.72);
      if (utf8ByteLength(stepped.dataUrl) < utf8ByteLength(full.dataUrl)) {
        full = stepped;
      }
    }

    const combinedBytes = estimateFirestoreMediaDocBytes(full.dataUrl, thumb.dataUrl);
    if (combinedBytes <= MAX_SINGLE_DOC_BYTES) {
      return {
        fullDataUrl: full.dataUrl,
        thumbDataUrl: thumb.dataUrl,
        contentType: full.contentType,
        width: full.width,
        height: full.height,
        thumbWidth: thumb.width,
        thumbHeight: thumb.height,
        byteSize: combinedBytes,
        chunks: [],
      };
    }

    // Fallback: chunk fullDataUrl into /media/{id}/chunks/{index} so each Firestore doc stays <= ~450 KB
    const chunks = splitIntoChunks(full.dataUrl);
    if (chunks.length > MAX_CHUNKS) {
      throw new Error(
        'Image is too large even after WebP compression. Please crop or choose a smaller photo.'
      );
    }

    const parentBytes = estimateFirestoreMediaDocBytes('', thumb.dataUrl);
    if (parentBytes > MAX_SINGLE_DOC_BYTES) {
      throw new Error('Thumbnail exceeded safe Firestore document size.');
    }

    return {
      fullDataUrl: '',
      thumbDataUrl: thumb.dataUrl,
      contentType: full.contentType,
      width: full.width,
      height: full.height,
      thumbWidth: thumb.width,
      thumbHeight: thumb.height,
      byteSize: parentBytes,
      chunks,
    };
  } finally {
    if (tempObjectUrl) revokeTempUrl(tempObjectUrl);
  }
}

function saveDemoMediaLocal(asset: MediaAsset): void {
  mediaCache.set(asset.id, asset);
  try {
    const raw = localStorage.getItem(DEMO_MEDIA_STORAGE_KEY);
    const map: Record<string, MediaAsset> = raw ? JSON.parse(raw) : {};
    map[asset.id] = asset;
    // Keep at most 20 most recent uploaded demo images in localStorage
    const keys = Object.keys(map);
    if (keys.length > 20) {
      delete map[keys[0]];
    }
    localStorage.setItem(DEMO_MEDIA_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore localStorage quota errors; in-memory mediaCache still holds it
  }
}

function readDemoMediaLocal(mediaId: string): MediaAsset | null {
  const mem = mediaCache.get(mediaId);
  if (mem) return mem;
  try {
    const raw = localStorage.getItem(DEMO_MEDIA_STORAGE_KEY);
    if (!raw) return null;
    const map: Record<string, MediaAsset> = JSON.parse(raw);
    const found = map[mediaId] || null;
    if (found) mediaCache.set(mediaId, found);
    return found;
  } catch {
    return null;
  }
}

/**
 * Compresses image in-browser, persists into Firestore `/media/{mediaId}` (with chunk subcollection
 * if ever needed), caches locally, and returns compact persistent references (`media:<id>` and `media-thumb:<id>`).
 * No Firebase Storage or paid services are used.
 */
export async function uploadImageAsset(
  fileOrDataUrl: File | string,
  userId: string,
  visibility: Visibility,
  isDemo: boolean,
  scope?: { conversationId?: string }
): Promise<UploadedAsset> {
  if (!userId) {
    throw new Error('You must be signed in to upload images.');
  }

  const prepared = await prepareCompressedImagePair(fileOrDataUrl);
  const mediaId = `${isDemo ? 'demo_' : ''}media_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  if (isDemo) {
    const demoAsset: MediaAsset = {
      id: mediaId,
      ownerId: userId,
      visibility,
      ...(scope?.conversationId ? { conversationId: scope.conversationId } : {}),
      contentType: prepared.contentType,
      width: prepared.width,
      height: prepared.height,
      thumbWidth: prepared.thumbWidth,
      thumbHeight: prepared.thumbHeight,
      fullDataUrl: prepared.fullDataUrl,
      thumbDataUrl: prepared.thumbDataUrl,
      byteSize: prepared.byteSize,
      createdAt: now,
    };
    saveDemoMediaLocal(demoAsset);
    return {
      imageUrl: makeMediaRef(mediaId, 'full'),
      thumbUrl: makeMediaRef(mediaId, 'thumb'),
      mediaId,
      width: prepared.width,
      height: prepared.height,
      contentType: prepared.contentType,
      byteSize: prepared.byteSize,
    };
  }

  const asset: MediaAsset = {
    id: mediaId,
    ownerId: userId,
    visibility,
    ...(scope?.conversationId ? { conversationId: scope.conversationId } : {}),
    contentType: prepared.contentType,
    width: prepared.width,
    height: prepared.height,
    thumbWidth: prepared.thumbWidth,
    thumbHeight: prepared.thumbHeight,
    fullDataUrl: prepared.fullDataUrl,
    thumbDataUrl: prepared.thumbDataUrl,
    byteSize: prepared.byteSize,
    ...(prepared.chunks.length > 0 ? { chunkCount: prepared.chunks.length } : {}),
    createdAt: now,
  };

  const path = `media/${mediaId}`;
  try {
    assertOnlineForWrite('upload this photo');
    await setDoc(doc(db, 'media', mediaId), cleanData(asset));
    if (prepared.chunks.length > 0) {
      for (const chunk of prepared.chunks) {
        await setDoc(doc(db, 'media', mediaId, 'chunks', String(chunk.index)), cleanData(chunk));
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  // Cache reconstructed full asset locally right away
  const cachedAsset: MediaAsset =
    prepared.chunks.length > 0
      ? { ...asset, fullDataUrl: prepared.chunks.map((c) => c.data).join('') }
      : asset;
  mediaCache.set(mediaId, cachedAsset);

  return {
    imageUrl: makeMediaRef(mediaId, 'full'),
    thumbUrl: makeMediaRef(mediaId, 'thumb'),
    mediaId,
    width: prepared.width,
    height: prepared.height,
    contentType: prepared.contentType,
    byteSize: prepared.byteSize,
  };
}

export async function getMediaAsset(mediaId: string): Promise<MediaAsset | null> {
  if (!mediaId) return null;

  if (mediaId.startsWith('demo_')) {
    return readDemoMediaLocal(mediaId);
  }

  const cached = mediaCache.get(mediaId);
  if (cached) return cached;

  const existingPromise = inflightReads.get(mediaId);
  if (existingPromise) return existingPromise;

  const promise = (async () => {
    const path = `media/${mediaId}`;
    try {
      const snap = await getDoc(doc(db, 'media', mediaId));
      if (!snap.exists()) return null;
      const raw = snap.data() as MediaAsset;

      let reconstructedFull = raw.fullDataUrl || '';
      if (!reconstructedFull && raw.chunkCount && raw.chunkCount > 0) {
        const parts: string[] = [];
        for (let i = 0; i < raw.chunkCount; i++) {
          const chunkSnap = await getDoc(doc(db, 'media', mediaId, 'chunks', String(i)));
          if (chunkSnap.exists()) {
            const c = chunkSnap.data() as MediaChunk;
            parts.push(c.data || '');
          }
        }
        reconstructedFull = parts.join('');
      }

      const fullAsset: MediaAsset = {
        ...raw,
        fullDataUrl: reconstructedFull || raw.thumbDataUrl || '',
      };
      mediaCache.set(mediaId, fullAsset);
      return fullAsset;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    } finally {
      inflightReads.delete(mediaId);
    }
  })();

  inflightReads.set(mediaId, promise);
  return promise;
}

/**
 * Resolves a stored image reference (`media:<id>`, `media-thumb:<id>`, `https://...`, `data:...`)
 * or fallback `mediaId` into a displayable URL with clear error categorization.
 */
export async function resolveMediaRef(
  src?: string | null,
  fallbackMediaId?: string | null
): Promise<ResolvedMediaResult> {
  const parsed = parseMediaRef(src);
  if (!parsed && !fallbackMediaId) {
    if (!src || !src.trim()) {
      return { url: null, status: 'empty' };
    }
    if (isLegacyLocalOnlyUrl(src)) {
      return {
        url: null,
        status: 'local-only',
        reason: 'This photo was saved locally on another device. Edit this entry to re-upload.',
      };
    }
    return { url: src, status: 'ready' };
  }

  const mediaId = parsed?.mediaId || fallbackMediaId || '';
  const variant = parsed?.variant || 'full';

  if (src && !parsed && !isLegacyLocalOnlyUrl(src)) {
    // Legacy inline Data URL or https URL stored directly on document
    return { url: src, status: 'ready' };
  }

  try {
    const asset = await getMediaAsset(mediaId);
    if (!asset) {
      return {
        url: null,
        status: 'not-found',
        reason: 'Image record could not be found in Firestore.',
      };
    }
    const resolvedUrl =
      variant === 'thumb'
        ? asset.thumbDataUrl || asset.fullDataUrl
        : asset.fullDataUrl || asset.thumbDataUrl;

    if (!resolvedUrl) {
      return {
        url: null,
        status: 'not-found',
        reason: 'Image data is missing.',
      };
    }

    return {
      url: resolvedUrl,
      status: 'ready',
      width: variant === 'thumb' ? asset.thumbWidth : asset.width,
      height: variant === 'thumb' ? asset.thumbHeight : asset.height,
    };
  } catch (err: any) {
    const msg = String(err?.message || '').toLowerCase();
    if (msg.includes('permission') || msg.includes('insufficient permissions')) {
      return {
        url: null,
        status: 'permission-denied',
        reason: 'Private or followers-only image.',
      };
    }
    return {
      url: null,
      status: 'error',
      reason: 'Could not load image.',
    };
  }
}

export async function updateMediaVisibility(
  mediaId: string | undefined,
  visibility: Visibility
): Promise<void> {
  if (!mediaId) return;
  if (mediaId.startsWith('demo_')) {
    const existing = readDemoMediaLocal(mediaId);
    if (existing) {
      saveDemoMediaLocal({ ...existing, visibility, updatedAt: new Date().toISOString() });
    }
    return;
  }

  mediaCache.delete(mediaId);
  try {
    await updateDoc(
      doc(db, 'media', mediaId),
      cleanData({
        visibility,
        updatedAt: new Date().toISOString(),
      })
    );
  } catch (error) {
    console.warn('Could not sync media visibility:', error);
  }
}

export async function deleteImageAsset(mediaId?: string): Promise<void> {
  if (!mediaId) return;
  mediaCache.delete(mediaId);

  if (mediaId.startsWith('demo_')) {
    try {
      const raw = localStorage.getItem(DEMO_MEDIA_STORAGE_KEY);
      if (raw) {
        const map = JSON.parse(raw) as Record<string, MediaAsset>;
        delete map[mediaId];
        localStorage.setItem(DEMO_MEDIA_STORAGE_KEY, JSON.stringify(map));
      }
    } catch {
      // ignore
    }
    return;
  }

  try {
    const snap = await getDoc(doc(db, 'media', mediaId)).catch(() => null);
    if (snap && snap.exists()) {
      const data = snap.data() as MediaAsset;
      if (data.chunkCount && data.chunkCount > 0) {
        for (let i = 0; i < data.chunkCount; i++) {
          await deleteDoc(doc(db, 'media', mediaId, 'chunks', String(i))).catch(() => {});
        }
      }
    }
    await deleteDoc(doc(db, 'media', mediaId));
  } catch (error) {
    console.warn('Media document cleanup notice:', error);
  }
}

export function clearMediaCache(): void {
  mediaCache.clear();
  inflightReads.clear();
}
