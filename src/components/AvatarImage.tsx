import React, { useEffect, useState } from 'react';
import { parseMediaRef, resolveMediaRef } from '../services/storageService';

interface AvatarImageProps {
  src?: string;
  mediaId?: string;
  name?: string;
  sizeClass?: string;
  textSizeClass?: string;
  className?: string;
}

export const AvatarImage: React.FC<AvatarImageProps> = ({
  src,
  mediaId,
  name = 'S',
  sizeClass = 'w-10 h-10',
  textSizeClass = 'text-sm',
  className = '',
}) => {
  const needsAsyncResolve = Boolean(parseMediaRef(src) || (!src && mediaId));
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(() =>
    needsAsyncResolve ? null : src || null
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);

    if (!src && !mediaId) {
      setResolvedUrl(null);
      return;
    }

    resolveMediaRef(src, mediaId).then((res) => {
      if (cancelled) return;
      setResolvedUrl(res.status === 'ready' ? res.url : null);
    });

    return () => {
      cancelled = true;
    };
  }, [src, mediaId]);

  const initial = (name.trim() || 'S').charAt(0).toUpperCase();

  if (!resolvedUrl || failed) {
    return (
      <div
        aria-label={name}
        className={`${sizeClass} rounded-full bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] font-display font-bold ${textSizeClass} flex items-center justify-center shrink-0 select-none ${className}`}
      >
        {initial}
      </div>
    );
  }

  return (
    <img
      src={resolvedUrl}
      alt={name}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${sizeClass} rounded-full object-cover border border-[#d4cfc5] dark:border-[#404040] shrink-0 ${className}`}
    />
  );
};
