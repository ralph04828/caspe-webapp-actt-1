import React from 'react';
import { useAuth } from '../context/AuthContext';
import { FileRecord } from '../types';
import { formatFileSize } from '../utils/formatters';
import {
  Files,
  FolderKanban,
  Users,
  HardDrive,
  LogOut,
  Share2,
  Tag,
  Plus,
  Sparkles,
  ChevronRight,
  ShieldAlert,
  Briefcase
} from 'lucide-react';

interface SidebarProps {
  files: FileRecord[];
  activeClientFilter: string | null;
  onSelectClientFilter: (client: string | null) => void;
  activeCategoryFilter: string | null;
  onSelectCategoryFilter: (category: string | null) => void;
  onOpenUpload: () => void;
  onOpenShareModal: () => void;
  isClientMode?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  files,
  activeClientFilter,
  onSelectClientFilter,
  activeCategoryFilter,
  onSelectCategoryFilter,
  onOpenUpload,
  onOpenShareModal,
  isClientMode = false,
}) => {
  const { userProfile, signOutUser, isDemoUser } = useAuth();

  // Compute storage used
  const totalBytes = files.reduce((acc, f) => acc + (f.fileSize || 0), 0);
  const maxQuotaBytes = 1024 * 1024 * 1024; // 1 GB free allocation
  const usedPercentage = Math.min(100, Math.round((totalBytes / maxQuotaBytes) * 100));

  // Compute unique clients
  const uniqueClients = Array.from(
    new Set(files.map((f) => f.clientName?.trim()).filter(Boolean))
  ) as string[];

  const userInitial = userProfile?.displayName
    ? userProfile.displayName.charAt(0).toUpperCase()
    : userProfile?.email?.charAt(0).toUpperCase() || 'S';

  return (
    <aside className="w-64 bg-[#831843] text-white flex flex-col justify-between h-screen shrink-0 border-r border-[#9d174d]/50 select-none">
      {/* Top Branding & Main Nav */}
      <div className="p-5 flex flex-col overflow-y-auto">
        {/* App Title */}
        <div className="flex items-center justify-between pb-6 border-b border-[#9d174d]/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pink-400 to-rose-300 flex items-center justify-center shadow-md shadow-pink-950/40">
              <Files className="w-5 h-5 text-[#831843]" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white leading-none">
                Swoooshz
              </h1>
              <span className="text-[10px] font-medium text-pink-200/80 tracking-wide uppercase">
                Client File Portal
              </span>
            </div>
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="mt-5">
          <button
            onClick={onOpenUpload}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 text-white font-medium text-sm rounded-xl shadow-lg shadow-pink-950/20 flex items-center justify-center gap-2 transition-all cursor-pointer group"
          >
            <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
            <span>Upload Files</span>
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="mt-6 space-y-6">
          {/* Main Navigation */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-pink-300/80 px-2 mb-2">
              Files & Overview
            </div>
            <nav className="space-y-1">
              <button
                onClick={() => {
                  onSelectClientFilter(null);
                  onSelectCategoryFilter(null);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  activeClientFilter === null && activeCategoryFilter === null
                    ? 'bg-[#9d174d] text-white shadow-sm'
                    : 'text-pink-100 hover:bg-[#9d174d]/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <FolderKanban className="w-4 h-4 text-pink-300" />
                  <span>All Files</span>
                </div>
                <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-pink-200">
                  {files.length}
                </span>
              </button>

              <button
                onClick={onOpenShareModal}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-pink-100 hover:bg-[#9d174d]/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Share2 className="w-4 h-4 text-pink-300" />
                  <span>Client Upload Link</span>
                </div>
                <span className="text-[10px] bg-pink-400/30 text-pink-200 px-1.5 py-0.5 rounded">
                  Share
                </span>
              </button>
            </nav>
          </div>

          {/* Client Folders / Accounts */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-pink-300/80 px-2 mb-2 flex items-center justify-between">
              <span>Clients</span>
              <span className="text-[10px] text-pink-200/60 font-normal">
                {uniqueClients.length} active
              </span>
            </div>
            <div className="space-y-1">
              {uniqueClients.length === 0 ? (
                <div className="px-3 py-2 text-xs text-pink-200/60 italic">
                  No clients assigned yet. Tag files during upload!
                </div>
              ) : (
                uniqueClients.map((client) => {
                  const clientFileCount = files.filter((f) => f.clientName === client).length;
                  const isActive = activeClientFilter === client;
                  return (
                    <button
                      key={client}
                      onClick={() => {
                        onSelectClientFilter(isActive ? null : client);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-[#9d174d] text-white'
                          : 'text-pink-100/90 hover:bg-[#9d174d]/40'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Users className="w-3.5 h-3.5 text-pink-300 shrink-0" />
                        <span className="truncate">{client}</span>
                      </div>
                      <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-pink-200">
                        {clientFileCount}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Categories Quick Filter */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-pink-300/80 px-2 mb-2">
              Categories
            </div>
            <div className="space-y-1">
              {[
                'Design Assets',
                'Brand Guidelines',
                'Contracts & Briefs',
                'Deliverables',
                'Invoices',
              ].map((category) => {
                const count = files.filter((f) => f.category === category).length;
                const isActive = activeCategoryFilter === category;
                return (
                  <button
                    key={category}
                    onClick={() => onSelectCategoryFilter(isActive ? null : category)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[#9d174d] text-white'
                        : 'text-pink-100/80 hover:bg-[#9d174d]/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5 text-pink-300" />
                      <span>{category}</span>
                    </div>
                    {count > 0 && (
                      <span className="text-[10px] bg-white/10 px-1.5 py-0.2 rounded text-pink-200">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Storage Meter Widget */}
        <div className="mt-8 pt-4 border-t border-[#9d174d]/40">
          <div className="p-3 bg-[#701a3d]/80 rounded-xl border border-[#9d174d]/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-pink-100">
                <HardDrive className="w-3.5 h-3.5 text-pink-300" />
                <span>Storage</span>
              </div>
              <span className="text-[11px] text-pink-200 font-mono">
                {formatFileSize(totalBytes)} / 1 GB
              </span>
            </div>
            <div className="w-full bg-pink-950/60 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-pink-400 to-rose-300 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(4, usedPercentage)}%` }}
              />
            </div>
            <p className="text-[10px] text-pink-200/70 mt-1.5 flex items-center justify-between">
              <span>{usedPercentage}% used</span>
              <span>Unlimited uploads</span>
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Profile and Sign-out */}
      <div className="p-4 bg-[#701a3d] border-t border-[#9d174d]/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-pink-400 to-rose-300 text-[#831843] font-bold text-sm flex items-center justify-center shrink-0 shadow-inner">
              {userInitial}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate leading-tight">
                {userProfile?.displayName || userProfile?.email?.split('@')[0] || 'Creative Pro'}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-pink-900 text-pink-200 capitalize font-medium">
                  {userProfile?.role || 'Freelancer'}
                </span>
                {isDemoUser && (
                  <span className="text-[9px] text-amber-300 font-mono">
                    (Demo)
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => signOutUser()}
            title="Sign Out"
            className="p-2 rounded-lg text-pink-200 hover:text-white hover:bg-[#9d174d] transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
