import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Loader2,
  RotateCcw,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { WEBP_QUALITY } from '../services/storageService';

export type CropAspectKey = '1:1' | '3:4' | '4:5';

export interface PhotoCropState {
  zoom: number;
  offsetXNorm: number;
  offsetYNorm: number;
  aspectKey: CropAspectKey;
}

const ASPECT_CONFIG: Record<
  CropAspectKey,
  { label: string; viewW: number; viewH: number; ratioW: number; ratioH: number }
> = {
  '1:1': { label: '1:1 Square', viewW: 260, viewH: 260, ratioW: 1, ratioH: 1 },
  '3:4': { label: '3:4 Story', viewW: 234, viewH: 312, ratioW: 3, ratioH: 4 },
  '4:5': { label: '4:5 Portrait', viewW: 248, viewH: 310, ratioW: 4, ratioH: 5 },
};

export function createDefaultCropState(aspectKey: CropAspectKey = '1:1'): PhotoCropState {
  return {
    zoom: 1,
    offsetXNorm: 0,
    offsetYNorm: 0,
    aspectKey,
  };
}

export interface PhotoCropEditorProps {
  sourceUrl: string;
  initialCrop?: PhotoCropState | null;
  defaultAspect?: CropAspectKey;
  allowAspectSwitch?: boolean;
  circleMask?: boolean;
  outputMaxDim?: number;
  title?: string;
  subtitle?: string;
  backLabel?: string;
  doneLabel?: string;
  onBack: () => void;
  onChangePhotoFile?: (file: File) => void | Promise<void>;
  onDone: (result: { croppedDataUrl: string; cropState: PhotoCropState }) => Promise<void> | void;
}

