import React from 'react';
import { Sparkles, Check, HelpCircle } from 'lucide-react';

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
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* Official Score Display */}
      {isOfficial && score !== undefined && score !== null ? (
        <div className="flex items-center gap-3 p-3 bg-white border-2 border-emerald-500 rounded-lg shadow-sm">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-100 text-emerald-700">
            <Check className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-slate-900">{score.toLocaleString('vi-VN')}</span>
              {maxScore && <span className="text-xs text-slate-500">/ tối đa {maxScore} điểm</span>}
            </div>
            <div className="text-xs text-emerald-700 font-medium">
              Điểm chính thức {approvedBy ? `· Duyệt bởi ${approvedBy}` : ''} {approvedDate ? `(${approvedDate})` : ''}
            </div>
          </div>
        </div>
      ) : null}

      {/* Proposed AI Score Display (Dotted line + sparkle icon) */}
      {!isOfficial && proposedScore !== undefined && proposedScore !== null ? (
        <div className="flex items-center justify-between p-3 border-2 border-dashed border-sky-400 bg-sky-50/70 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-sky-100 text-sky-600">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-sky-900">{proposedScore.toLocaleString('vi-VN')}</span>
                {maxScore && <span className="text-xs text-sky-700">/ tối đa {maxScore} điểm</span>}
              </div>
              <div className="text-xs text-sky-700 font-medium">
                ✦ Điểm AI đề xuất — Chưa phải điểm chính thức
              </div>
            </div>
          </div>
          {onExplainClick && (
            <button
              onClick={onExplainClick}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-sky-700 hover:text-sky-900 hover:bg-sky-100 rounded-md transition"
              title="Xem giải thích và trích dẫn điều khoản"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Vì sao?</span>
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
};
