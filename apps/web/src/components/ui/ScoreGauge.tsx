import React from 'react';

interface ScoreGaugeProps {
  score: number;
  maxScore?: number;
  pendingScore?: number;
  targetRank?: string;
  targetScore?: number;
  className?: string;
}

export const ScoreGauge: React.FC<ScoreGaugeProps> = ({
  score,
  maxScore = 100,
  pendingScore = 0,
  targetRank = 'Xuất sắc',
  targetScore = 90,
  className = '',
}) => {
  const percentage = Math.min(Math.round((score / maxScore) * 100), 100);
  const strokeWidth = 10;
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  let classification = 'Trung bình';
  let badgeColor = 'bg-slate-100 text-slate-700 border-slate-300';
  let gradientId = 'grad-average';

  if (score >= 90) {
    classification = 'Xuất sắc';
    badgeColor = 'bg-blue-50 text-blue-800 border-blue-300 ring-2 ring-blue-100';
    gradientId = 'grad-excellent';
  } else if (score >= 80) {
    classification = 'Loại Tốt';
    badgeColor = 'bg-blue-50 text-blue-700 border-blue-200 ring-2 ring-blue-50';
    gradientId = 'grad-good';
  } else if (score >= 65) {
    classification = 'Loại Khá';
    badgeColor = 'bg-sky-50 text-sky-800 border-sky-300';
    gradientId = 'grad-fair';
  }

  // Điểm cần để lên bậc tiếp theo
  let nextRankMessage = '';
  if (score < 80) {
    const diff = (80 - score).toFixed(1);
    nextRankMessage = `Cần thêm ${diff} điểm nữa để đạt xếp loại Tốt (≥80đ)`;
  } else if (score < 90) {
    const diff = (90 - score).toFixed(1);
    nextRankMessage = `Chỉ còn thiếu ${diff} điểm nữa để đạt danh hiệu Xuất sắc (≥90đ)`;
  } else {
    nextRankMessage = `Xin chúc mừng! Bạn đang đạt thứ hạng Xuất sắc cao nhất`;
  }

  return (
    <div className={`flex flex-col items-center bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm relative overflow-hidden card-hover-lift ${className}`}>
      
      {/* Subtle Background Glow */}
      <div className="absolute -top-12 -right-12 w-40 h-40 bg-blue-100/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-sky-100/40 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-center justify-between w-full pb-3 border-b border-slate-100 mb-4">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Điểm rèn luyện chính thức
        </span>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${badgeColor}`}>
          {classification}
        </span>
      </div>

      {/* Circular Progress Gauge */}
      <div className="relative w-44 h-44 flex items-center justify-center my-1">
        <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 160 160">
          <defs>
            <linearGradient id="grad-good" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>
            <linearGradient id="grad-excellent" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1d4ed8" />
              <stop offset="100%" stopColor="#2563eb" />
            </linearGradient>
            <linearGradient id="grad-fair" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>
            <linearGradient id="grad-average" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#64748b" />
              <stop offset="100%" stopColor="#94a3b8" />
            </linearGradient>
          </defs>

          {/* Background Track Circle */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
            fill="transparent"
          />

          {/* Animated Foreground Progress Circle */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Center Text */}
        <div className="absolute flex flex-col items-center justify-center text-center">
          <div className="flex items-baseline justify-center">
            <span className="text-4xl font-black text-slate-900 tracking-tight">
              {score.toLocaleString('vi-VN')}
            </span>
            <span className="text-xs font-bold text-slate-400 ml-0.5">/100</span>
          </div>
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
            Điểm tích lũy
          </span>
        </div>
      </div>

      {/* Pending Score Badge */}
      {pendingScore > 0 && (
        <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200 shadow-sm animate-pulse">
          <span>+{pendingScore} điểm AI đang đề xuất (Chờ duyệt)</span>
        </div>
      )}

      {/* Motivational Goal Helper */}
      <div className="mt-4 pt-3 border-t border-slate-100 w-full text-center">
        <p className="text-xs font-semibold text-slate-700">
          {nextRankMessage}
        </p>
      </div>

    </div>
  );
};