export const PhotoCropEditor: React.FC<PhotoCropEditorProps> = ({
  sourceUrl,
  initialCrop,
  defaultAspect = '1:1',
  allowAspectSwitch = false,
  circleMask = false,
  outputMaxDim = 1000,
  title = 'Adjust & Crop Photo',
  subtitle = 'Drag to reposition and zoom to frame your shot.',
  backLabel = 'Back',
  doneLabel = 'Done',
  onBack,
  onChangePhotoFile,
  onDone,
}) => {
  const initialAspect = initialCrop?.aspectKey || defaultAspect;
  const [aspectKey, setAspectKey] = useState<CropAspectKey>(initialAspect);
  const [zoom, setZoom] = useState<number>(initialCrop?.zoom || 1);
  const [offset, setOffset] = useState<{ x: number; y: number }>(() => {
    const cfg = ASPECT_CONFIG[initialAspect];
    return {
      x: (initialCrop?.offsetXNorm || 0) * cfg.viewW,
      y: (initialCrop?.offsetYNorm || 0) * cfg.viewH,
    };
  });

  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [applying, setApplying] = useState(false);

  const dragStartRef = useRef<{ x: number; y: number; origX: number; origY: number } | null>(null);
  const prevSourceRef = useRef<string>(sourceUrl);

  const cfg = ASPECT_CONFIG[aspectKey];
  const viewW = cfg.viewW;
  const viewH = cfg.viewH;

  const getBaseScale = (img: HTMLImageElement, targetW: number, targetH: number) =>
    Math.max(targetW / img.naturalWidth, targetH / img.naturalHeight);

  const clampOffsetWith = (
    nextX: number,
    nextY: number,
    currentZoom: number,
    img: HTMLImageElement | null,
    targetW = viewW,
    targetH = viewH
  ) => {
    if (!img) return { x: 0, y: 0 };
    const scale = getBaseScale(img, targetW, targetH) * currentZoom;
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const maxX = Math.max(0, (drawW - targetW) / 2);
    const maxY = Math.max(0, (drawH - targetH) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, nextX)),
      y: Math.max(-maxY, Math.min(maxY, nextY)),
    };
  };

  useEffect(() => {
    let active = true;
    const sourceChanged = prevSourceRef.current !== sourceUrl;
    prevSourceRef.current = sourceUrl;

    const img = new Image();
    if (/^https?:\/\//i.test(sourceUrl)) {
      img.crossOrigin = 'anonymous';
    }

    img.onload = () => {
      if (!active) return;
      if (!img.naturalWidth || !img.naturalHeight) {
        const msg = 'Loaded image has invalid dimensions. Please pick another photo.';
        console.error(msg);
        setError(msg);
        setImgEl(null);
        return;
      }

      setImgEl(img);
      setError(null);

      if (sourceChanged && !initialCrop) {
        setZoom(1);
        setOffset({ x: 0, y: 0 });
      } else {
        const restoredZoom = initialCrop?.zoom || zoom || 1;
        const restoredCfg = ASPECT_CONFIG[initialCrop?.aspectKey || aspectKey];
        const rawX = initialCrop ? initialCrop.offsetXNorm * restoredCfg.viewW : offset.x;
        const rawY = initialCrop ? initialCrop.offsetYNorm * restoredCfg.viewH : offset.y;
        setOffset(clampOffsetWith(rawX, rawY, restoredZoom, img, restoredCfg.viewW, restoredCfg.viewH));
      }
    };

    img.onerror = (ev) => {
      if (!active) return;
      console.error('Failed to load image into photo editor:', ev);
      setError('Could not load this image for editing. Please try choosing another photo.');
      setImgEl(null);
    };

    img.src = sourceUrl;
    return () => {
      active = false;
    };
  }, [sourceUrl]);

  const baseScale = imgEl ? getBaseScale(imgEl, viewW, viewH) : 1;
  const effectiveScale = baseScale * zoom;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!imgEl || applying) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      origX: offset.x,
      origY: offset.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setOffset(
      clampOffsetWith(dragStartRef.current.origX + dx, dragStartRef.current.origY + dy, zoom, imgEl)
    );
  };

  const handlePointerUp = () => {
    setDragging(false);
    dragStartRef.current = null;
  };

  const handleResetCrop = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setError(null);
  };

  const handleAspectSwitch = (nextAspect: CropAspectKey) => {
    const nextCfg = ASPECT_CONFIG[nextAspect];
    setAspectKey(nextAspect);
    setOffset((prev) => clampOffsetWith(prev.x, prev.y, zoom, imgEl, nextCfg.viewW, nextCfg.viewH));
  };

  const handleDoneClick = async () => {
    if (!imgEl) {
      setError('Photo is still loading or unavailable. Please choose a valid photo.');
      return;
    }

    setApplying(true);
    setError(null);
    try {
      const longestSide = Math.min(1000, Math.max(256, outputMaxDim));
      let outW = longestSide;
      let outH = longestSide;
      if (cfg.ratioW >= cfg.ratioH) {
        outW = longestSide;
        outH = Math.round((longestSide * cfg.ratioH) / cfg.ratioW);
      } else {
        outH = longestSide;
        outW = Math.round((longestSide * cfg.ratioW) / cfg.ratioH);
      }

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Browser canvas is unavailable for image cropping.');
      }

      const scaleRatioX = outW / viewW;
      const scaleRatioY = outH / viewH;
      const drawW = imgEl.naturalWidth * effectiveScale * scaleRatioX;
      const drawH = imgEl.naturalHeight * effectiveScale * scaleRatioY;
      const drawX = (outW - drawW) / 2 + offset.x * scaleRatioX;
      const drawY = (outH - drawH) / 2 + offset.y * scaleRatioY;

      ctx.drawImage(imgEl, drawX, drawY, drawW, drawH);

      let dataUrl = canvas.toDataURL('image/webp', WEBP_QUALITY);
      if (!dataUrl.startsWith('data:image/webp')) {
        dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      }
      if (!dataUrl || !dataUrl.startsWith('data:image/')) {
        throw new Error('Could not export cropped photo.');
      }

      const cropState: PhotoCropState = {
        zoom,
        offsetXNorm: viewW > 0 ? offset.x / viewW : 0,
        offsetYNorm: viewH > 0 ? offset.y / viewH : 0,
        aspectKey,
      };

      await onDone({ croppedDataUrl: dataUrl, cropState });
    } catch (err: any) {
      console.error('Photo crop export failed:', err);
      setError(err?.message || 'Could not apply crop to this photo. Please try again.');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display font-bold text-sm text-[#171717] dark:text-[#e5e1da]">
            {title}
          </h3>
          <p className="text-[11px] text-[#4e4c46] dark:text-[#c2bfb8]">{subtitle}</p>
        </div>

        {onChangePhotoFile && (
          <label className="px-3 py-1.5 min-h-[36px] rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#171717] text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>Change photo</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) onChangePhotoFile(file);
              }}
              className="sr-only"
            />
          </label>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="p-3 rounded-control border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300 text-xs flex items-start gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {allowAspectSwitch && (
        <div className="flex items-center justify-center gap-1.5">
          {(['1:1', '3:4', '4:5'] as CropAspectKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => handleAspectSwitch(key)}
              className={`px-3 py-1.5 min-h-[36px] rounded-chip text-xs font-semibold border cursor-pointer ${
                aspectKey === key
                  ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] border-transparent'
                  : 'border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#171717]'
              }`}
            >
              {ASPECT_CONFIG[key].label}
            </button>
          ))}
        </div>
      )}

      {/* Interactive Crop Viewport */}
      <div className="flex justify-center">
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ width: viewW, height: viewH }}
          className="relative overflow-hidden rounded-card bg-[#171717] touch-none select-none cursor-grab active:cursor-grabbing border border-[#404040] shadow-inner"
        >
          {imgEl ? (
            <img
              src={sourceUrl}
              alt="Crop preview"
              draggable={false}
              style={{
                width: imgEl.naturalWidth * effectiveScale,
                height: imgEl.naturalHeight * effectiveScale,
                maxWidth: 'none',
                maxHeight: 'none',
                transform: `translate(${(viewW - imgEl.naturalWidth * effectiveScale) / 2 + offset.x}px, ${(viewH - imgEl.naturalHeight * effectiveScale) / 2 + offset.y}px)`,
              }}
              className="pointer-events-none select-none"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-[#b0b0b0]">
              {error ? 'Unable to load image' : 'Loading photo...'}
            </div>
          )}

          {circleMask ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-full ring-[60px] ring-black/55 border-2 border-[#e5e1da]/90"
            />
          ) : (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3"
            >
              <div className="border-r border-b border-white/15" />
              <div className="border-r border-b border-white/15" />
              <div className="border-b border-white/15" />
              <div className="border-r border-b border-white/15" />
              <div className="border-r border-b border-white/15" />
              <div className="border-b border-white/15" />
              <div className="border-r border-white/15" />
              <div className="border-r border-white/15" />
              <div />
            </div>
          )}
        </div>
      </div>

      {/* Zoom + Reset Controls */}
      <div className="flex items-center gap-2 max-w-xs mx-auto">
        <button
          type="button"
          onClick={() => {
            const next = Math.max(1, Number((zoom - 0.15).toFixed(2)));
            setZoom(next);
            setOffset((prev) => clampOffsetWith(prev.x, prev.y, next, imgEl));
          }}
          aria-label="Zoom out"
          className="w-10 h-10 rounded-control border border-[#d4cfc5] dark:border-[#404040] flex items-center justify-center hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer shrink-0"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <input
          type="range"
          min={1}
          max={3}
          step={0.05}
          value={zoom}
          aria-label="Zoom photo"
          onChange={(e) => {
            const next = Number(e.target.value);
            setZoom(next);
            setOffset((prev) => clampOffsetWith(prev.x, prev.y, next, imgEl));
          }}
          className="flex-1 accent-[#171717] dark:accent-[#e5e1da] h-2 cursor-pointer"
        />

        <button
          type="button"
          onClick={() => {
            const next = Math.min(3, Number((zoom + 0.15).toFixed(2)));
            setZoom(next);
            setOffset((prev) => clampOffsetWith(prev.x, prev.y, next, imgEl));
          }}
          aria-label="Zoom in"
          className="w-10 h-10 rounded-control border border-[#d4cfc5] dark:border-[#404040] flex items-center justify-center hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer shrink-0"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleResetCrop}
          aria-label="Reset crop"
          title="Reset zoom and position"
          className="w-10 h-10 rounded-control border border-[#d4cfc5] dark:border-[#404040] flex items-center justify-center hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#d4cfc5] dark:border-[#404040]">
        <button
          type="button"
          onClick={onBack}
          disabled={applying}
          className="px-4 py-2.5 min-h-[44px] rounded-control border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{backLabel}</span>
        </button>

        <button
          type="button"
          onClick={handleDoneClick}
          disabled={!imgEl || Boolean(error) || applying}
          className="px-6 py-2.5 min-h-[44px] rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-45 cursor-pointer hover:opacity-90"
        >
          {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          <span>{applying ? 'Applying...' : doneLabel}</span>
        </button>
      </div>
    </div>
  );
};

