import React from 'react';

export interface ProgressSegment {
  label: string;
  count: number;
  color: string; // Tailwind color class or hex
}

export interface ProgressCardProps {
  title: string;
  current: number;
  total: number;
  unit?: string;
  subtitle?: string;
  segments?: ProgressSegment[];
  showPercentage?: boolean;
}

export const ProgressCard: React.FC<ProgressCardProps> = ({
  title,
  current,
  total,
  unit = '',
  subtitle,
  segments,
  showPercentage = true,
}) => {
  const percentage = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

  return (
    <div className="p-4 rounded-[12px] border border-[#E8E8EC] bg-[#FFFFFF] space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold font-heading text-[#0A0A0A]">{title}</h3>
          {subtitle && <p className="text-xs text-[#6B6B6B] mt-0.5">{subtitle}</p>}
        </div>
        <div className="text-right shrink-0">
          <span className="text-base font-bold font-heading text-[#0A0A0A]">
            {current}
            <span className="text-xs font-normal text-[#6B6B6B]">/{total} {unit}</span>
          </span>
          {showPercentage && (
            <span className="ml-2 text-xs font-semibold text-[#1D6FC2]">
              {percentage}%
            </span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2.5 rounded-full bg-[#F4F4F6] overflow-hidden flex">
        {segments && segments.length > 0 ? (
          segments.map((seg, idx) => {
            const segPct = total > 0 ? (seg.count / total) * 100 : 0;
            if (segPct <= 0) return null;
            return (
              <div
                key={idx}
                style={{ width: `${segPct}%` }}
                className={`h-full ${seg.color}`}
                title={`${seg.label}: ${seg.count} (${Math.round(segPct)}%)`}
              />
            );
          })
        ) : (
          <div
            style={{ width: `${percentage}%` }}
            className="h-full bg-[#1D6FC2] rounded-full transition-all duration-300"
          />
        )}
      </div>

      {/* Segment Legend if provided */}
      {segments && segments.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-xs">
          {segments.map((seg, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${seg.color}`} />
              <span className="text-[#6B6B6B]">{seg.label}:</span>
              <strong className="text-[#0A0A0A] font-semibold">{seg.count}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
