import React, { useState, useEffect, useMemo } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthPage } from './components/AuthPage';
import { Sidebar } from './components/Sidebar';
import { HeaderBar } from './components/HeaderBar';
import { DropZone } from './components/DropZone';
import { FileList } from './components/FileList';
import { FileGrid } from './components/FileGrid';
import { FilePreviewModal } from './components/FilePreviewModal';
import { ClientShareModal } from './components/ClientShareModal';
import { FileRecord, SortOption, ViewMode } from './types';
import {
  subscribeUserFiles,
  addFileRecord,
  deleteFileRecord,
  seedSampleFiles,
} from './services/firestoreService';
import {
  uploadFileToStorage,
  deleteStorageFile,
  downloadFile,
} from './services/fileStorage';
import {
  Sparkles,
  UploadCloud,
  FileCheck2,
  FolderOpen,
  Info,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const Dashboard: React.FC = () => {
  const { userProfile, isDemoUser } = useAuth();

  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [activeClientFilter, setActiveClientFilter] = useState<string | null>(null);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | null>(null);

  const [isUploadOpen, setIsUploadOpen] = useState(true);
  const [previewFile, setPreviewFile] = useState<FileRecord | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  // Subscribe to real-time files from Firestore
  useEffect(() => {
    if (!userProfile) return;

    if (isDemoUser) {
      // Load demo sample files from local cache or seed
      const saved = localStorage.getItem(`swoooshz_files_${userProfile.uid}`);
      if (saved) {
        try {
          setFiles(JSON.parse(saved));
          setLoadingFiles(false);
          return;
        } catch {
          // fallback
        }
      }
      // Initial demo set
      const demoInit: FileRecord[] = [
        {
          id: 'demo_file_1',
          userId: userProfile.uid,
          fileName: 'Acme-Brand-Identity-Kit-2026.pdf',
          fileSize: 4280500,
          fileType: 'application/pdf',
          clientName: 'Acme Studio Co.',
          category: 'Brand Guidelines',
          notes: 'Complete identity system including typography rules and dark/light logos.',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
        },
        {
          id: 'demo_file_2',
          userId: userProfile.uid,
          fileName: 'Homepage-Mobile-Exploration.png',
          fileSize: 2150000,
          fileType: 'image/png',
          fileUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1000&auto=format&fit=crop&q=80',
          clientName: 'Bloom Health',
          category: 'Design Assets',
          notes: 'Updated hero section mockup with soft pink gradients.',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
        },
        {
          id: 'demo_file_3',
          userId: userProfile.uid,
          fileName: 'Contract-Design-Retainer-Signed.pdf',
          fileSize: 845000,
          fileType: 'application/pdf',
          clientName: 'Horizon Creative',
          category: 'Contracts & Briefs',
          notes: 'Signed agreement covering Q4 product design milestones.',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString(),
        },
      ];
      setFiles(demoInit);
      localStorage.setItem(`swoooshz_files_${userProfile.uid}`, JSON.stringify(demoInit));
      setLoadingFiles(false);
      return;
    }

    setLoadingFiles(true);
    const unsubscribe = subscribeUserFiles(
      userProfile.uid,
      (fetchedFiles) => {
        setFiles(fetchedFiles);
        setLoadingFiles(false);
      },
      (err) => {
        console.warn('Firestore subscription notice:', err.message);
        setLoadingFiles(false);
      }
    );

    return () => unsubscribe();
  }, [userProfile?.uid, isDemoUser]);

  // Handle file uploads
  const handleUploadFiles = async (
    items: {
      file: File;
      clientName: string;
      category: string;
      notes: string;
      onProgress: (percent: number) => void;
    }[]
  ) => {
    if (!userProfile) return;

    for (const item of items) {
      const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      try {
        const { fileUrl, storagePath } = await uploadFileToStorage(
          item.file,
          userProfile.uid,
          fileId,
          item.onProgress
        );

        const newRecord: FileRecord = {
          id: fileId,
          userId: userProfile.uid,
          fileName: item.file.name,
          fileSize: item.file.size,
          fileType: item.file.type || 'application/octet-stream',
          fileUrl,
          storagePath,
          clientName: item.clientName,
          category: item.category,
          notes: item.notes,
          createdAt: new Date().toISOString(),
        };

        if (isDemoUser) {
          setFiles((prev) => {
            const next = [newRecord, ...prev];
            localStorage.setItem(`swoooshz_files_${userProfile.uid}`, JSON.stringify(next));
            return next;
          });
        } else {
          await addFileRecord(newRecord);
        }

        showToast(`"${item.file.name}" uploaded successfully!`, 'success');
      } catch (err: any) {
        console.error('Upload failed for', item.file.name, err);
        showToast(`Failed to upload "${item.file.name}".`, 'error');
      }
    }
  };

  // Handle file delete
  const handleDeleteFile = async (file: FileRecord) => {
    try {
      await deleteStorageFile(file.storagePath, file.id);

      if (isDemoUser) {
        setFiles((prev) => {
          const next = prev.filter((f) => f.id !== file.id);
          if (userProfile) {
            localStorage.setItem(`swoooshz_files_${userProfile.uid}`, JSON.stringify(next));
          }
          return next;
        });
      } else {
        await deleteFileRecord(file.id);
      }

      showToast(`Deleted "${file.fileName}".`, 'info');
    } catch (err: any) {
      console.error('Delete error:', err);
      showToast('Could not delete file.', 'error');
    }
  };

  // Handle download
  const handleDownloadFile = async (file: FileRecord) => {
    showToast(`Downloading "${file.fileName}"...`, 'info');
    await downloadFile(file.id, file.fileName, file.fileUrl);
  };

  // Handle copy share link
  const handleCopyLink = (file: FileRecord) => {
    const url = file.fileUrl || window.location.href;
    navigator.clipboard.writeText(url);
    showToast('Direct file link copied to clipboard!', 'success');
  };

  // Seed sample files if user wants starter data
  const handleSeedSamples = async () => {
    if (!userProfile) return;
    try {
      if (isDemoUser) {
        const now = new Date();
        const demoSamples: FileRecord[] = [
          {
            id: `sample_${Date.now()}_1`,
            userId: userProfile.uid,
            fileName: 'Mobile-App-Wireframes-v2.pdf',
            fileSize: 3120000,
            fileType: 'application/pdf',
            clientName: 'Stellar Labs',
            category: 'Deliverables',
            notes: 'Complete user journeys for onboarding and checkout flow.',
            createdAt: now.toISOString(),
          },
          {
            id: `sample_${Date.now()}_2`,
            userId: userProfile.uid,
            fileName: 'Brand-Color-Palette-Tokens.json',
            fileSize: 14500,
            fileType: 'application/json',
            clientName: 'Acme Studio Co.',
            category: 'Brand Guidelines',
            notes: 'CSS & Tailwind compatible tokens for primary, dark pink, and light pink tints.',
            createdAt: now.toISOString(),
          },
        ];
        setFiles((prev) => {
          const next = [...demoSamples, ...prev];
          localStorage.setItem(`swoooshz_files_${userProfile.uid}`, JSON.stringify(next));
          return next;
        });
      } else {
        await seedSampleFiles(userProfile.uid);
      }
      showToast('Starter files added to your portal!', 'success');
    } catch (err) {
      console.error('Failed to seed samples:', err);
    }
  };

  // Computed existing clients for suggestions
  const existingClients = useMemo(() => {
    return Array.from(new Set(files.map((f) => f.clientName?.trim()).filter(Boolean))) as string[];
  }, [files]);

  // Filtered & Sorted files
  const displayedFiles = useMemo(() => {
    let result = [...files];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (f) =>
          f.fileName.toLowerCase().includes(q) ||
          f.clientName?.toLowerCase().includes(q) ||
          f.category?.toLowerCase().includes(q) ||
          f.notes?.toLowerCase().includes(q)
      );
    }

    // Client filter
    if (activeClientFilter) {
      result = result.filter((f) => f.clientName === activeClientFilter);
    }

    // Category filter
    if (activeCategoryFilter) {
      result = result.filter((f) => f.category === activeCategoryFilter);
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'date-asc':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'size-desc':
          return b.fileSize - a.fileSize;
        case 'size-asc':
          return a.fileSize - b.fileSize;
        case 'name-asc':
          return a.fileName.localeCompare(b.fileName);
        case 'name-desc':
          return b.fileName.localeCompare(a.fileName);
        default:
          return 0;
      }
    });

    return result;
  }, [files, searchQuery, activeClientFilter, activeCategoryFilter, sortBy]);

  return (
    <div className="flex h-screen bg-[#fff5f8] text-gray-900 font-sans overflow-hidden">
      {/* Dark Pink Sidebar */}
      <Sidebar
        files={files}
        activeClientFilter={activeClientFilter}
        onSelectClientFilter={(client) => {
          setActiveClientFilter(client);
          setActiveCategoryFilter(null);
        }}
        activeCategoryFilter={activeCategoryFilter}
        onSelectCategoryFilter={(category) => {
          setActiveCategoryFilter(category);
          setActiveClientFilter(null);
        }}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenShareModal={() => setIsShareModalOpen(true)}
      />

      {/* Main Content Area: White & Light Pink */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-gradient-to-b from-[#fff5f8] via-white to-[#fff0f5]/40">
        {/* Header Bar */}
        <HeaderBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortBy={sortBy}
          onSortChange={setSortBy}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          activeClientFilter={activeClientFilter}
          onClearClientFilter={() => setActiveClientFilter(null)}
          activeCategoryFilter={activeCategoryFilter}
          onClearCategoryFilter={() => setActiveCategoryFilter(null)}
          onOpenUpload={() => setIsUploadOpen(true)}
          onSeedSampleFiles={handleSeedSamples}
          fileCount={displayedFiles.length}
        />

        {/* Scrollable Dashboard Body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-6">
          {/* Welcome & Portal Header Banner */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-pink-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-pink-100 text-[#831843]">
                  Client File Portal
                </span>
                <span className="text-xs text-gray-400">
                  {files.length} {files.length === 1 ? 'file' : 'files'} securely hosted
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight mt-1.5">
                {activeClientFilter
                  ? `${activeClientFilter} Files`
                  : activeCategoryFilter
                  ? `${activeCategoryFilter}`
                  : `Welcome back, ${userProfile?.displayName || 'Creative'}`}
              </h2>
              <p className="text-xs text-gray-500 mt-1 max-w-xl">
                {activeClientFilter
                  ? `Viewing files specifically designated for ${activeClientFilter}. Upload new revisions or share access links.`
                  : 'Manage client deliverables, brand guides, and incoming project assets in one streamlined place.'}
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={() => setIsShareModalOpen(true)}
                className="px-3.5 py-2 text-xs font-semibold bg-pink-50 hover:bg-pink-100/80 text-[#831843] rounded-xl border border-pink-200/60 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>Client Link</span>
              </button>

              {files.length === 0 && (
                <button
                  onClick={handleSeedSamples}
                  className="px-3.5 py-2 text-xs font-semibold bg-white hover:bg-pink-50 text-gray-700 rounded-xl border border-pink-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#831843]" />
                  <span>Load Sample Files</span>
                </button>
              )}
            </div>
          </div>

          {/* Collapsible File Upload Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-[#831843]" />
                <span>Upload New Files</span>
              </h3>
              <button
                onClick={() => setIsUploadOpen(!isUploadOpen)}
                className="text-xs text-gray-500 hover:text-[#831843] flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>{isUploadOpen ? 'Collapse' : 'Expand Area'}</span>
                {isUploadOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {isUploadOpen && (
              <DropZone
                onUploadFiles={handleUploadFiles}
                defaultClientName={activeClientFilter}
                existingClients={existingClients}
              />
            )}
          </div>

          {/* Uploaded Files Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-gray-900">
                  Uploaded Files
                </h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-pink-50 text-[#831843] border border-pink-100">
                  {displayedFiles.length}
                </span>
              </div>

              {files.length > 0 && files.length !== displayedFiles.length && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setActiveClientFilter(null);
                    setActiveCategoryFilter(null);
                  }}
                  className="text-xs text-[#831843] hover:underline cursor-pointer"
                >
                  Show all {files.length} files
                </button>
              )}
            </div>

            {/* List or Grid View */}
            {loadingFiles ? (
              <div className="bg-white rounded-2xl border border-pink-100 p-12 text-center shadow-sm">
                <div className="inline-block animate-spin text-[#831843] text-xl mb-2">⭮</div>
                <p className="text-xs text-gray-500">Loading your files...</p>
              </div>
            ) : viewMode === 'list' ? (
              <FileList
                files={displayedFiles}
                onPreview={setPreviewFile}
                onDownload={handleDownloadFile}
                onDelete={handleDeleteFile}
                onCopyLink={handleCopyLink}
              />
            ) : (
              <FileGrid
                files={displayedFiles}
                onPreview={setPreviewFile}
                onDownload={handleDownloadFile}
                onDelete={handleDeleteFile}
                onCopyLink={handleCopyLink}
              />
            )}
          </div>
        </main>
      </div>

      {/* File Preview Modal */}
      <FilePreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
        onDownload={handleDownloadFile}
        onDelete={handleDeleteFile}
      />

      {/* Client Upload Link Share Modal */}
      <ClientShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        existingClients={existingClients}
        currentClient={activeClientFilter}
      />

      {/* Floating Notification Toast */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 bg-gray-900 text-white text-xs font-medium rounded-xl shadow-xl border border-gray-800 animate-slide-up">
          {notification.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-pink-400 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-pink-50/50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-[#831843] text-white flex items-center justify-center shadow-lg shadow-pink-900/10 mb-3 animate-pulse">
          <FolderOpen className="w-6 h-6" />
        </div>
        <p className="text-xs font-semibold text-[#831843]">Loading Swoooshz...</p>
      </div>
    );
  }

  if (!userProfile) {
    return <AuthPage />;
  }

  return <Dashboard />;
}