interface PhotoEditorModalProps {
  open: boolean;
  sourceUrl: string;
  initialCrop?: PhotoCropState | null;
  defaultAspect?: CropAspectKey;
  allowAspectSwitch?: boolean;
  circleMask?: boolean;
  outputMaxDim?: number;
  title?: string;
  subtitle?: string;
  doneLabel?: string;
  onCancel: () => void;
  onChangePhotoFile?: (file: File) => void | Promise<void>;
  onDone: (result: { croppedDataUrl: string; cropState: PhotoCropState }) => Promise<void> | void;
}

export const PhotoEditorModal: React.FC<PhotoEditorModalProps> = ({
  open,
  onCancel,
  ...editorProps
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open || !editorProps.sourceUrl) return null;

  return (
    <div
      className="fixed inset-0 z-[75] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={editorProps.title || 'Photo Editor'}
    >
      <div className="w-full max-w-md rounded-modal bg-[#f5f4f0] dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040] p-5 shadow-2xl my-auto">
        <div className="flex justify-end -mt-1 -mr-1 mb-1">
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close photo editor"
            className="w-9 h-9 rounded-control flex items-center justify-center hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <PhotoCropEditor {...editorProps} backLabel="Cancel" onBack={onCancel} />
      </div>
    </div>
  );
};
