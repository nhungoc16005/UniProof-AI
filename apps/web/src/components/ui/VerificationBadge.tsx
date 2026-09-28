import React from 'react';
import { EvidenceGap } from '../../types';

interface VerificationBadgeProps {
  level: number; // 1 to 5
  isOfficer?: boolean;
}

export const VerificationBadge: React.FC<VerificationBadgeProps> = ({ level, isOfficer = false }) => {
  const levels = [
    { num: 1, label: 'L1: Cơ sở dữ liệu trường' },
    { num: 2, label: 'L2: Xác nhận đơn vị tổ chức' },
    { num: 3, label: 'L3: Danh sách công bố công khai' },
    { num: 4, label: 'L4: Nguồn báo chí / truyền thông' },
    { num: 5, label: 'L5: Chỉ có ảnh (Chưa đối chứng)' },
  ];

  if (!isOfficer) {
    let text = 'Mức xác minh: Cao (L1/L2)';
    let colorClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    if (level === 3 || level === 4) {
      text = 'Mức xác minh: Trung bình (L3/L4)';
      colorClass = 'bg-teal-50 text-teal-800 border-teal-200';
    } else if (level === 5) {
      text = 'Mức xác minh: Cần thêm đối chứng (L5)';
      colorClass = 'bg-slate-100 text-slate-700 border-slate-200';
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
        <span>{text}</span>
      </span>
    );
  }

  // Officer sees 5-level scale
  return (
    <div className="flex flex-col gap-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
        <span className="uppercase text-[11px] tracking-wider text-slate-500">Thang xác minh ngoài trường:</span>
        <span className="text-slate-900 font-bold">Cấp L{level}</span>
      </div>
      <div className="flex gap-1.5 py-0.5">
        {[1, 2, 3, 4, 5].map((idx) => {
          const isCurrent = idx === level;
          const isPassed = idx > level; // because L1 is highest
          return (
            <div
              key={idx}
              className={`flex-1 h-2 rounded transition-all ${
                isCurrent
                  ? 'bg-sky-600 ring-2 ring-sky-200'
                  : isPassed
                  ? 'bg-sky-200'
                  : 'bg-slate-200'
              }`}
              title={levels[idx - 1]?.label}
            />
          );
        })}
      </div>
      <div className="text-[11px] text-slate-500 font-medium">
        {levels[level - 1]?.label || `Cấp L${level}`}
      </div>
    </div>
  );
};

// 2 independent verification questions
interface TwoQuestionsProps {
  activityExists: boolean;
  studentParticipation: boolean;
  sourceDesc?: string;
  className?: string;
}

export const TwoQuestionsVerification: React.FC<TwoQuestionsProps> = ({
  activityExists,
  studentParticipation,
  sourceDesc,
  className = '',
}) => {
  return (
    <div className={`p-4 bg-white border border-slate-200 rounded-xl shadow-sm space-y-2.5 ${className}`}>
      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
        Đối chiếu 2 câu hỏi xác minh độc lập
      </span>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div
          className={`p-2.5 rounded-lg border font-medium ${
            activityExists
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-amber-50 text-amber-900 border-amber-200'
          }`}
        >
          <div className="text-[10px] text-slate-500 uppercase">1. Hoạt động có diễn ra:</div>
          <div className="font-bold text-sm mt-0.5">{activityExists ? 'ĐÃ XÁC NHẬN' : 'CHƯA ĐỦ CĂN CỨ'}</div>
        </div>

        <div
          className={`p-2.5 rounded-lg border font-medium ${
            studentParticipation
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-amber-50 text-amber-900 border-amber-200'
          }`}
        >
          <div className="text-[10px] text-slate-500 uppercase">2. Sinh viên có tham gia:</div>
          <div className="font-bold text-sm mt-0.5">{studentParticipation ? 'ĐÃ XÁC NHẬN' : 'CHƯA ĐỦ CĂN CỨ'}</div>
        </div>
      </div>
      {sourceDesc && (
        <div className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-100">
          Nguồn đối chiếu: {sourceDesc}
        </div>
      )}
    </div>
  );
};

// Evidence Gap Box
interface EvidenceGapProps {
  gap?: EvidenceGap;
  onSupplementClick?: () => void;
  className?: string;
}

export const EvidenceGapBox: React.FC<EvidenceGapProps> = ({
  gap,
  onSupplementClick,
  className = '',
}) => {
  if (!gap || (!gap.missingItems?.length && !gap.suggestions?.length)) {
    return null;
  }

  return (
    <div className={`p-4 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-950 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-xs uppercase tracking-wider text-amber-900">
          Còn thiếu gì để đạt xác minh cao hơn?
        </span>
        {onSupplementClick && (
          <button
            onClick={onSupplementClick}
            className="px-3 py-1 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-sm transition"
          >
            Bổ sung ngay
          </button>
        )}
      </div>

      {gap.missingItems && gap.missingItems.length > 0 && (
        <ul className="list-disc list-inside text-xs space-y-1 font-medium text-amber-900">
          {gap.missingItems.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}

      {gap.suggestions && gap.suggestions.length > 0 && (
        <div className="mt-2.5 pt-2 border-t border-amber-200/80 text-[11px] text-amber-800">
          <span className="font-semibold">Khuyến nghị: </span>
          {gap.suggestions.join('. ')}
        </div>
      )}
    </div>
  );
};
