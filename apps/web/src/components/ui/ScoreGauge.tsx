import React from 'react';

interface ScoreGaugeProps {
  score: number;
  classification: string;
  maxScore?: number;
  isOfficial?: boolean;
  hasScore?: boolean;
  className?: string;
}

export const ScoreGauge: React.FC<ScoreGaugeProps> = ({
  score,
  classification,
  maxScore = 100,
  isOfficial = true,
  hasScore = true,
  className = '',
}) => {
  const percentage = Math.min(Math.round((score / maxScore) * 100), 100);
  const strokeWidth = 10;
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const badgeColor = 'bg-slate-100 text-slate-700 border-slate-300';

  return (
    <div className={`flex flex-col items-center bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm relative overflow-hidden card-hover-lift ${className}`}>
      
      {/* Subtle Background Glow */}
      <div className="absolute -top-12 -right-12 w-40 h-40 bg-blue-100/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-sky-100/40 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-center justify-between w-full pb-3 border-b border-slate-100 mb-4">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          {isOfficial ? 'Điểm rèn luyện chính thức' : hasScore ? 'Điểm đã được xác nhận một phần' : 'Chưa có điểm được xác nhận'}
        </span>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${badgeColor}`}>
          {classification}
        </span>
      </div>

      {/* Circular Progress Gauge */}
      <div className="relative w-44 h-44 flex items-center justify-center my-1">
        <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 160 160">
          <defs>
            <linearGradient id="grad-score" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#64748b" />
              <stop offset="100%" stopColor="#2563eb" />
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
            stroke="url(#grad-score)"
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
              {hasScore ? score.toLocaleString('vi-VN') : '—'}
            </span>
            <span className="text-xs font-bold text-slate-400 ml-0.5">/100</span>
          </div>
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
            {isOfficial ? 'Điểm chính thức' : hasScore ? 'Tổng tạm tính' : 'Chưa có dữ liệu'}
          </span>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 w-full text-center">
        <p className="text-xs font-semibold text-slate-700">Điểm và xếp loại được lấy từ Backend.</p>
      </div>

    </div>
  );
};
