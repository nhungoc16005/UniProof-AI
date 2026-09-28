import React from 'react';
import { EvidenceStatus } from '../../types';

interface StatusBadgeProps {
  status: EvidenceStatus | 'SUSPICIOUS';
  isOfficer?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, isOfficer = false, className = '' }) => {
  const getBadgeConfig = () => {
    switch (status) {
      case 'DRAFT':
        return {
          label: 'Bản nháp',
          classes: 'bg-slate-100 text-slate-700 border-slate-200',
          dot: 'bg-slate-400',
        };
      case 'PROCESSING':
        return {
          label: 'Đang xử lý',
          classes: 'bg-sky-50 text-sky-800 border-sky-200',
          dot: 'bg-sky-500 animate-pulse',
        };
      case 'VERIFIED':
        return {
          label: 'Đã xác minh',
          classes: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          dot: 'bg-emerald-500',
        };
      case 'PLAUSIBLE':
        return {
          label: 'Có thể chấp nhận',
          classes: 'bg-teal-50 text-teal-800 border-teal-200',
          dot: 'bg-teal-500',
        };
      case 'NEEDS_SUPPLEMENT':
        return {
          label: 'Cần bổ sung',
          classes: 'bg-amber-50 text-amber-900 border-amber-200',
          dot: 'bg-amber-500',
        };
      case 'NEEDS_HUMAN_REVIEW':
        return {
          label: 'Cần xem xét',
          classes: 'bg-indigo-50 text-indigo-900 border-indigo-200',
          dot: 'bg-indigo-500',
        };
      case 'INVALID':
        return {
          label: 'Mâu thuẫn dữ liệu',
          classes: 'bg-rose-50 text-rose-800 border-rose-200',
          dot: 'bg-rose-500',
        };
      case 'APPROVED':
        return {
          label: 'Đã duyệt',
          classes: 'bg-emerald-600 text-white border-transparent font-medium',
          dot: 'bg-white',
        };
      case 'REJECTED':
        return {
          label: 'Bị từ chối',
          classes: 'bg-rose-600 text-white border-transparent font-medium',
          dot: 'bg-white',
        };
      case 'APPEALING':
        return {
          label: 'Đang khiếu nại',
          classes: 'bg-purple-50 text-purple-900 border-purple-200',
          dot: 'bg-purple-500',
        };
      case 'WITHDRAWN':
        return {
          label: 'Đã rút',
          classes: 'bg-stone-100 text-stone-600 border-stone-200',
          dot: 'bg-stone-400',
        };
      case 'SUSPICIOUS':
        if (!isOfficer) return null;
        return {
          label: 'Đáng ngờ',
          classes: 'bg-orange-50 text-orange-900 border-orange-200 font-semibold',
          dot: 'bg-orange-500',
        };
      default:
        return {
          label: String(status),
          classes: 'bg-slate-100 text-slate-700 border-slate-200',
          dot: 'bg-slate-400',
        };
    }
  };

  const config = getBadgeConfig();
  if (!config) return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap shrink-0 ${config.classes} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
      <span className="whitespace-nowrap">{config.label}</span>
    </span>
  );
};
