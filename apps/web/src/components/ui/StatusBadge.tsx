import React from 'react';
import { EvidenceStatus } from '../../types';
import { 
  FileEdit, 
  RotateCw, 
  ShieldCheck, 
  CheckCircle2, 
  Paperclip, 
  UserCheck, 
  AlertCircle, 
  Check, 
  X, 
  Scale, 
  Undo2,
  AlertTriangle
} from 'lucide-react';

interface StatusBadgeProps {
  status: EvidenceStatus | 'SUSPICIOUS';
  isOfficer?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, isOfficer = false, className = '' }) => {
  switch (status) {
    case 'DRAFT':
      return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100/90 text-slate-700 border border-slate-300 shadow-sm ${className}`}>
          <FileEdit className="w-3.5 h-3.5 text-slate-500" />
          <span>Bản nháp</span>
        </span>
      );

    case 'PROCESSING':
      return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-300 shadow-sm ${className}`}>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
          </span>
          <RotateCw className="w-3.5 h-3.5 text-sky-600 animate-spin" />
          <span>Đang xử lý</span>
        </span>
      );

    case 'VERIFIED':
      return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-sm ${className}`}>
          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Đã xác minh</span>
        </span>
      );

    case 'PLAUSIBLE':
      return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-300 shadow-sm ${className}`}>
          <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
          <span>Có thể chấp nhận</span>
        </span>
      );

    case 'NEEDS_SUPPLEMENT':
      return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-300 shadow-sm ${className}`}>
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <Paperclip className="w-3.5 h-3.5 text-amber-600" />
          <span>Cần bổ sung</span>
        </span>
      );

    case 'NEEDS_HUMAN_REVIEW':
      return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200 shadow-sm ${className}`}>
          <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
          <span>Cần cán bộ xem xét</span>
        </span>
      );

    case 'INVALID':
      return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-300 shadow-sm ${className}`}>
          <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
          <span>Mâu thuẫn dữ liệu</span>
        </span>
      );

    case 'APPROVED':
      return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-sm ${className}`}>
          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Đã duyệt</span>
        </span>
      );

    case 'REJECTED':
      return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-600 text-white shadow-sm ${className}`}>
          <X className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Bị từ chối</span>
        </span>
      );

    case 'APPEALING':
      return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-300 shadow-sm ${className}`}>
          <Scale className="w-3.5 h-3.5 text-purple-600" />
          <span>Đang khiếu nại</span>
        </span>
      );

    case 'WITHDRAWN':
      return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-600 border border-stone-200 ${className}`}>
          <Undo2 className="w-3.5 h-3.5 text-stone-500" />
          <span>Đã rút hồ sơ</span>
        </span>
      );

    case 'SUSPICIOUS':
      if (!isOfficer) return null;
      return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-900 border border-orange-300 shadow-sm ${className}`}>
          <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />
          <span>Đáng ngờ</span>
        </span>
      );

    default:
      return null;
  }
};
