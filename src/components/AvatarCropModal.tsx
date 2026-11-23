import React, { useEffect, useRef, useState } from 'react';
import { Check, Loader2, RotateCcw, RotateCw, X, ZoomIn, ZoomOut } from 'lucide-react';

interface AvatarCropModalProps {
  sourceUrl: string;
  onCancel: () => void;
  onConfirm: (croppedDataUrl: string) => Promise<void> | void;
}

const VIEWPORT_SIZE = 260;
const OUTPUT_SIZE = 512;

export const AvatarCropModal: React.FC<AvatarCropModalProps> = ({
  sourceUrl,
  onCancel,
  onConfirm,
}) => {
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotationDeg, setRotationDeg] = useState<0 | 90 | 180 | 270>(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);

  const dragStartRef = useRef<{ x: number; y: number; origX: number; origY: number } | null>(null);

  useEffect(() => {
    let active = true;
    const img = new Image();
    if (/^https?:\/\//i.test(sourceUrl)) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      if (!active) return;
      setImgEl(img);
      setZoom(1);
      setRotationDeg(0);
      setOffset({ x: 0, y: 0 });
      setLoadError(null);
    };
    img.onerror = () => {
      if (!active) return;
      setLoadError('Could not load this image for cropping.');
    };
    img.src = sourceUrl;
    return () => {
      active = false;
    };
  }, [sourceUrl]);

  const getBaseScaleForRot = (img: HTMLImageElement, rot: number) => {
    const orientedW = rot % 180 !== 0 ? img.naturalHeight : img.naturalWidth;
    const orientedH = rot % 180 !== 0 ? img.naturalWidth : img.naturalHeight;
    return Math.max(VIEWPORT_SIZE / orientedW, VIEWPORT_SIZE / orientedH);
  };

  const baseScale = imgEl ? getBaseScaleForRot(imgEl, rotationDeg) : 1;
  const effectiveScale = baseScale * zoom;

  const clampOffset = (nextX: number, nextY: number, currentZoom = zoom, rot = rotationDeg) => {
    if (!imgEl) return { x: 0, y: 0 };
    const orientedW = rot % 180 !== 0 ? imgEl.naturalHeight : imgEl.naturalWidth;
    const orientedH = rot % 180 !== 0 ? imgEl.naturalWidth : imgEl.naturalHeight;
    const scale = getBaseScaleForRot(imgEl, rot) * currentZoom;
    const drawW = orientedW * scale;
    const drawH = orientedH * scale;
    const maxX = Math.max(0, (drawW - VIEWPORT_SIZE) / 2);
    const maxY = Math.max(0, (drawH - VIEWPORT_SIZE) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, nextX)),
      y: Math.max(-maxY, Math.min(maxY, nextY)),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
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
    setOffset(clampOffset(dragStartRef.current.origX + dx, dragStartRef.current.origY + dy));
  };

  const handlePointerUp = () => {
    setDragging(false);
    dragStartRef.current = null;
  };

  const handleRotate90 = () => {
    const nextRot = ((rotationDeg + 90) % 360) as 0 | 90 | 180 | 270;
    setRotationDeg(nextRot);
    setOffset((prev) => clampOffset(prev.x, prev.y, zoom, nextRot));
  };

  const handleApplyCrop = async () => {
    if (!imgEl) return;
    setSaving(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not initialize image cropper.');

      const ratio = OUTPUT_SIZE / VIEWPORT_SIZE;
      const drawW = imgEl.naturalWidth * effectiveScale * ratio;
      const drawH = imgEl.naturalHeight * effectiveScale * ratio;

      ctx.save();
      ctx.translate(OUTPUT_SIZE / 2 + offset.x * ratio, OUTPUT_SIZE / 2 + offset.y * ratio);
      ctx.rotate((rotationDeg * Math.PI) / 180);
      ctx.drawImage(imgEl, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      let dataUrl = canvas.toDataURL('image/webp', 0.86);
      if (!dataUrl.startsWith('data:image/webp')) {
        dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      }
      await onConfirm(dataUrl);
    } catch {
      setLoadError('Failed to crop image. Try picking another photo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="crop-avatar-title"
    >
      <div className="w-full max-w-sm rounded-modal bg-[#f5f4f0] dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040] p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 id="crop-avatar-title" className="font-display font-bold text-base">
              Crop Profile Photo
            </h3>
            <p className="text-[11px] text-[#4e4c46] dark:text-[#c2bfb8]">
              Drag to reposition, rotate, and adjust zoom for your circle avatar.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel crop"
            className="w-10 h-10 rounded-control flex items-center justify-center hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {loadError ? (
          <div className="p-4 rounded-control border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300 text-xs">
            {loadError}
          </div>
        ) : (
          <>
            <div className="flex justify-center">
              <div
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}
                className="relative overflow-hidden rounded-card bg-[#171717] touch-none select-none cursor-grab active:cursor-grabbing border border-[#404040]"
              >
                {imgEl && (
                  <img
                    src={sourceUrl}
                    alt="Crop preview"
                    draggable={false}
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      width: imgEl.naturalWidth * effectiveScale,
                      height: imgEl.naturalHeight * effectiveScale,
                      maxWidth: 'none',
                      maxHeight: 'none',
                      transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) rotate(${rotationDeg}deg)`,
                      transformOrigin: 'center center',
                    }}
                    className="pointer-events-none select-none"
                  />
                )}
                {/* Circular vignette mask showing exact circle avatar framing */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-full ring-[60px] ring-black/55 border-2 border-[#e5e1da]/90"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ZoomOut className="w-4 h-4 text-[#4e4c46] dark:text-[#c2bfb8] shrink-0" />
              <input
                type="range"
                min={1}
                max={2.6}
                step={0.05}
                value={zoom}
                aria-label="Zoom avatar"
                onChange={(e) => {
                  const nextZoom = Number(e.target.value);
                  setZoom(nextZoom);
                  setOffset((prev) => clampOffset(prev.x, prev.y, nextZoom));
                }}
                className="flex-1 accent-[#171717] dark:accent-[#e5e1da] h-2 cursor-pointer"
              />
              <ZoomIn className="w-4 h-4 text-[#4e4c46] dark:text-[#c2bfb8] shrink-0" />
              <button
                type="button"
                onClick={handleRotate90}
                disabled={!imgEl}
                aria-label="Rotate 90 degrees"
                title="Rotate 90° clockwise"
                className="w-9 h-9 rounded-control border border-[#d4cfc5] dark:border-[#404040] flex items-center justify-center cursor-pointer disabled:opacity-45"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setRotationDeg(0);
                  setOffset({ x: 0, y: 0 });
                }}
                aria-label="Reset crop"
                title="Reset rotation and zoom"
                className="w-9 h-9 rounded-control border border-[#d4cfc5] dark:border-[#404040] flex items-center justify-center cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 min-h-[44px] rounded-control border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!imgEl || Boolean(loadError) || saving}
            onClick={handleApplyCrop}
            className="flex-1 py-2.5 min-h-[44px] rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-45 cursor-pointer"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            <span>{saving ? 'Compressing...' : 'Apply Crop'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
