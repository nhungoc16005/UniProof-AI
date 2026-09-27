import React from 'react';
import { ShieldCheck, Check, AlertCircle, HelpCircle, ExternalLink } from 'lucide-react';
import { EvidenceGap } from '../../types';

interface VerificationBadgeProps {
  level: number; // 1 to 5
  isOfficer?: boolean;
}

export const VerificationBadge: React.FC<VerificationBadgeProps> = ({ level, isOfficer = false }) => {
  const levels = [
    { num: 1, label: 'L1 Chính thức (Cơ sở dữ liệu trường)' },
    { num: 2, label: 'L2 Xác nhận đơn vị tổ chức' },
    { num: 3, label: 'L3 Danh sách tham gia công khai' },
    { num: 4, label: 'L4 Nguồn báo chí / truyền thông' },
    { num: 5, label: 'L5 Chỉ có chứng nhận (Chưa đối chứng)' },
  ];

  if (!isOfficer) {
    // Sinh viên chỉ thấy định tính
    let text = 'Mức xác minh: Cao (L1/L2)';
    let colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-300';
    if (level === 3 || level === 4) {
      text = 'Mức xác minh: Trung bình (L3/L4)';
      colorClass = 'bg-teal-50 text-teal-700 border-teal-300';
    } else if (level === 5) {
      text = 'Mức xác minh: Cần thêm đối chứng (L5)';
      colorClass = 'bg-indigo-50 text-indigo-700 border-indigo-300';
    }

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border ${colorClass}`}>
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>{text}</span>
      </span>
    );
  }

  // Officer thấy thanh 5 nấc L1-L5
  return (
    <div className="flex flex-col gap-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-sky-600" />
          Thang xác minh ngoài trường:
        </span>
        <span className="text-sky-700 font-bold">Cấp L{level}</span>
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((idx) => {
          const isCurrent = idx === level;
          const isPassed = idx > level; // vì L1 là cao nhất
          return (
            <div
              key={idx}
              className={`flex-1 h-2 rounded-sm transition-all ${
                isCurrent
                  ? 'bg-sky-600 ring-2 ring-sky-300'
                  : isPassed
                  ? 'bg-sky-200'
                  : 'bg-slate-200 opacity-60'
              }`}
              title={levels[idx - 1]?.label}
            />
          );
        })}
      </div>
      <div className="text-[11px] text-slate-500">
        {levels[level - 1]?.label || `Cấp L${level}`}
      </div>
    </div>
  );
};

// 2 câu hỏi xác minh luôn tách rời theo Nguyên tắc 3
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
    <div className={`flex flex-col gap-2 p-3 bg-white border border-slate-200 rounded-lg shadow-sm ${className}`}>
      <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
        Kết quả xác minh độc lập
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {/* Câu hỏi 1 */}
        <div
          className={`flex items-center gap-2 p-2 rounded-md border text-xs font-medium ${
            activityExists
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}
        >
          {activityExists ? (
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          )}
          <span>1. Hoạt động có diễn ra: {activityExists ? 'ĐÃ XÁC NHẬN' : 'CHƯA ĐỦ CĂN CỨ'}</span>
        </div>

        {/* Câu hỏi 2 */}
        <div
          className={`flex items-center gap-2 p-2 rounded-md border text-xs font-medium ${
            studentParticipation
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}
        >
          {studentParticipation ? (
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          )}
          <span>2. Sinh viên có tham gia: {studentParticipation ? 'ĐÃ XÁC NHẬN' : 'CHƯA ĐỦ CĂN CỨ'}</span>
        </div>
      </div>
      {sourceDesc && (
        <div className="text-[11px] text-slate-500 italic mt-0.5">
          Nguồn đối chiếu: {sourceDesc}
        </div>
      )}
    </div>
  );
};

// Evidence Gap Box (Còn thiếu gì)
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
    <div className={`p-3.5 bg-amber-50/80 border border-amber-300 rounded-lg text-amber-900 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 font-semibold text-xs text-amber-900 uppercase">
          <HelpCircle className="w-4 h-4 text-amber-600" />
          <span>Còn thiếu gì? (Evidence Gap)</span>
        </div>
        {onSupplementClick && (
          <button
            onClick={onSupplementClick}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded shadow-sm transition"
          >
            <span>Bổ sung ngay</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>

      {gap.missingItems && gap.missingItems.length > 0 && (
        <ul className="list-disc list-inside text-xs space-y-1 text-amber-950 font-medium">
          {gap.missingItems.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}

      {gap.suggestions && gap.suggestions.length > 0 && (
        <div className="mt-2 pt-2 border-t border-amber-200 text-xs text-amber-800">
          <span className="font-semibold">Gợi ý từ hệ thống: </span>
          {gap.suggestions.join('. ')}
        </div>
      )}
    </div>
  );
};
