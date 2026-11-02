import React from 'react';
import { Search, X } from 'lucide-react';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterSelect {
  key: string;
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
}

export interface FilterBarProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
  selects?: FilterSelect[];
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Tìm kiếm...',
  searchAriaLabel = 'Tìm kiếm',
  selects = [],
  hasActiveFilters = false,
  onClearFilters,
  actions,
  children,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-2.5 p-3 rounded-[12px] border border-[#E8E8EC] bg-[#FFFFFF]">
      {onSearchChange && (
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-[#6B6B6B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            aria-label={searchAriaLabel}
            placeholder={searchPlaceholder}
            value={searchQuery || ''}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-[#FFFFFF] border border-[#E8E8EC] rounded-[6px] text-[#0A0A0A] placeholder-[#9C9C9C] focus:outline-none focus:border-[#1D6FC2] focus:ring-2 focus:ring-[#1D6FC2]/15 transition-all"
          />
        </div>
      )}

      {selects.map((sel) => (
        <select
          key={sel.key}
          aria-label={sel.ariaLabel || sel.label}
          value={sel.value}
          onChange={(e) => sel.onChange(e.target.value)}
          className="py-2 px-3 text-xs sm:text-sm bg-[#FFFFFF] border border-[#E8E8EC] rounded-[6px] text-[#0A0A0A] focus:outline-none focus:border-[#1D6FC2] focus:ring-2 focus:ring-[#1D6FC2]/15 transition-all cursor-pointer"
        >
          <option value="">{sel.label}</option>
          {sel.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ))}

      {children}

      {hasActiveFilters && onClearFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="inline-flex items-center gap-1.5 py-2 px-3 text-xs font-semibold text-[#1D6FC2] hover:text-[#175A9E] bg-[#E1EDF9] hover:bg-[#C2DBF2] border border-[#C2DBF2] rounded-[6px] transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Xóa bộ lọc
        </button>
      )}

      {actions && (
        <div className="flex items-center gap-2 ml-auto shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
};
