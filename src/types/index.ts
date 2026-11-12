export type UserRole = 'freelancer' | 'designer' | 'client';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: UserRole;
  createdAt: string;
}

export interface FileRecord {
  id: string;
  userId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileUrl?: string;
  storagePath?: string;
  clientName?: string;
  category?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  previewUrl?: string;
}

export interface ActivityItem {
  id: string;
  action: 'uploaded' | 'deleted' | 'downloaded' | 'viewed';
  fileName: string;
  clientName?: string;
  timestamp: string;
}

export type SortOption = 'date-desc' | 'date-asc' | 'size-desc' | 'size-asc' | 'name-asc' | 'name-desc';
export type ViewMode = 'grid' | 'list';
