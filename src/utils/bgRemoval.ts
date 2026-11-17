/**
 * Client-side background removal using border backdrop sampling + flood-fill + soft alpha matting.
 * Runs 100% in the browser at zero cost and works offline.
 */
export interface BgRemovalResult {
  cutoutDataUrl: string;
  width: number;
  height: number;
}

function colorDist(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

export async function removeBackgroundClient(
  sourceDataUrl: string,
  tolerance = 36,
  onProgress?: (pct: number) => void
): Promise<BgRemovalResult> {
  onProgress?.(15);

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Could not decode image for background removal.'));
    el.src = sourceDataUrl;
  });

  onProgress?.(35);

  // Limit processing canvas to max 900px for crisp cutouts & <120ms speed
  const maxDim = 900;
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
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Canvas 2D context is unavailable in this browser.');
  }

  ctx.drawImage(img, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // Sample perimeter pixels to estimate dominant backdrop color
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let sampleCount = 0;

  const samplePixel = (x: number, y: number) => {
    const idx = (y * w + x) * 4;
    if (data[idx + 3] < 20) return;
    sumR += data[idx];
    sumG += data[idx + 1];
    sumB += data[idx + 2];
    sampleCount++;
  };

  for (let x = 0; x < w; x += Math.max(1, Math.floor(w / 40))) {
    samplePixel(x, 0);
    samplePixel(x, h - 1);
  }
  for (let y = 0; y < h; y += Math.max(1, Math.floor(h / 40))) {
    samplePixel(0, y);
    samplePixel(w - 1, y);
  }

  if (sampleCount === 0) {
    return { cutoutDataUrl: sourceDataUrl, width: w, height: h };
  }

  const bgR = sumR / sampleCount;
  const bgG = sumG / sampleCount;
  const bgB = sumB / sampleCount;

  onProgress?.(60);

  // BFS Flood-fill from all 4 borders so enclosed pockets inside garments are preserved
  const total = w * h;
  const visited = new Uint8Array(total);
  const maskBg = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const hardTol = tolerance;
  const softTol = tolerance + 22;

  const tryEnqueue = (x: number, y: number) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const p = y * w + x;
    if (visited[p]) return;
    visited[p] = 1;
    const i = p * 4;
    const d = colorDist(data[i], data[i + 1], data[i + 2], bgR, bgG, bgB);
    if (d <= softTol) {
      queue[tail++] = p;
    }
  };

  for (let x = 0; x < w; x++) {
    tryEnqueue(x, 0);
    tryEnqueue(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    tryEnqueue(0, y);
    tryEnqueue(w - 1, y);
  }

  while (head < tail) {
    const p = queue[head++];
    const i = p * 4;
    const d = colorDist(data[i], data[i + 1], data[i + 2], bgR, bgG, bgB);
    if (d <= hardTol) {
      maskBg[p] = 255; // Fully transparent
      const x = p % w;
      const y = (p / w) | 0;
      tryEnqueue(x + 1, y);
      tryEnqueue(x - 1, y);
      tryEnqueue(x, y + 1);
      tryEnqueue(x, y - 1);
    } else if (d <= softTol) {
      // Soft feather alpha transition along garment contour
      const ratio = (d - hardTol) / Math.max(1, softTol - hardTol);
      maskBg[p] = Math.round((1 - ratio) * 200);
    }
  }

  onProgress?.(85);

  for (let p = 0; p < total; p++) {
    if (maskBg[p] > 0) {
      const i = p * 4;
      const newAlpha = Math.max(0, data[i + 3] - maskBg[p]);
      data[i + 3] = newAlpha;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  onProgress?.(100);

  // Preserve transparency via WebP alpha
  let out = canvas.toDataURL('image/webp', 0.84);
  if (!out.startsWith('data:image/webp')) {
    out = canvas.toDataURL('image/png');
  }
  return { cutoutDataUrl: out, width: w, height: h };
}
