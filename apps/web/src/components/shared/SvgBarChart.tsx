import React, { useState } from 'react';

export interface BarItem {
  key: string;
  label: string;
  value: number;
  color?: string; // hex color
  sublabel?: string;
}

export interface SvgBarChartProps {
  items: BarItem[];
  height?: number;
  valueSuffix?: string;
}

export const SvgBarChart: React.FC<SvgBarChartProps> = ({
  items,
  height = 140,
  valueSuffix = '',
}) => {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const maxValue = Math.max(1, ...items.map((i) => i.value));

  return (
    <div className="w-full">
      <div
        className="flex items-end justify-between gap-3 pt-6 pb-2"
        style={{ height }}
      >
        {items.map((item) => {
          const heightPercent = Math.max(4, Math.round((item.value / maxValue) * 100));
          const isHovered = hoveredKey === item.key;
          const barColor = item.color || '#1D6FC2';

          return (
            <div
              key={item.key}
              className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
              onMouseEnter={() => setHoveredKey(item.key)}
              onMouseLeave={() => setHoveredKey(null)}
            >
              {/* Tooltip on hover */}
              {isHovered && (
                <div className="absolute -top-7 px-2 py-0.5 rounded-[4px] bg-[#0A0A0A] text-white text-[10px] font-semibold tracking-tight shadow-md whitespace-nowrap z-10">
                  {item.value} {valueSuffix}
                </div>
              )}

              {/* Value label above bar */}
              <span
                className={`text-[11px] font-heading font-bold mb-1 transition-colors ${
                  isHovered ? 'text-[#1D6FC2]' : 'text-[#0A0A0A]'
                }`}
              >
                {item.value}
              </span>

              {/* Bar */}
              <div className="w-full max-w-[48px] bg-[#F4F4F6] rounded-t-[6px] h-full flex items-end overflow-hidden">
                <div
                  className="w-full rounded-t-[6px] transition-all duration-300"
                  style={{
                    height: `${heightPercent}%`,
                    backgroundColor: barColor,
                    opacity: isHovered ? 1 : 0.85,
                  }}
                />
              </div>

              {/* Label below bar */}
              <div className="mt-2 text-center">
                <p className="text-[11px] font-medium text-[#0A0A0A] truncate">
                  {item.label}
                </p>
                {item.sublabel && (
                  <p className="text-[9px] text-[#8A8A8E] truncate">
                    {item.sublabel}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
