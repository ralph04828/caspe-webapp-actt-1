import React, { useState, useRef } from 'react';
import { UploadCloud, File, X, Check, AlertCircle, Sparkles } from 'lucide-react';
import { formatFileSize, getFileCategory } from '../utils/formatters';

interface FileQueueItem {
  file: File;
  id: string;
  clientName: string;
  category: string;
  notes: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  errorMessage?: string;
}

interface DropZoneProps {
  onUploadFiles: (
    items: {
      file: File;
      clientName: string;
      category: string;
      notes: string;
      onProgress: (percent: number) => void;
    }[]
  ) => Promise<void>;
  defaultClientName?: string | null;
  existingClients?: string[];
  isCompact?: boolean;
}

export const DropZone: React.FC<DropZoneProps> = ({
  onUploadFiles,
  defaultClientName,
  existingClients = [],
  isCompact = false,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [queue, setQueue] = useState<FileQueueItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [globalClient, setGlobalClient] = useState(defaultClientName || '');
  const [globalCategory, setGlobalCategory] = useState('Design Assets');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToQueue(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToQueue(Array.from(e.target.files));
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const addFilesToQueue = (files: File[]) => {
    const newItems: FileQueueItem[] = files.map((file) => ({
      file,
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      clientName: globalClient || defaultClientName || 'Direct Client',
      category: getFileCategory(file.type, file.name),
      notes: '',
      progress: 0,
      status: 'pending',
    }));
    setQueue((prev) => [...prev, ...newItems]);
  };

  const removeItem = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const startUpload = async () => {
    if (queue.length === 0 || isUploading) return;
    setIsUploading(true);

    const pendingItems = queue.filter((i) => i.status === 'pending');

    const uploadPayloads = pendingItems.map((item) => ({
      file: item.file,
      clientName: item.clientName.trim() || 'General Client',
      category: item.category,
      notes: item.notes,
      onProgress: (percent: number) => {
        setQueue((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, progress: percent, status: 'uploading' } : q))
        );
      },
    }));

    try {
      await onUploadFiles(uploadPayloads);
      // Mark uploaded
      setQueue((prev) =>
        prev.map((q) => ({ ...q, status: 'completed', progress: 100 }))
      );
      // Auto clear queue after brief celebration
      setTimeout(() => {
        setQueue([]);
        setIsUploading(false);
      }, 1200);
    } catch (err: any) {
      console.error('Batch upload error:', err);
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-pink-200/80 shadow-sm p-5 transition-all">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Main Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
          isDragOver
            ? 'border-[#831843] bg-pink-100/60 scale-[0.99]'
            : 'border-pink-300 hover:border-pink-400 bg-pink-50/40 hover:bg-pink-50/80'
        }`}
      >
        <div className="w-12 h-12 rounded-2xl bg-white border border-pink-200 shadow-sm flex items-center justify-center text-[#831843] mb-3 group-hover:scale-105 transition-transform">
          <UploadCloud className="w-6 h-6" />
        </div>

        <h3 className="text-base font-semibold text-gray-900 tracking-tight">
          Upload Client Files
        </h3>
        <p className="text-xs text-gray-500 mt-1 max-w-sm">
          Drag and drop your images, documents, design deliverables, or PDFs here, or{' '}
          <span className="text-[#831843] font-semibold underline underline-offset-2">
            click to browse
          </span>
        </p>

        <div className="flex items-center gap-2 mt-3 text-[11px] text-pink-700/80 font-medium">
          <span className="px-2 py-0.5 bg-pink-100/80 rounded-md">Any file format</span>
          <span>•</span>
          <span className="px-2 py-0.5 bg-pink-100/80 rounded-md">Multiple files supported</span>
          <span>•</span>
          <span className="px-2 py-0.5 bg-pink-100/80 rounded-md">Secure user storage</span>
        </div>
      </div>

      {/* Default Assignment Controls (When queue exists or preparing) */}
      <div className="mt-4 pt-3 border-t border-pink-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Assign to Client
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={globalClient}
              onChange={(e) => {
                setGlobalClient(e.target.value);
                setQueue((prev) =>
                  prev.map((item) => ({ ...item, clientName: e.target.value || 'General Client' }))
                );
              }}
              placeholder="e.g. Acme Studio, Bloom Health"
              className="flex-1 px-3 py-1.5 text-xs bg-pink-50/30 border border-pink-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#831843]"
            />
          </div>
          {existingClients.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              <span className="text-[10px] text-gray-400 self-center">Suggestions:</span>
              {existingClients.slice(0, 3).map((client) => (
                <button
                  key={client}
                  type="button"
                  onClick={() => {
                    setGlobalClient(client);
                    setQueue((prev) => prev.map((item) => ({ ...item, clientName: client })));
                  }}
                  className="text-[10px] bg-pink-100/70 hover:bg-pink-200/80 text-pink-800 px-2 py-0.5 rounded transition-colors"
                >
                  {client}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Category
          </label>
          <select
            value={globalCategory}
            onChange={(e) => {
              setGlobalCategory(e.target.value);
              setQueue((prev) => prev.map((item) => ({ ...item, category: e.target.value })));
            }}
            className="w-full px-3 py-1.5 text-xs bg-pink-50/30 border border-pink-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#831843]"
          >
            <option value="Design Assets">Design Assets</option>
            <option value="Brand Guidelines">Brand Guidelines</option>
            <option value="Contracts & Briefs">Contracts & Briefs</option>
            <option value="Deliverables">Deliverables</option>
            <option value="Invoices">Invoices</option>
            <option value="General">General</option>
          </select>
        </div>
      </div>

      {/* Selected Files Queue */}
      {queue.length > 0 && (
        <div className="mt-4 pt-4 border-t border-pink-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-800">
              Files to Upload ({queue.length})
            </span>
            <button
              onClick={() => setQueue([])}
              disabled={isUploading}
              className="text-[11px] text-gray-400 hover:text-rose-600 transition-colors cursor-pointer"
            >
              Clear all
            </button>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {queue.map((item) => (
              <div
                key={item.id}
                className="p-2.5 bg-pink-50/40 rounded-xl border border-pink-100 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-7 h-7 rounded-lg bg-pink-100 text-[#831843] flex items-center justify-center shrink-0">
                    <File className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-800 truncate">{item.file.name}</p>
                    <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                      <span>{formatFileSize(item.file.size)}</span>
                      <span>•</span>
                      <span className="text-[#831843] font-medium">{item.clientName}</span>
                      <span>•</span>
                      <span className="text-gray-600">{item.category}</span>
                    </div>
                  </div>
                </div>

                {/* Status or Remove */}
                <div className="flex items-center gap-2 shrink-0">
                  {item.status === 'uploading' && (
                    <div className="w-16 bg-pink-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-[#831843] h-1.5 rounded-full transition-all"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}

                  {item.status === 'completed' && (
                    <span className="text-emerald-600 flex items-center gap-1 font-semibold text-[11px]">
                      <Check className="w-3.5 h-3.5" /> Uploaded
                    </span>
                  )}

                  {item.status === 'pending' && (
                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-1 text-gray-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Upload Button */}
          <div className="mt-4 flex items-center justify-end gap-3">
            <button
              onClick={() => setQueue([])}
              disabled={isUploading}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={startUpload}
              disabled={isUploading}
              className="px-5 py-2.5 bg-[#831843] hover:bg-[#9d174d] text-white text-xs font-semibold rounded-xl shadow-md shadow-pink-900/10 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isUploading ? (
                <>
                  <span className="inline-block animate-spin mr-1">⭮</span>
                  <span>Uploading {queue.length} files...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Start Upload ({queue.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
