import React, { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { STYLE_CATEGORIES } from '../types';
import { useAuth } from '../context/AuthContext';
import { dedupeStyleTags, MAX_STYLE_TAG_LENGTH, validateCustomStyleTag } from '../utils/styleTags';

interface StyleTagSelectorProps {
  selected: string[];
  onChange: (next: string[]) => void;
  builtInOptions?: readonly string[];
  maxSelected?: number;
  singleSelect?: boolean;
  allowRemoveCustom?: boolean;
  label?: string;
  helperText?: string;
  onError?: (msg: string) => void;
}

export const StyleTagSelector: React.FC<StyleTagSelectorProps> = ({
  selected,
  onChange,
  builtInOptions = STYLE_CATEGORIES,
  maxSelected = 5,
  singleSelect = false,
  allowRemoveCustom = true,
  label,
  helperText,
  onError,
}) => {
  const { userProfile, updateAccountProfile } = useAuth();
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [customDraft, setCustomDraft] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [savingCustom, setSavingCustom] = useState(false);

  const savedCustomStyles = useMemo(
    () => dedupeStyleTags(userProfile?.customStyles || []),
    [userProfile?.customStyles]
  );

  const allOptions = useMemo(
    () => dedupeStyleTags([...builtInOptions, ...savedCustomStyles, ...selected], savedCustomStyles),
    [builtInOptions, savedCustomStyles, selected]
  );

  const customOnlySet = useMemo(() => {
    const builtInLower = new Set(builtInOptions.map((t) => t.toLowerCase()));
    return new Set(
      savedCustomStyles.filter((c) => !builtInLower.has(c.toLowerCase())).map((c) => c.toLowerCase())
    );
  }, [builtInOptions, savedCustomStyles]);

  const isSelected = (tag: string) =>
    selected.some((s) => s.toLowerCase() === tag.toLowerCase());

  const handleToggle = (tag: string) => {
    setInputError(null);
    if (singleSelect) {
      onChange([tag]);
      return;
    }

    if (isSelected(tag)) {
      onChange(selected.filter((s) => s.toLowerCase() !== tag.toLowerCase()));
      return;
    }

    if (selected.length >= maxSelected) {
      const msg = `You can choose up to ${maxSelected} style tags.`;
      setInputError(msg);
      onError?.(msg);
      return;
    }

    onChange(dedupeStyleTags([...selected, tag], savedCustomStyles, maxSelected));
  };

  const handleAddCustom = async () => {
    setInputError(null);
    const validation = validateCustomStyleTag(customDraft);
    if (!validation.ok) {
      setInputError(validation.error);
      onError?.(validation.error);
      return;
    }

    const formatted = validation.formatted;
    const existingMatch = allOptions.find((t) => t.toLowerCase() === formatted.toLowerCase());
    const finalTag = existingMatch || formatted;

    // Persist to user's saved profile styles if it's genuinely new
    const alreadyInBuiltInOrSaved = [...builtInOptions, ...savedCustomStyles].some(
      (t) => t.toLowerCase() === finalTag.toLowerCase()
    );

    if (!alreadyInBuiltInOrSaved && userProfile) {
      setSavingCustom(true);
      try {
        const nextCustomStyles = dedupeStyleTags([...savedCustomStyles, finalTag]);
        await updateAccountProfile({ customStyles: nextCustomStyles });
      } catch (err: any) {
        const msg = err?.message || 'Could not save custom style to your profile.';
        setInputError(msg);
        onError?.(msg);
        setSavingCustom(false);
        return;
      }
      setSavingCustom(false);
    }

    if (singleSelect) {
      onChange([finalTag]);
    } else if (!isSelected(finalTag)) {
      if (selected.length >= maxSelected) {
        onChange(dedupeStyleTags([...selected.slice(0, maxSelected - 1), finalTag], savedCustomStyles, maxSelected));
      } else {
        onChange(dedupeStyleTags([...selected, finalTag], savedCustomStyles, maxSelected));
      }
    }

    setCustomDraft('');
    setShowOtherInput(false);
  };

  const handleDeleteSavedCustom = async (tag: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userProfile) return;
    const nextCustom = savedCustomStyles.filter((t) => t.toLowerCase() !== tag.toLowerCase());
    try {
      await updateAccountProfile({ customStyles: nextCustom });
      if (isSelected(tag)) {
        const remaining = selected.filter((s) => s.toLowerCase() !== tag.toLowerCase());
        onChange(singleSelect && remaining.length === 0 ? [builtInOptions[0] || 'Streetwear'] : remaining);
      }
    } catch (err: any) {
      const msg = err?.message || 'Could not remove custom style.';
      setInputError(msg);
      onError?.(msg);
    }
  };

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between gap-2">
          <span className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]">
            {label}
          </span>
          {!singleSelect && (
            <span className="text-[11px] font-mono-num text-[#4e4c46] dark:text-[#c2bfb8]">
              {selected.length}/{maxSelected}
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {allOptions.map((tag) => {
          const active = isSelected(tag);
          const isSavedCustom = customOnlySet.has(tag.toLowerCase());
          return (
            <div
              key={tag.toLowerCase()}
              className={`inline-flex items-center rounded-chip border text-xs transition-colors ${
                active
                  ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] border-transparent font-semibold'
                  : 'border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#171717] text-[#171717] dark:text-[#e5e1da]'
              }`}
            >
              <button
                type="button"
                onClick={() => handleToggle(tag)}
                className="px-2.5 py-1.5 min-h-[32px] cursor-pointer text-left"
              >
                {tag}
              </button>
              {allowRemoveCustom && isSavedCustom && (
                <button
                  type="button"
                  onClick={(e) => handleDeleteSavedCustom(tag, e)}
                  aria-label={`Remove saved style ${tag}`}
                  title="Remove custom style"
                  className="pr-2 pl-0.5 py-1.5 opacity-70 hover:opacity-100 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => {
            setShowOtherInput((v) => !v);
            setInputError(null);
          }}
          className={`px-2.5 py-1.5 min-h-[32px] rounded-chip text-xs font-medium border inline-flex items-center gap-1 cursor-pointer transition-colors ${
            showOtherInput
              ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] border-transparent'
              : 'border-dashed border-[#4e4c46] dark:border-[#888888] hover:bg-[#eae7e0] dark:hover:bg-[#303030]'
          }`}
        >
          <Plus className="w-3 h-3" />
          <span>Other</span>
        </button>
      </div>

      {showOtherInput && (
        <div className="p-2.5 rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#171717] space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              maxLength={MAX_STYLE_TAG_LENGTH}
              value={customDraft}
              onChange={(e) => {
                setCustomDraft(e.target.value);
                if (inputError) setInputError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCustom();
                }
              }}
              placeholder="e.g. Gorpcore, Archive, Skater"
              className="flex-1 px-3 py-1.5 min-h-[36px] rounded-control text-xs bg-white dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040]"
            />
            <button
              type="button"
              onClick={handleAddCustom}
              disabled={savingCustom || !customDraft.trim()}
              className="px-3.5 py-1.5 min-h-[36px] rounded-control bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold disabled:opacity-50 cursor-pointer"
            >
              {savingCustom ? 'Saving...' : 'Add'}
            </button>
          </div>
          <p className="text-[11px] text-[#4e4c46] dark:text-[#b0b0b0]">
            Max {MAX_STYLE_TAG_LENGTH} chars · letters, numbers, spaces, and hyphens. Saved to your style list.
          </p>
        </div>
      )}

      {inputError && (
        <p className="text-[11px] text-red-600 dark:text-red-400">{inputError}</p>
      )}
      {helperText && !inputError && (
        <p className="text-[11px] text-[#4e4c46] dark:text-[#b0b0b0]">{helperText}</p>
      )}
    </div>
  );
};
