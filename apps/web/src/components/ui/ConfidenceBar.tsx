import React from 'react';

interface ConfidenceBarProps {
  score?: number | null; // 0.00 to 1.00
  isOfficer?: boolean;
  className?: string;
}

export const ConfidenceBar: React.FC<ConfidenceBarProps> = ({ score, isOfficer = false, className = '' }) => {
  if (score === undefined || score === null) return null;

  const percentage = Math.round(score * 100);

  // Officer view: Show actual score + visual bar
  if (isOfficer) {
    let color = 'bg-emerald-500';
    let textColor = 'text-emerald-700';
    let label = 'Cao';

    if (score < 0.60) {
      color = 'bg-rose-500';
      textColor = 'text-rose-700';
      label = 'Thấp';
    } else if (score < 0.85) {
      color = 'bg-amber-500';
      textColor = 'text-amber-700';
      label = 'Trung bình';
    }

    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="w-16 bg-slate-200 h-2 rounded-full overflow-hidden">
          <div className={`h-full ${color}`} style={{ width: `${percentage}%` }} />
        </div>
        <span className={`text-xs font-semibold ${textColor}`}>
          {score.toFixed(2)} ({label})
        </span>
      </div>
    );
  }

  // Student view: Qualitative only (Cao / Trung bình / Thấp)
  let studentLabel = 'Độ tin cậy: Cao';
  let badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';

  if (score < 0.60) {
    studentLabel = 'Độ tin cậy: Thấp';
    badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (score < 0.85) {
    studentLabel = 'Độ tin cậy: Trung bình';
    badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${badgeColor} ${className}`}>
      {studentLabel}
    </span>
  );
};
