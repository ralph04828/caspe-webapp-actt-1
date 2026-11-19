import React, { useEffect, useState } from 'react';
import { ImageOff, Lock, Shirt, Upload } from 'lucide-react';
import { MediaResolutionStatus, parseMediaRef, resolveMediaRef } from '../services/storageService';

interface GarmentImageProps {
  src?: string;
  mediaId?: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
  isPrivatePlaceholder?: boolean;
  isCutout?: boolean;
  onReuploadClick?: () => void;
}

export const GarmentImage: React.FC<GarmentImageProps> = ({
  src,
  mediaId,
  alt,
  className = 'w-full h-full object-cover',
  fallbackLabel,
  isPrivatePlaceholder = false,
  isCutout = false,
  onReuploadClick,
}) => {
  const needsAsyncResolve = Boolean(parseMediaRef(src) || (!src && mediaId));
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(() =>
    needsAsyncResolve ? null : src || null
  );
  const [status, setStatus] = useState<MediaResolutionStatus>(() =>
    needsAsyncResolve ? 'empty' : src ? 'ready' : 'empty'
  );
  const [loading, setLoading] = useState<boolean>(needsAsyncResolve);
  const [imgFailed, setImgFailed] = useState<boolean>(false);

  useEffect(() => {
    if (isPrivatePlaceholder) {
      setResolvedUrl(null);
      setStatus('permission-denied');
      setLoading(false);
      setImgFailed(false);
      return;
    }

    let cancelled = false;
    setImgFailed(false);

    if (!src && !mediaId) {
      setResolvedUrl(null);
      setStatus('empty');
      setLoading(false);
      return;
    }

    if (parseMediaRef(src) || (!src && mediaId)) {
      setLoading(true);
    }

    resolveMediaRef(src, mediaId).then((res) => {
      if (cancelled) return;
      setResolvedUrl(res.url);
      setStatus(res.status);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [src, mediaId, isPrivatePlaceholder]);

  if (isPrivatePlaceholder || status === 'permission-denied') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#eae7e0] dark:bg-[#2a2a2a] text-[#4e4c46] dark:text-[#c2bfb8] p-4 text-center select-none">
        <Lock className="w-6 h-6 stroke-[1.75] mb-1.5 opacity-80" />
        <span className="text-[11px] font-semibold tracking-wide uppercase">
          Private piece
        </span>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        aria-label={`Loading ${alt}`}
        className="w-full h-full flex items-center justify-center bg-[#eae7e0] dark:bg-[#2a2a2a] animate-pulse select-none"
      >
        <Shirt className="w-6 h-6 stroke-[1.5] opacity-35 text-[#4e4c46] dark:text-[#c2bfb8]" />
      </div>
    );
  }

  if (status === 'local-only') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#eae7e0] dark:bg-[#2a2a2a] text-[#4e4c46] dark:text-[#c2bfb8] p-3 text-center select-none gap-1.5">
        <ImageOff className="w-5 h-5 stroke-[1.6] opacity-75" />
        <span className="text-[11px] font-semibold leading-tight max-w-[160px]">
          Local photo unavailable on this device
        </span>
        {onReuploadClick && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReuploadClick();
            }}
            className="mt-0.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-chip border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#171717] text-[10px] font-semibold cursor-pointer hover:opacity-85"
          >
            <Upload className="w-3 h-3" />
            <span>Re-upload</span>
          </button>
        )}
      </div>
    );
  }

  if (!resolvedUrl || imgFailed || status === 'not-found' || status === 'error') {
    const showMissingHint = status === 'not-found' || status === 'error' || imgFailed;
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#eae7e0] dark:bg-[#2a2a2a] text-[#4e4c46] dark:text-[#c2bfb8] p-4 text-center select-none">
        {showMissingHint ? (
          <ImageOff className="w-6 h-6 stroke-[1.5] mb-1.5 opacity-65" />
        ) : (
          <Shirt className="w-7 h-7 stroke-[1.5] mb-2 opacity-70" />
        )}
        <span className="text-[11px] font-medium tracking-wide line-clamp-2 max-w-[150px]">
          {fallbackLabel || alt}
        </span>
        {showMissingHint && (
          <span className="text-[10px] opacity-70 mt-0.5">Photo unavailable</span>
        )}
      </div>
    );
  }

  return (
    <img
      src={resolvedUrl}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setImgFailed(true)}
      className={`${className} ${isCutout ? 'object-contain p-2 drop-shadow-sm' : ''}`}
    />
  );
};
