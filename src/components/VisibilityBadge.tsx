import React from 'react';
import { Globe, Users, Lock } from 'lucide-react';
import { Visibility } from '../types';

export const VisibilityBadge: React.FC<{
  visibility: Visibility;
  onClick?: () => void;
  title?: string;
}> = ({ visibility, onClick, title }) => {
  const config =
    visibility === 'public'
      ? { label: 'Public', Icon: Globe }
      : visibility === 'friends'
      ? { label: 'Friends', Icon: Users }
      : visibility === 'followers'
      ? { label: 'Followers', Icon: Users }
      : { label: 'Private', Icon: Lock };

  const Icon = config.Icon;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title || `Visibility: ${config.label}. Click to cycle.`}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-chip text-[11px] font-medium border border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0]/90 dark:bg-[#171717]/90 text-[#171717] dark:text-[#e5e1da] hover:bg-[#eae7e0] dark:hover:bg-[#303030] transition-colors cursor-pointer"
      >
        <Icon className="w-3 h-3 shrink-0" />
        <span>{config.label}</span>
      </button>
    );
  }

  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-chip text-[11px] font-medium border border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0]/90 dark:bg-[#171717]/90 text-[#171717] dark:text-[#e5e1da]"
    >
      <Icon className="w-3 h-3 shrink-0" />
      <span>{config.label}</span>
    </span>
  );
};
