import React from 'react';

interface ScoreDisplayProps {
  score?: number | null;
  maxScore?: number;
  isOfficial?: boolean;
  proposedScore?: number | null;
  approvedBy?: string;
  approvedDate?: string;
  onExplainClick?: () => void;
  className?: string;
}

export const ScoreDisplay: React.FC<ScoreDisplayProps> = ({
  score,
  maxScore,
  isOfficial = false,
  proposedScore,
  approvedBy,
  approvedDate,
  onExplainClick,
  className = '',
}) => {
  return (
    <div className={`space-y-3 ${className}`}>
      {/* Official Score Display */}
      {isOfficial && score !== undefined && score !== null ? (
        <div className="p-4 bg-white border border-emerald-300 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                Điểm chính thức
              </span>
              <span className="text-xs text-slate-500">
                {approvedBy ? `Duyệt bởi ${approvedBy}` : ''} {approvedDate ? `(${approvedDate})` : ''}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {score.toLocaleString('vi-VN')}
              </span>
              <span className="text-xs text-slate-500 font-medium">điểm</span>
              {maxScore && (
                <span className="text-xs text-slate-400">/ tối đa {maxScore}</span>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Proposed AI Score Display */}
      {!isOfficial && proposedScore !== undefined && proposedScore !== null ? (
        <div className="p-4 bg-sky-50/60 border border-sky-200 rounded-xl flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-sky-100 text-sky-800">
                Đề xuất AI & Rule Engine
              </span>
              <span className="text-[11px] text-sky-700">Chưa phải điểm chính thức</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-sky-950 tracking-tight">
                {proposedScore.toLocaleString('vi-VN')}
              </span>
              <span className="text-xs text-sky-700 font-medium">điểm</span>
              {maxScore && (
                <span className="text-xs text-sky-600">/ tối đa {maxScore}</span>
              )}
            </div>
          </div>

          {onExplainClick && (
            <button
              type="button"
              onClick={onExplainClick}
              className="px-3 py-1.5 text-xs font-semibold text-sky-700 bg-white hover:bg-sky-50 border border-sky-200 rounded-lg shadow-sm transition"
            >
              Xem giải trình quy chế
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
};
