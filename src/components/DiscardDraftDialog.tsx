import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface DiscardDraftDialogProps {
  open: boolean;
  title?: string;
  description?: string;
  keepLabel?: string;
  discardLabel?: string;
  onKeep: () => void;
  onDiscard: () => void;
}

export const DiscardDraftDialog: React.FC<DiscardDraftDialogProps> = ({
  open,
  title = 'Discard this post?',
  description = 'You have unsaved changes. If you leave now, your photo, crop, and details will be lost.',
  keepLabel = 'Keep Editing',
  discardLabel = 'Discard',
  onKeep,
  onDiscard,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[95] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="discard-draft-title"
      aria-describedby="discard-draft-desc"
    >
      <div className="w-full max-w-sm rounded-modal bg-[#f5f4f0] dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040] p-5 space-y-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-control bg-amber-500/15 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 id="discard-draft-title" className="font-display font-bold text-base">
              {title}
            </h3>
            <p id="discard-draft-desc" className="text-xs text-[#4e4c46] dark:text-[#c2bfb8] leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onKeep}
            className="px-4 py-2.5 min-h-[44px] rounded-control border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
          >
            {keepLabel}
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="px-4 py-2.5 min-h-[44px] rounded-full bg-red-600 text-white text-xs font-semibold hover:opacity-90 cursor-pointer"
          >
            {discardLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
