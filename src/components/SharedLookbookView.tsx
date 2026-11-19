import React, { useEffect, useState } from 'react';
import { ShareLink } from '../types';
import { getShareLinkByToken } from '../services/firestoreService';
import { useSocial } from '../context/SocialContext';
import { GarmentImage } from './GarmentImage';
import { ArrowRight, Lock } from 'lucide-react';

interface SharedLookbookViewProps {
  token: string;
  onExitShareView: () => void;
}

export const SharedLookbookView: React.FC<SharedLookbookViewProps> = ({
  token,
  onExitShareView,
}) => {
  const { fetchShareByToken } = useSocial();
  const [link, setLink] = useState<ShareLink | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchShareByToken(token)
      .then(async (found) => {
        if (found) {
          setLink(found);
        } else {
          const direct = await getShareLinkByToken(token).catch(() => null);
          setLink(direct);
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="min-h-screen bg-[#f5f4f0] dark:bg-[#171717] text-[#171717] dark:text-[#e5e1da]">
      <header className="px-6 py-4 border-b border-[#d4cfc5] dark:border-[#404040] flex items-center justify-between mica-surface">
        <div>
          <span className="font-display text-2xl font-extrabold uppercase tracking-tight">SWOOOSH</span>
          <span className="ml-3 text-[11px] uppercase tracking-[0.18em] text-[#4e4c46] dark:text-[#c2bfb8]">
            Shared Lookbook
          </span>
        </div>
        <button
          type="button"
          onClick={onExitShareView}
          className="px-4 py-2 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
        >
          <span>Open SWOOOSH</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        {loading ? (
          <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">Loading shared lookbook...</p>
        ) : !link ? (
          <div className="p-10 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] text-center space-y-2">
            <Lock className="w-7 h-7 mx-auto opacity-60" />
            <h1 className="font-display font-bold text-xl">Lookbook link unavailable</h1>
            <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
              This share link has been revoked or does not exist.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <p className="text-xs font-mono-num uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]">
                Curated by {link.authorName} (@{link.authorUsername})
              </p>
              <h1 className="font-display text-3xl font-bold">{link.title}</h1>
              {link.description && (
                <p className="text-sm text-[#4e4c46] dark:text-[#c2bfb8]">{link.description}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {link.outfitsSnapshot.map((outfit) => (
                <article
                  key={outfit.id}
                  className="rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] overflow-hidden"
                >
                  <div className="p-3 bg-[#eae7e0] dark:bg-[#171717] grid grid-cols-3 gap-2">
                    {outfit.pieces.slice(0, 3).map((p, idx) => (
                      <div
                        key={idx}
                        className="aspect-square rounded-control overflow-hidden bg-white dark:bg-[#242424]"
                      >
                        <GarmentImage
                          src={p.thumbUrl || p.imageUrl}
                          mediaId={p.mediaId}
                          alt={p.name}
                          isPrivatePlaceholder={p.isPrivatePlaceholder}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="p-4 space-y-1">
                    <span className="text-[10px] font-mono-num uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]">
                      {outfit.styleCategory}
                    </span>
                    <h2 className="font-display font-bold text-base">{outfit.name}</h2>
                    {outfit.description && (
                      <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">{outfit.description}</p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
};
