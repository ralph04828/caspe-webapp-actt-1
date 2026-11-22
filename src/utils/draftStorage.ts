import { NavSection } from '../types';

export type ActiveModalType = 'none' | 'wardrobe_add' | 'myday' | 'create_post';

export interface SessionNavState {
  activeSection: NavSection;
  activeModal: ActiveModalType;
  viewingUserId?: string | null;
}

const NAV_PREFIX = 'swooosh_nav_state_v1_';
const DRAFT_PREFIX = 'swooosh_draft_v1_';

export function saveSessionJson<T>(key: string, value: T): void {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('Could not persist draft to sessionStorage (possibly quota exceeded):', err);
  }
}

export function loadSessionJson<T>(key: string): T | null {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function removeSessionKey(key: string): void {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function getNavSessionKey(uid: string): string {
  return `${NAV_PREFIX}${uid}`;
}

export function getDraftSessionKey(flow: string, uid: string): string {
  return `${DRAFT_PREFIX}${flow}_${uid}`;
}

export function saveSessionNavState(uid: string, state: SessionNavState): void {
  if (!uid) return;
  saveSessionJson(getNavSessionKey(uid), state);
}

export function loadSessionNavState(uid: string): SessionNavState | null {
  if (!uid) return null;
  return loadSessionJson<SessionNavState>(getNavSessionKey(uid));
}
