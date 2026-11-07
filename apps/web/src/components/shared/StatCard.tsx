import React from 'react';
import { Link } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  to?: string;
  onClick?: () => void;
  badge?: React.ReactNode;
  trend?: {
    text: string;
    type?: 'positive' | 'negative' | 'neutral' | 'warning';
  };
  highlight?: boolean;
  variant?: 'primary' | 'warning' | 'info' | 'success' | 'danger' | 'neutral';
}

const variantStyles: Record<
  NonNullable<StatCardProps['variant']>,
  {
    borderTop: string;
    iconBg: string;
    iconColor: string;
    cardBg: string;
    borderColor: string;
    valueColor: string;
  }
> = {
  primary: {
    borderTop: 'border-t-[#1D6FC2]',
    iconBg: 'bg-blue-100/80 text-[#1D6FC2] border-blue-200',
    iconColor: 'text-[#1D6FC2]',
    cardBg: 'bg-gradient-to-b from-blue-50/60 to-white',
    borderColor: 'border-blue-200/90',
    valueColor: 'text-[#1D6FC2]',
  },
  warning: {
    borderTop: 'border-t-amber-500',
    iconBg: 'bg-amber-100/80 text-amber-800 border-amber-200',
    iconColor: 'text-amber-700',
    cardBg: 'bg-gradient-to-b from-amber-50/60 to-white',
    borderColor: 'border-amber-200/90',
    valueColor: 'text-amber-800',
  },
  info: {
    borderTop: 'border-t-sky-500',
    iconBg: 'bg-sky-100/80 text-sky-800 border-sky-200',
    iconColor: 'text-sky-700',
    cardBg: 'bg-gradient-to-b from-sky-50/60 to-white',
    borderColor: 'border-sky-200/90',
    valueColor: 'text-sky-800',
  },
  success: {
    borderTop: 'border-t-emerald-500',
    iconBg: 'bg-emerald-100/80 text-emerald-800 border-emerald-200',
    iconColor: 'text-emerald-700',
    cardBg: 'bg-gradient-to-b from-emerald-50/60 to-white',
    borderColor: 'border-emerald-200/90',
    valueColor: 'text-emerald-800',
  },
  danger: {
    borderTop: 'border-t-rose-500',
    iconBg: 'bg-rose-100/80 text-rose-800 border-rose-200',
    iconColor: 'text-rose-700',
    cardBg: 'bg-gradient-to-b from-rose-50/60 to-white',
    borderColor: 'border-rose-200/90',
    valueColor: 'text-rose-800',
  },
  neutral: {
    borderTop: 'border-t-slate-400',
    iconBg: 'bg-slate-100 text-slate-700 border-slate-200',
    iconColor: 'text-slate-700',
    cardBg: 'bg-gradient-to-b from-slate-50/70 to-white',
    borderColor: 'border-slate-200',
    valueColor: 'text-slate-900',
  },
};

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtitle,
  icon: Icon,
  to,
  onClick,
  badge,
  trend,
  highlight = false,
  variant = 'neutral',
}) => {
  const v = variantStyles[variant];

  const content = (
    <div
      className={`relative p-4 sm:p-5 rounded-xl border border-t-[3.5px] transition-all duration-200 shadow-2xs hover:shadow-md ${
        highlight
          ? 'bg-gradient-to-br from-blue-50 via-white to-blue-100/30 border-blue-300 border-t-[#1D6FC2]'
          : `${v.cardBg} ${v.borderColor} ${v.borderTop}`
      } ${to || onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-bold text-slate-600 truncate tracking-wider uppercase font-heading">
          {label}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {badge}
          {Icon && (
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors shadow-2xs ${
                highlight
                  ? 'bg-[#1D6FC2] text-white border-[#1D6FC2]'
                  : `${v.iconBg}`
              }`}
            >
              <Icon className="w-4.5 h-4.5" />
            </div>
          )}
        </div>
      </div>

      <div className="mt-2.5 flex items-baseline gap-2">
        <span
          className={`text-3xl font-extrabold font-heading tracking-tight tabular-nums ${
            highlight ? 'text-[#1D6FC2]' : v.valueColor
          }`}
        >
          {value}
        </span>
        {trend && (
          <span
            className={`text-xs font-semibold ${
              trend.type === 'positive'
                ? 'text-emerald-700'
                : trend.type === 'negative'
                ? 'text-rose-600'
                : trend.type === 'warning'
                ? 'text-amber-700'
                : 'text-slate-500'
            }`}
          >
            {trend.text}
          </span>
        )}
      </div>

      {subtitle && (
        <div className="mt-1.5 text-xs text-slate-500 font-medium truncate flex items-center gap-1">
          {subtitle}
        </div>
      )}
    </div>
  );

  if (to) {
    return (
      <Link
        to={to}
        onClick={onClick}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1D6FC2] rounded-xl"
      >
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1D6FC2] rounded-xl"
      >
        {content}
      </button>
    );
  }

  return content;
};
