import React from 'react';
import { Link } from 'react-router-dom';

export interface SectionHeaderProps {
  title: string;
  description?: string;
  count?: number | string;
  badge?: React.ReactNode;
  viewAllLink?: string;
  viewAllText?: string;
  action?: React.ReactNode;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  description,
  count,
  badge,
  viewAllLink,
  viewAllText = 'Xem tất cả',
  action,
}) => {
  return (
    <div className="flex items-center justify-between gap-3 pb-2 border-b border-[#E8E8EC]">
      <div className="flex items-center gap-2">
        <h2 className="text-sm sm:text-base font-bold font-heading text-[#0A0A0A] tracking-tight">
          {title}
        </h2>
        {count !== undefined && (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#F4F4F6] text-[#6B6B6B] border border-[#E8E8EC]">
            {count}
          </span>
        )}
        {badge}
        {description && (
          <span className="hidden md:inline-block text-xs text-[#6B6B6B]">
            — {description}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {action}
        {viewAllLink && (
          <Link
            to={viewAllLink}
            className="text-xs font-semibold text-[#1D6FC2] hover:text-[#175A9E] hover:underline transition-colors"
          >
            {viewAllText} →
          </Link>
        )}
      </div>
    </div>
  );
};
