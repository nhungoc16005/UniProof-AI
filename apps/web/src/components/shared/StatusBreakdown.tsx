import React, { useState } from 'react';

export interface BreakdownItem {
  key: string;
  label: string;
  count: number;
  color: string; // Tailwind class or hex
  colorHex?: string;
  textColor?: string;
}

export interface StatusBreakdownProps {
  title?: string;
  items: BreakdownItem[];
  total?: number;
  compact?: boolean;
  showDonut?: boolean;
}

// Helper to extract hex color from tailwind arbitrary class like bg-[#1D6FC2] or fallback
function resolveHex(color: string, colorHex?: string): string {
  if (colorHex) return colorHex;
  if (color.startsWith('#')) return color;
  const match = color.match(/bg-\[(#[A-Fa-f0-9]+)\]/);
  if (match) return match[1];
  const tailwindMap: Record<string, string> = {
    'bg-blue-600': '#2563EB',
    'bg-blue-500': '#3B82F6',
    'bg-emerald-500': '#10B981',
    'bg-emerald-600': '#059669',
    'bg-amber-500': '#F59E0B',
    'bg-amber-600': '#D97706',
    'bg-red-500': '#EF4444',
    'bg-red-600': '#DC2626',
    'bg-slate-400': '#94A3B8',
    'bg-slate-500': '#64748B',
  };
  return tailwindMap[color] || '#1D6FC2';
}

export const StatusBreakdown: React.FC<StatusBreakdownProps> = ({
  title,
  items,
  total,
  compact = false,
  showDonut = true,
}) => {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const computedTotal = total ?? items.reduce((acc, curr) => acc + curr.count, 0);

  // Donut SVG parameters
  const size = 160;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;
  const hoveredItem = items.find((i) => i.key === hoveredKey);

  return (
    <div className={`p-5 rounded-[12px] border border-[#E8E8EC] bg-[#FFFFFF] ${compact ? 'space-y-3' : 'space-y-4'}`}>
      {title && (
        <div className="flex items-center justify-between pb-1 border-b border-[#E8E8EC]">
          <h3 className="text-sm font-bold font-heading text-[#0A0A0A]">{title}</h3>
          <span className="text-xs text-[#6B6B6B]">
            Tổng số: <strong className="text-[#0A0A0A] font-heading">{computedTotal.toLocaleString('vi-VN')}</strong> sinh viên
          </span>
        </div>
      )}

      {showDonut && !compact ? (
        <div className="flex flex-col sm:flex-row items-center gap-6 py-2">
          {/* Visual SVG Donut Chart */}
          <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              className="transform -rotate-90"
              role="img"
              aria-label={items.map((i) => `${i.label}: ${i.count}`).join(', ')}
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

              {/* Slices */}
              {computedTotal > 0 &&
                items.map((item) => {
                  const percent = item.count / computedTotal;
                  if (percent <= 0) return null;

                  const strokeDasharray = `${percent * circumference} ${circumference}`;
                  const strokeDashoffset = -(accumulatedPercent * circumference);
                  accumulatedPercent += percent;

                  const hex = resolveHex(item.color, item.colorHex);
                  const isHovered = hoveredKey === item.key;

                  return (
                    <circle
                      key={item.key}
                      cx={size / 2}
                      cy={size / 2}
                      r={radius}
                      fill="none"
                      stroke={hex}
                      strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                      strokeDasharray={strokeDasharray}
                      strokeDashoffset={strokeDashoffset}
                      className="transition-all duration-300 cursor-pointer"
                      onMouseEnter={() => setHoveredKey(item.key)}
                      onMouseLeave={() => setHoveredKey(null)}
                    />
                  );
                })}
            </svg>

            {/* Donut Center Display */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-2">
              {hoveredItem ? (
                <>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#6B6B6B] truncate max-w-[100px]">
                    {hoveredItem.label}
                  </span>
                  <span className="text-xl font-heading font-bold text-[#0A0A0A]">
                    {hoveredItem.count.toLocaleString('vi-VN')}
                  </span>
                  <span className="text-[10px] font-semibold text-[#1D6FC2]">
                    {computedTotal > 0 ? Math.round((hoveredItem.count / computedTotal) * 100) : 0}%
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#6B6B6B]">
                    Tổng số
                  </span>
                  <span className="text-xl font-heading font-bold text-[#0A0A0A]">
                    {computedTotal.toLocaleString('vi-VN')}
                  </span>
                  <span className="text-[10px] text-[#8A8A8E]">sinh viên</span>
                </>
              )}
            </div>
          </div>

          {/* Interactive Legend Grid */}
          <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-2 text-xs w-full">
            {items.map((item) => {
              const pct = computedTotal > 0 ? Math.round((item.count / computedTotal) * 100) : 0;
              const isHovered = hoveredKey === item.key;
              const hex = resolveHex(item.color, item.colorHex);

              return (
                <div
                  key={item.key}
                  className={`flex items-center justify-between p-2 rounded-[6px] transition-colors cursor-pointer border ${
                    isHovered ? 'bg-[#F0F6FC] border-[#C2DBF2]' : 'bg-[#FAFAFA] border-transparent hover:border-[#E8E8EC]'
                  }`}
                  onMouseEnter={() => setHoveredKey(item.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: hex }}
                    />
                    <span className="text-[#0A0A0A] font-medium truncate">
                      {item.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 pl-2">
                    <span className="font-heading font-bold text-[#0A0A0A]">
                      {item.count.toLocaleString('vi-VN')}
                    </span>
                    <span className="text-[10px] text-[#6B6B6B]">({pct}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Horizontal Stack Bar (Always rendered for quick overview) */}
      <div className="space-y-1.5 pt-1">
        <div className="w-full h-2.5 rounded-full bg-[#F4F4F6] overflow-hidden flex">
          {items.map((item) => {
            const pct = computedTotal > 0 ? (item.count / computedTotal) * 100 : 0;
            if (pct <= 0) return null;
            const hex = resolveHex(item.color, item.colorHex);
            const isHovered = hoveredKey === item.key;

            return (
              <div
                key={item.key}
                style={{
                  width: `${pct}%`,
                  backgroundColor: hex,
                  opacity: isHovered ? 1 : 0.9,
                }}
                className="h-full transition-all duration-200 cursor-pointer"
                title={`${item.label}: ${item.count} (${Math.round(pct)}%)`}
                onMouseEnter={() => setHoveredKey(item.key)}
                onMouseLeave={() => setHoveredKey(null)}
              />
            );
          })}
        </div>

        {compact && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
            {items.map((item) => {
              const pct = computedTotal > 0 ? Math.round((item.count / computedTotal) * 100) : 0;
              const hex = resolveHex(item.color, item.colorHex);
              return (
                <div key={item.key} className="flex items-center justify-between text-xs p-1.5 rounded bg-[#FAFAFA]">
                  <span className="text-[#6B6B6B] truncate flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                    {item.label}
                  </span>
                  <span className="font-bold text-[#0A0A0A] ml-1">{item.count} ({pct}%)</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
