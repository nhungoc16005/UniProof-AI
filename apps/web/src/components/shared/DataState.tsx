import React from 'react';
import { SearchX, Inbox, AlertCircle, RefreshCw } from 'lucide-react';
import { TableSkeleton } from '../ui/Skeleton';

export interface DataStateProps {
  loading?: boolean;
  loadingMessage?: string;
  error?: string | null;
  onRetry?: () => void;
  isEmpty?: boolean;
  isFilteredEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: React.ReactNode;
  emptyAction?: React.ReactNode;
  onClearFilters?: () => void;
  skeletonRows?: number;
  skeletonCols?: number;
  children?: React.ReactNode;
}

export const DataState: React.FC<DataStateProps> = ({
  loading = false,
  loadingMessage = 'Đang tải dữ liệu…',
  error,
  onRetry,
  isEmpty = false,
  isFilteredEmpty = false,
  emptyTitle,
  emptyDescription,
  emptyAction,
  onClearFilters,
  skeletonRows = 5,
  skeletonCols = 5,
  children,
}) => {
  if (loading) {
    return (
      <div
        role="status"
        aria-label={loadingMessage}
        className="rounded-[12px] border border-[#E8E8EC] bg-[#FFFFFF] p-4"
      >
        <p className="text-xs sm:text-sm text-[#6B6B6B] mb-3">{loadingMessage}</p>
        <TableSkeleton rows={skeletonRows} cols={skeletonCols} />
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center p-8 rounded-[12px] border border-[#FECACA] bg-[#FEF2F2] text-center"
      >
        <AlertCircle className="w-8 h-8 text-[#DC2626] mb-2" />
        <h3 className="text-sm font-bold font-heading text-[#991B1B]">
          Đã xảy ra lỗi tải dữ liệu
        </h3>
        <p className="mt-1 max-w-md text-xs text-[#B91C1C] leading-relaxed">
          {error}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#991B1B] bg-[#FFFFFF] hover:bg-[#FEE2E2] border border-[#FCA5A5] rounded-[6px] transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Thử lại
          </button>
        )}
      </div>
    );
  }

  if (isFilteredEmpty) {
    return (
      <div
        role="status"
        className="flex flex-col items-center justify-center rounded-[12px] border border-[#E8E8EC] bg-[#FFFFFF] p-8 text-center"
      >
        <SearchX aria-hidden="true" className="w-10 h-10 text-[#9C9C9C] mb-3" />
        <h3 className="text-sm font-bold font-heading text-[#0A0A0A]">
          {emptyTitle || 'Không tìm thấy kết quả phù hợp'}
        </h3>
        <p className="mt-1.5 max-w-md text-xs text-[#6B6B6B] leading-relaxed">
          {emptyDescription || 'Hãy thử từ khóa khác hoặc xóa bộ lọc để xem lại toàn bộ dữ liệu.'}
        </p>
        {onClearFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#1D6FC2] bg-[#E1EDF9] hover:bg-[#C2DBF2] border border-[#C2DBF2] rounded-[6px] transition-colors"
          >
            Xóa bộ lọc
          </button>
        )}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div
        role="status"
        className="flex flex-col items-center justify-center rounded-[12px] border border-[#E8E8EC] bg-[#FFFFFF] p-8 text-center"
      >
        <Inbox aria-hidden="true" className="w-10 h-10 text-[#9C9C9C] mb-3" />
        <h3 className="text-sm font-bold font-heading text-[#0A0A0A]">
          {emptyTitle || 'Chưa có dữ liệu'}
        </h3>
        <p className="mt-1.5 max-w-md text-xs text-[#6B6B6B] leading-relaxed">
          {emptyDescription || 'Hiện tại chưa có bản ghi nào trong danh sách.'}
        </p>
        {emptyAction && <div className="mt-4">{emptyAction}</div>}
      </div>
    );
  }

  return <>{children}</>;
};
