import React, { useState } from 'react';

export interface DonutSegment {
  key: string;
  label: string;
  count: number;
  color: string; // hex color for SVG stroke
  tailwindColor?: string;
}

export interface SvgDonutChartProps {
  segments: DonutSegment[];
  total?: number;
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: React.ReactNode;
  centerSubtext?: string;
}

export const SvgDonutChart: React.FC<SvgDonutChartProps> = ({
  segments,
  total,
  size = 180,
  strokeWidth = 24,
  centerLabel,
  centerValue,
  centerSubtext,
}) => {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const computedTotal = total ?? segments.reduce((sum, s) => sum + s.count, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  const hoveredSegment = segments.find((s) => s.key === hoveredKey);

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      {/* SVG Donut */}
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#F4F4F6"
            strokeWidth={strokeWidth}
          />

          {/* Data segments */}
          {computedTotal > 0 &&
            segments.map((segment) => {
              const percent = segment.count / computedTotal;
              if (percent <= 0) return null;

              const strokeDasharray = `${percent * circumference} ${circumference}`;
              const strokeDashoffset = -(accumulatedPercent * circumference);
              accumulatedPercent += percent;

              const isHovered = hoveredKey === segment.key;

              return (
                <circle
                  key={segment.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-300 cursor-pointer"
                  onMouseEnter={() => setHoveredKey(segment.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                />
              );
            })}
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-2">
          {hoveredSegment ? (
            <>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#6B6B6B] line-clamp-1">
                {hoveredSegment.label}
              </span>
              <span className="text-xl font-heading font-bold text-[#0A0A0A]">
                {hoveredSegment.count}
              </span>
              <span className="text-[10px] font-semibold text-[#1D6FC2]">
                {computedTotal > 0
                  ? Math.round((hoveredSegment.count / computedTotal) * 100)
                  : 0}
                %
              </span>
            </>
          ) : (
            <>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#6B6B6B]">
                {centerLabel || 'Tổng số'}
              </span>
              <span className="text-xl font-heading font-bold text-[#0A0A0A]">
                {centerValue ?? computedTotal}
              </span>
              {centerSubtext && (
                <span className="text-[10px] text-[#8A8A8E]">{centerSubtext}</span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Legend Grid */}
      <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-2 text-xs w-full">
        {segments.map((segment) => {
          const pct =
            computedTotal > 0 ? Math.round((segment.count / computedTotal) * 100) : 0;
          const isHovered = hoveredKey === segment.key;

          return (
            <div
              key={segment.key}
              className={`flex items-center justify-between p-1.5 rounded-[6px] transition-colors cursor-pointer ${
                isHovered ? 'bg-[#F0F6FC]' : 'hover:bg-[#FAFAFA]'
              }`}
              onMouseEnter={() => setHoveredKey(segment.key)}
              onMouseLeave={() => setHoveredKey(null)}
            >
              <div className="flex items-center gap-2 truncate">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="text-[#0A0A0A] font-medium truncate">
                  {segment.label}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 pl-2">
                <span className="font-heading font-bold text-[#0A0A0A]">
                  {segment.count}
                </span>
                <span className="text-[10px] text-[#6B6B6B]">({pct}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
