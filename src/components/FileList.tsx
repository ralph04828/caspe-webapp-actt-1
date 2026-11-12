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
  ExternalLink,
  Tag,
  Building
} from 'lucide-react';

interface FileListProps {
  files: FileRecord[];
  onPreview: (file: FileRecord) => void;
  onDownload: (file: FileRecord) => void;
  onDelete: (file: FileRecord) => void;
  onCopyLink: (file: FileRecord) => void;
}

export const FileList: React.FC<FileListProps> = ({
  files,
  onPreview,
  onDownload,
  onDelete,
  onCopyLink,
}) => {
  const getFileIcon = (fileType: string, fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (fileType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif'].includes(ext)) {
      return <ImageIcon className="w-4 h-4 text-pink-600" />;
    }
    if (fileType === 'application/pdf' || ext === 'pdf') {
      return <FileText className="w-4 h-4 text-rose-600" />;
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      return <FileArchive className="w-4 h-4 text-amber-600" />;
    }
    if (fileType.startsWith('video/') || ['mp4', 'mov', 'webm'].includes(ext)) {
      return <Film className="w-4 h-4 text-purple-600" />;
    }
    if (fileType.startsWith('audio/') || ['mp3', 'wav', 'aac'].includes(ext)) {
      return <Music className="w-4 h-4 text-indigo-600" />;
    }
    if (['ts', 'tsx', 'js', 'json', 'html', 'css'].includes(ext)) {
      return <FileCode className="w-4 h-4 text-blue-600" />;
    }
    return <File className="w-4 h-4 text-gray-500" />;
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
    <div className="bg-white rounded-2xl border border-pink-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-pink-50/60 border-b border-pink-100/80 text-gray-600 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-3.5 px-4">File Name</th>
              <th className="py-3.5 px-4">Client</th>
              <th className="py-3.5 px-4">Category</th>
              <th className="py-3.5 px-4">File Size</th>
              <th className="py-3.5 px-4">Upload Date</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pink-50">
            {files.map((file) => {
              const ext = file.fileName.split('.').pop()?.toUpperCase() || 'FILE';
              return (
                <tr
                  key={file.id}
                  className="hover:bg-pink-50/40 transition-colors group"
                >
                  {/* File Name */}
                  <td className="py-3.5 px-4 font-medium text-gray-900">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-pink-50 border border-pink-100/80 flex items-center justify-center shrink-0">
                        {getFileIcon(file.fileType, file.fileName)}
                      </div>
                      <div className="min-w-0">
                        <button
                          onClick={() => onPreview(file)}
                          className="font-medium text-gray-900 hover:text-[#831843] truncate block text-left max-w-xs sm:max-w-md transition-colors cursor-pointer"
                        >
                          {file.fileName}
                        </button>
                        <span className="text-[10px] text-gray-400 font-mono">
                          {ext}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Client */}
                  <td className="py-3.5 px-4 text-gray-700">
                    {file.clientName ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-pink-50 text-[#831843] font-medium text-[11px] border border-pink-200/50">
                        <Building className="w-3 h-3 text-[#9d174d]" />
                        {file.clientName}
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">Unassigned</span>
                    )}
                  </td>

                  {/* Category */}
                  <td className="py-3.5 px-4 text-gray-600">
                    <span className="inline-flex items-center gap-1 text-[11px] text-gray-700 bg-gray-100/70 px-2.5 py-0.5 rounded-md">
                      <Tag className="w-2.5 h-2.5 text-gray-400" />
                      {file.category || 'General'}
                    </span>
                  </td>

                  {/* File Size */}
                  <td className="py-3.5 px-4 text-gray-600 font-mono text-[11px]">
                    {formatFileSize(file.fileSize)}
                  </td>

                  {/* Upload Date */}
                  <td className="py-3.5 px-4 text-gray-500 whitespace-nowrap">
                    {formatDate(file.createdAt)}
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* Preview Button */}
                      <button
                        onClick={() => onPreview(file)}
                        title="Preview File"
                        className="p-1.5 text-gray-500 hover:text-[#831843] hover:bg-pink-100/70 rounded-lg transition-colors cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* Download Button */}
                      <button
                        onClick={() => onDownload(file)}
                        title="Download File"
                        className="p-1.5 text-gray-500 hover:text-[#831843] hover:bg-pink-100/70 rounded-lg transition-colors cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      {/* Share Link */}
                      <button
                        onClick={() => onCopyLink(file)}
                        title="Copy Share Link"
                        className="p-1.5 text-gray-500 hover:text-[#831843] hover:bg-pink-100/70 rounded-lg transition-colors cursor-pointer"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => onDelete(file)}
                        title="Delete File"
                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
