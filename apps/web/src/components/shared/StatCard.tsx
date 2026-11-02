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
    borderAccent: string;
    iconBg: string;
    iconColor: string;
    cardBg: string;
    borderColor: string;
    valueColor: string;
  }
> = {
  primary: {
    borderAccent: 'border-t-[#1D6FC2]',
    iconBg: 'bg-[#EFF6FF]',
    iconColor: 'text-[#1D6FC2]',
    cardBg: 'bg-gradient-to-b from-[#F0F6FC]/80 to-white',
    borderColor: 'border-[#C2DBF2]',
    valueColor: 'text-[#1D6FC2]',
  },
  warning: {
    borderAccent: 'border-t-[#D97706]',
    iconBg: 'bg-[#FEF3C7]',
    iconColor: 'text-[#D97706]',
    cardBg: 'bg-gradient-to-b from-[#FFFBEB]/80 to-white',
    borderColor: 'border-[#FDE68A]',
    valueColor: 'text-[#D97706]',
  },
  info: {
    borderAccent: 'border-t-[#0284C7]',
    iconBg: 'bg-[#E0F2FE]',
    iconColor: 'text-[#0284C7]',
    cardBg: 'bg-gradient-to-b from-[#F0F9FF]/80 to-white',
    borderColor: 'border-[#BAE6FD]',
    valueColor: 'text-[#0284C7]',
  },
  success: {
    borderAccent: 'border-t-[#059669]',
    iconBg: 'bg-[#D1FAE5]',
    iconColor: 'text-[#059669]',
    cardBg: 'bg-gradient-to-b from-[#ECFDF5]/80 to-white',
    borderColor: 'border-[#A7F3D0]',
    valueColor: 'text-[#059669]',
  },
  danger: {
    borderAccent: 'border-t-[#EF4444]',
    iconBg: 'bg-[#FEE2E2]',
    iconColor: 'text-[#DC2626]',
    cardBg: 'bg-gradient-to-b from-[#FEF2F2]/80 to-white',
    borderColor: 'border-[#FECACA]',
    valueColor: 'text-[#DC2626]',
  },
  neutral: {
    borderAccent: 'border-t-[#64748B]',
    iconBg: 'bg-[#F1F5F9]',
    iconColor: 'text-[#475569]',
    cardBg: 'bg-gradient-to-b from-[#F8FAFC] to-white',
    borderColor: 'border-[#E2E8F0]',
    valueColor: 'text-[#0F172A]',
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
      className={`relative p-4 sm:p-4.5 rounded-[12px] border transition-all duration-200 ${
        highlight
          ? 'bg-gradient-to-br from-[#EFF6FF] via-white to-[#DBEAFE] border-[#93C5FD] shadow-xs border-t-3 border-t-[#1D6FC2]'
          : `${v.cardBg} ${v.borderColor} border-t-3 ${v.borderAccent} shadow-xs hover:shadow-md`
      } ${to || onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-bold text-[#475569] truncate tracking-wider uppercase">
          {label}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {badge}
          {Icon && (
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-[8px] border transition-colors ${
                highlight
                  ? 'bg-[#1D6FC2] text-white border-[#1D6FC2] shadow-sm'
                  : `${v.iconBg} ${v.iconColor} border-black/5`
              }`}
            >
              <Icon className="w-4 h-4" />
            </div>
          )}
        </div>
      </div>

      <div className="mt-2.5 flex items-baseline gap-2">
        <span
          className={`text-2xl sm:text-3xl font-extrabold font-heading tracking-tight tabular-nums ${
            highlight ? 'text-[#1D6FC2]' : v.valueColor
          }`}
        >
          {value}
        </span>
        {trend && (
          <span
            className={`text-xs font-semibold ${
              trend.type === 'positive'
                ? 'text-[#059669]'
                : trend.type === 'negative'
                ? 'text-[#EF4444]'
                : trend.type === 'warning'
                ? 'text-[#D97706]'
                : 'text-[#64748B]'
            }`}
          >
            {trend.text}
          </span>
        )}
      </div>

      {subtitle && (
        <div className="mt-1.5 text-xs text-[#64748B] font-medium truncate flex items-center gap-1">
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
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1D6FC2] rounded-[12px]"
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
        className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1D6FC2] rounded-[12px]"
      >
        {content}
      </button>
    );
  }

  return content;
};
