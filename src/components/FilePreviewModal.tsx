import React, { useState } from 'react';
import { FileRecord } from '../types';
import { formatFileSize, formatDate } from '../utils/formatters';
import {
  X,
  Download,
  Trash2,
  Share2,
  Check,
  Building,
  Tag,
  Calendar,
  HardDrive,
  FileText,
  Image as ImageIcon,
  ExternalLink
} from 'lucide-react';

interface FilePreviewModalProps {
  file: FileRecord | null;
  onClose: () => void;
  onDownload: (file: FileRecord) => void;
  onDelete: (file: FileRecord) => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  file,
  onClose,
  onDownload,
  onDelete,
}) => {
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!file) return null;

  const isImage =
    file.fileType.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].some((ext) =>
      file.fileName.toLowerCase().endsWith(ext)
    );

  const isPdf =
    file.fileType === 'application/pdf' || file.fileName.toLowerCase().endsWith('.pdf');

  const isVideo =
    file.fileType.startsWith('video/') ||
    ['mp4', 'mov', 'webm'].some((ext) => file.fileName.toLowerCase().endsWith(ext));

  const isAudio =
    file.fileType.startsWith('audio/') ||
    ['mp3', 'wav'].some((ext) => file.fileName.toLowerCase().endsWith(ext));

  const handleCopyLink = () => {
    const url = file.fileUrl || window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDelete(file);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh] border border-pink-100">
        
        {/* Header */}
        <div className="p-4 sm:px-6 bg-pink-50/70 border-b border-pink-100 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-gray-900 truncate">
              {file.fileName}
            </h3>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500">
              <span className="font-mono">{formatFileSize(file.fileSize)}</span>
              <span>•</span>
              <span>Uploaded {formatDate(file.createdAt)}</span>
              {file.clientName && (
                <>
                  <span>•</span>
                  <span className="text-[#831843] font-medium flex items-center gap-1">
                    <Building className="w-3 h-3" />
                    {file.clientName}
                  </span>
                </>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-pink-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Viewer Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-pink-50/20 flex flex-col items-center justify-center min-h-[300px]">
          {isImage && file.fileUrl ? (
            <div className="max-h-[500px] flex items-center justify-center rounded-xl overflow-hidden shadow-sm border border-pink-100 bg-white p-2">
              <img
                src={file.fileUrl}
                alt={file.fileName}
                className="max-h-[460px] max-w-full object-contain rounded-lg"
              />
            </div>
          ) : isPdf ? (
            <div className="w-full max-w-md p-8 bg-white rounded-2xl border border-pink-100 text-center shadow-sm">
              <div className="w-16 h-16 rounded-2xl bg-rose-50 text-[#831843] flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8" />
              </div>
              <h4 className="text-sm font-bold text-gray-800 mb-1">{file.fileName}</h4>
              <p className="text-xs text-gray-500 mb-5">
                PDF document ready for review and download.
              </p>
              <button
                onClick={() => onDownload(file)}
                className="px-5 py-2.5 bg-[#831843] hover:bg-[#9d174d] text-white text-xs font-semibold rounded-xl inline-flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-pink-900/10"
              >
                <Download className="w-4 h-4" /> Download & View PDF
              </button>
            </div>
          ) : isVideo && file.fileUrl ? (
            <div className="w-full max-w-xl rounded-xl overflow-hidden shadow-sm bg-black">
              <video controls src={file.fileUrl} className="w-full max-h-[400px]" />
            </div>
          ) : isAudio && file.fileUrl ? (
            <div className="w-full max-w-md p-6 bg-white rounded-2xl border border-pink-100 text-center">
              <audio controls src={file.fileUrl} className="w-full mt-2" />
            </div>
          ) : (
            <div className="w-full max-w-md p-8 bg-white rounded-2xl border border-pink-100 text-center shadow-sm">
              <div className="w-16 h-16 rounded-2xl bg-pink-50 text-[#831843] flex items-center justify-center mx-auto mb-4">
                <HardDrive className="w-8 h-8" />
              </div>
              <h4 className="text-sm font-bold text-gray-800 mb-1">{file.fileName}</h4>
              <p className="text-xs text-gray-500 mb-5">
                Type: {file.fileType || 'Binary file'} ({formatFileSize(file.fileSize)})
              </p>
              <button
                onClick={() => onDownload(file)}
                className="px-5 py-2.5 bg-[#831843] hover:bg-[#9d174d] text-white text-xs font-semibold rounded-xl inline-flex items-center gap-2 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" /> Download File
              </button>
            </div>
          )}

          {/* Notes section if provided */}
          {file.notes && (
            <div className="w-full max-w-xl mt-4 p-3.5 bg-white rounded-xl border border-pink-100 text-xs">
              <span className="font-semibold text-gray-700 block mb-1">Notes:</span>
              <p className="text-gray-600 leading-relaxed">{file.notes}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-pink-100 flex items-center justify-between gap-3">
          {/* Delete Action */}
          <div>
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-rose-600 font-semibold">Are you sure?</span>
                <button
                  onClick={handleDelete}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Yes, Delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete File</span>
              </button>
            )}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-pink-50 border border-pink-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Link Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-gray-500" />
                  <span>Copy Link</span>
                </>
              )}
            </button>

            <button
              onClick={() => onDownload(file)}
              className="px-4 py-2 bg-[#831843] hover:bg-[#9d174d] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-md shadow-pink-900/10 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
