import React from 'react';
import { ClothingItem, Outfit } from '../types';
import { getOutfitAllItemIds, getOutfitTopIds, getTopLayerLabels } from '../utils/outfitLayers';
import { GarmentImage } from './GarmentImage';
import { Layers } from 'lucide-react';

interface OutfitCollageThumbProps {
  outfit: Outfit;
  wardrobe: ClothingItem[];
  hidePrivateDetails?: boolean;
}

export const OutfitCollageThumb: React.FC<OutfitCollageThumbProps> = ({
  outfit,
  wardrobe,
  hidePrivateDetails = false,
}) => {
  const topIds = getOutfitTopIds(outfit);
  const topLabels = getTopLayerLabels(topIds.length);
  const allIds = getOutfitAllItemIds(outfit);

  const resolvedPieces = allIds
    .map((id) => {
      const item = wardrobe.find((w) => w.id === id);
      const snap = outfit.pieceSnapshots?.find((s) => s.id === id);
      if (!item && !snap) return null;
      const isPrivate =
        hidePrivateDetails && ((item?.visibility === 'private') || snap?.isPrivatePlaceholder);
      const topIdx = topIds.indexOf(id);
      const label = topIdx >= 0 ? topLabels[topIdx] : item?.category || snap?.category || '';
      return {
        id,
        name: isPrivate ? 'Private piece' : item?.name || snap?.name || 'Piece',
        imageUrl: isPrivate
          ? undefined
          : item?.thumbUrl || item?.imageUrl || snap?.thumbUrl || snap?.imageUrl,
        mediaId: isPrivate ? undefined : item?.mediaId || snap?.mediaId,
        isCutout: item?.isCutout,
        label,
      };
    })
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  if (resolvedPieces.length === 0 && outfit.coverImageUrl) {
    return (
      <div className="w-full h-full bg-[#eae7e0] dark:bg-[#171717]">
        <GarmentImage
          src={outfit.coverImageUrl}
          mediaId={outfit.mediaId}
          alt={outfit.name}
          fallbackLabel={outfit.name}
        />
      </div>
    );
  }

  if (resolvedPieces.length === 0) {
    return (
      <div className="w-full h-full bg-[#eae7e0] dark:bg-[#171717] flex flex-col items-center justify-center p-2 text-center">
        <Layers className="w-5 h-5 opacity-45 mb-1" />
        <span className="text-[10px] font-semibold line-clamp-2 opacity-70">{outfit.name}</span>
      </div>
    );
  }

  if (resolvedPieces.length === 1) {
    const p = resolvedPieces[0];
    return (
      <div className="w-full h-full bg-[#eae7e0] dark:bg-[#171717]">
        <GarmentImage
          src={p.imageUrl}
          mediaId={p.mediaId}
          alt={p.name}
          fallbackLabel={p.name}
          isCutout={p.isCutout}
        />
      </div>
    );
  }

  const slots = resolvedPieces.slice(0, 4);
  const extraCount = Math.max(0, resolvedPieces.length - 4);

  return (
    <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-0.5 bg-[#d4cfc5] dark:bg-[#303030] relative">
      {[0, 1, 2, 3].map((idx) => {
        const piece = slots[idx];
        return (
          <div
            key={idx}
            className="w-full h-full bg-[#f5f4f0] dark:bg-[#171717] overflow-hidden relative"
          >
            {piece ? (
              <GarmentImage
                src={piece.imageUrl}
                mediaId={piece.mediaId}
                alt={piece.name}
                fallbackLabel={piece.name}
                isCutout={piece.isCutout}
              />
            ) : (
              <div className="w-full h-full bg-[#eae7e0]/60 dark:bg-[#202020]" />
            )}
          </div>
        );
      })}
      {extraCount > 0 && (
        <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-chip bg-black/75 text-white text-[10px] font-mono-num font-bold">
          +{extraCount}
        </span>
      )}
    </div>
  );
};
