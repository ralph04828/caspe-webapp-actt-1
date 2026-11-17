import React, { useState } from 'react';
import { Lock, Shirt } from 'lucide-react';

interface GarmentImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
  isPrivatePlaceholder?: boolean;
  isCutout?: boolean;
}

export const GarmentImage: React.FC<GarmentImageProps> = ({
  src,
  alt,
  className = 'w-full h-full object-cover',
  fallbackLabel,
  isPrivatePlaceholder = false,
  isCutout = false,
}) => {
  const [failed, setFailed] = useState(false);

  if (isPrivatePlaceholder) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#eae7e0] dark:bg-[#2a2a2a] text-[#4e4c46] dark:text-[#c2bfb8] p-4 text-center select-none">
        <Lock className="w-6 h-6 stroke-[1.75] mb-1.5 opacity-80" />
        <span className="text-[11px] font-semibold tracking-wide uppercase">
          Private piece
        </span>
      </div>
    );
  }

  if (!src || failed) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#eae7e0] dark:bg-[#2a2a2a] text-[#4e4c46] dark:text-[#c2bfb8] p-4 text-center select-none">
        <Shirt className="w-7 h-7 stroke-[1.5] mb-2 opacity-70" />
        <span className="text-[11px] font-medium tracking-wide line-clamp-2 max-w-[140px]">
          {fallbackLabel || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${className} ${isCutout ? 'object-contain p-2 drop-shadow-sm' : ''}`}
    />
  );
};
