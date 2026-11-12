import React from 'react';
import { FileRecord } from '../types';
import { formatFileSize, formatDate } from '../utils/formatters';
import {
  FileText,
  Image as ImageIcon,
  FileCode,
  FileArchive,
  Film,
  Music,
  File,
  Eye,
  Download,
  Trash2,
  Share2,
  Building,
  Tag
} from 'lucide-react';

interface FileGridProps {
  files: FileRecord[];
  onPreview: (file: FileRecord) => void;
  onDownload: (file: FileRecord) => void;
  onDelete: (file: FileRecord) => void;
  onCopyLink: (file: FileRecord) => void;
}

export const FileGrid: React.FC<FileGridProps> = ({
  files,
  onPreview,
  onDownload,
  onDelete,
  onCopyLink,
}) => {
  const isImageFile = (type: string, name: string) => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    return type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(ext);
  };

  const getFileIcon = (fileType: string, fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (fileType === 'application/pdf' || ext === 'pdf') {
      return <FileText className="w-8 h-8 text-rose-500" />;
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      return <FileArchive className="w-8 h-8 text-amber-500" />;
    }
    if (fileType.startsWith('video/') || ['mp4', 'mov', 'webm'].includes(ext)) {
      return <Film className="w-8 h-8 text-purple-500" />;
    }
    if (fileType.startsWith('audio/') || ['mp3', 'wav'].includes(ext)) {
      return <Music className="w-8 h-8 text-indigo-500" />;
    }
    if (['ts', 'tsx', 'js', 'json', 'html', 'css'].includes(ext)) {
      return <FileCode className="w-8 h-8 text-blue-500" />;
    }
    return <File className="w-8 h-8 text-gray-400" />;
  };

  if (files.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-pink-100 p-12 text-center shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-pink-50 text-[#831843] flex items-center justify-center mx-auto mb-3">
          <File className="w-8 h-8 opacity-60" />
        </div>
        <h4 className="text-base font-semibold text-gray-800">No files found</h4>
        <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
          No files match your current filters. Upload a new file or clear your search to view all items.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {files.map((file) => {
        const isImg = isImageFile(file.fileType, file.fileName);
        const ext = file.fileName.split('.').pop()?.toUpperCase() || 'FILE';

        return (
          <div
            key={file.id}
            className="bg-white rounded-2xl border border-pink-100/90 hover:border-pink-300 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
          >
            {/* Thumbnail / Header Area */}
            <div
              onClick={() => onPreview(file)}
              className="h-36 bg-gradient-to-br from-pink-50/50 to-pink-100/30 flex items-center justify-center relative cursor-pointer overflow-hidden border-b border-pink-50"
            >
              {isImg && file.fileUrl ? (
                <img
                  src={file.fileUrl}
                  alt={file.fileName}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => {
                    // fallback if image blob expired or broken
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="flex flex-col items-center gap-1.5 p-4 text-center">
                  {getFileIcon(file.fileType, file.fileName)}
                  <span className="text-[10px] font-bold text-gray-400 font-mono tracking-wider">
                    {ext}
                  </span>
                </div>
              )}

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <span className="px-3 py-1 bg-white/90 text-[#831843] text-xs font-semibold rounded-full shadow-sm flex items-center gap-1.5 backdrop-blur-sm">
                  <Eye className="w-3.5 h-3.5" /> Quick Preview
                </span>
              </div>
            </div>

            {/* Metadata Body */}
            <div className="p-3.5 flex flex-col gap-2">
              <div className="min-w-0">
                <button
                  onClick={() => onPreview(file)}
                  className="text-xs font-semibold text-gray-900 hover:text-[#831843] truncate block text-left w-full transition-colors cursor-pointer"
                  title={file.fileName}
                >
                  {file.fileName}
                </button>
                <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1 font-mono">
                  <span>{formatFileSize(file.fileSize)}</span>
                  <span>{formatDate(file.createdAt)}</span>
                </div>
              </div>

              {/* Client & Category Tag */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-pink-50 text-[10px]">
                {file.clientName && (
                  <span className="px-2 py-0.5 rounded-md bg-pink-50 text-[#831843] font-medium border border-pink-100/60 truncate max-w-[130px]">
                    {file.clientName}
                  </span>
                )}
                {file.category && (
                  <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 truncate max-w-[110px]">
                    {file.category}
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-pink-50/80">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onPreview(file)}
                    title="Preview"
                    className="p-1.5 text-gray-400 hover:text-[#831843] hover:bg-pink-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDownload(file)}
                    title="Download"
                    className="p-1.5 text-gray-400 hover:text-[#831843] hover:bg-pink-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onCopyLink(file)}
                    title="Copy Share Link"
                    className="p-1.5 text-gray-400 hover:text-[#831843] hover:bg-pink-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={() => onDelete(file)}
                  title="Delete"
                  className="p-1.5 text-gray-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
