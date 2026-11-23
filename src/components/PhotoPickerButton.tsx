import React, { useState } from 'react';
import { Loader2, Upload } from 'lucide-react';

interface PhotoPickerButtonProps {
  label?: string;
  busyLabel?: string;
  multiple?: boolean;
  disabled?: boolean;
  busy?: boolean;
  icon?: React.ReactNode;
  className?: string;
  title?: string;
  ariaLabel?: string;
  onFileSelected?: (file: File) => void | Promise<void>;
  onFilesSelected?: (files: File[]) => void | Promise<void>;
  onError?: (message: string) => void;
  children?: React.ReactNode;
}

/**
 * Shared accessible photo picker without any `capture` attribute so mobile OS pickers
 * open smoothly in-place without triggering full camera reloads or broken return state.
 */
export const PhotoPickerButton: React.FC<PhotoPickerButtonProps> = ({
  label = 'Choose Photo',
  busyLabel = 'Preparing photo...',
  multiple = false,
  disabled = false,
  busy = false,
  icon,
  className = 'px-4 py-2.5 min-h-[44px] rounded-control bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer',
  title,
  ariaLabel,
  onFileSelected,
  onFilesSelected,
  onError,
  children,
}) => {
  const [internalBusy, setInternalBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const isWorking = busy || internalBusy;
  const isDisabled = disabled || isWorking;

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (fileList.length === 0) return;

    setLocalError(null);
    setInternalBusy(true);
    try {
      if (multiple && onFilesSelected) {
        await onFilesSelected(fileList);
      } else if (onFilesSelected && !onFileSelected) {
        await onFilesSelected(fileList);
      } else if (onFileSelected) {
        await onFileSelected(fileList[0]);
      }
    } catch (err: any) {
      const msg = err?.message || 'Could not load that photo. Try another image.';
      console.error('[SWOOOSH PhotoPicker] Failed handling selected photo:', err);
      setLocalError(msg);
      onError?.(msg);
    } finally {
      setInternalBusy(false);
    }
  };

  const wrapperSizing = className.includes('w-full')
    ? 'w-full flex'
    : className.includes('flex-1')
    ? 'flex-1 min-w-[140px] flex'
    : 'inline-flex';

  return (
    <div className={`${wrapperSizing} flex-col items-stretch gap-1`}>
      <label
        title={title}
        aria-label={ariaLabel}
        className={`${className} ${isDisabled ? 'opacity-60 pointer-events-none' : ''}`}
      >
        {children ? (
          children
        ) : (
          <>
            {isWorking ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : icon ?? <Upload className="w-4 h-4 shrink-0" />}
            {label ? <span>{isWorking ? busyLabel : label}</span> : null}
          </>
        )}
        <input
          type="file"
          accept="image/*"
          multiple={multiple}
          disabled={isDisabled}
          onChange={handleChange}
          className="sr-only"
        />
      </label>
      {localError && !onError && (
        <p role="alert" className="text-[11px] text-red-600 dark:text-red-400">
          {localError}
        </p>
      )}
    </div>
  );
};
