import React, { useState } from 'react';
import { Shirt } from 'lucide-react';

interface GarmentImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export const GarmentImage: React.FC<GarmentImageProps> = ({
  src,
  alt,
  className = 'w-full h-full object-cover',
  fallbackLabel,
}) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#eae7e0] dark:bg-[#303030] text-[#5c5a54] dark:text-[#b0b0b0] p-4 text-center select-none">
        <Shirt className="w-7 h-7 stroke-[1.5] mb-2 opacity-60" />
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
      className={className}
    />
  );
};
