import React from 'react';
import { Info, AlertTriangle, AlertCircle, CheckCircle, LucideIcon } from 'lucide-react';

export interface InsightPanelProps {
  title?: string;
  type?: 'info' | 'warning' | 'error' | 'success';
  icon?: LucideIcon;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const InsightPanel: React.FC<InsightPanelProps> = ({
  title,
  type = 'info',
  icon: CustomIcon,
  children,
  action,
  className = '',
}) => {
  const styles = {
    info: {
      bg: 'bg-[#F0F6FC]',
      border: 'border-[#C2DBF2]',
      title: 'text-[#12457A]',
      icon: Info,
      iconColor: 'text-[#1D6FC2]',
    },
    warning: {
      bg: 'bg-[#FFFBEB]',
      border: 'border-[#FDE68A]',
      title: 'text-[#92400E]',
      icon: AlertTriangle,
      iconColor: 'text-[#D97706]',
    },
    error: {
      bg: 'bg-[#FEF2F2]',
      border: 'border-[#FECACA]',
      title: 'text-[#991B1B]',
      icon: AlertCircle,
      iconColor: 'text-[#DC2626]',
    },
    success: {
      bg: 'bg-[#ECFDF5]',
      border: 'border-[#A7F3D0]',
      title: 'text-[#065F46]',
      icon: CheckCircle,
      iconColor: 'text-[#059669]',
    },
  }[type];

  const IconComponent = CustomIcon || styles.icon;

  return (
    <div
      className={`p-4 rounded-[12px] border ${styles.bg} ${styles.border} ${className}`}
    >
      <div className="flex items-start gap-3">
        <IconComponent className={`w-4 h-4 shrink-0 mt-0.5 ${styles.iconColor}`} />
        <div className="flex-1 min-w-0">
          {title && (
            <h4 className={`text-xs sm:text-sm font-bold font-heading mb-1 ${styles.title}`}>
              {title}
            </h4>
          )}
          <div className="text-xs text-[#0A0A0A] leading-relaxed">
            {children}
          </div>
          {action && <div className="mt-2.5">{action}</div>}
        </div>
      </div>
    </div>
  );
};
