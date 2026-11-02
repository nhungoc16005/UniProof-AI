import React from 'react';
import { Calendar, AlertTriangle, Clock } from 'lucide-react';

export interface DeadlineCardProps {
  label: string;
  deadline?: string | null;
  statusText?: string;
  urgent?: boolean;
  expired?: boolean;
  note?: string;
}

export const DeadlineCard: React.FC<DeadlineCardProps> = ({
  label,
  deadline,
  statusText,
  urgent = false,
  expired = false,
  note,
}) => {
  const formatted = React.useMemo(() => {
    if (!deadline) return 'Chưa thiết lập';
    try {
      const d = new Date(deadline);
      if (isNaN(d.getTime())) return deadline;
      return d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return deadline;
    }
  }, [deadline]);

  return (
    <div
      className={`p-3.5 rounded-[12px] border transition-all shadow-sm ${
        expired
          ? 'border-l-4 border-l-[#EF4444] bg-gradient-to-r from-[#FEF2F2]/60 to-white border-[#FECACA]'
          : urgent
          ? 'border-l-4 border-l-[#D97706] bg-gradient-to-r from-[#FFFBEB]/70 to-white border-[#FDE68A]'
          : 'border-l-4 border-l-[#1D6FC2] bg-white border-[#E8E8EC]'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="font-semibold text-xs text-[#475569] flex items-center gap-1.5">
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-md ${
              expired
                ? 'bg-red-100 text-red-600'
                : urgent
                ? 'bg-amber-100 text-amber-600'
                : 'bg-blue-50 text-[#1D6FC2]'
            }`}
          >
            {expired ? (
              <AlertTriangle className="w-3.5 h-3.5" />
            ) : (
              <Calendar className="w-3.5 h-3.5" />
            )}
          </div>
          {label}
        </span>
        {statusText && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
              expired
                ? 'bg-red-50 text-red-700 border-red-200'
                : urgent
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : statusText === 'Còn trong hạn'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            {statusText}
          </span>
        )}
      </div>

      <div className="text-sm font-bold font-mono text-[#0A0A0A] pl-0.5">
        {formatted}
      </div>

      {note && (
        <p className="mt-1 text-[11px] text-[#64748B] leading-normal pl-0.5">{note}</p>
      )}
    </div>
  );
};
