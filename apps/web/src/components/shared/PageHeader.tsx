import React from 'react';

export interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  badge?: React.ReactNode;
  meta?: React.ReactNode;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  badge,
  meta,
  action,
  secondaryAction,
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 pb-1">
      <div className="space-y-1.5 max-w-3xl">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-xl sm:text-2xl font-bold font-heading text-[#0A0A0A] tracking-tight">
            {title}
          </h1>
          {badge}
        </div>
        {description && (
          <div className="text-xs sm:text-sm text-[#6B6B6B] leading-relaxed">
            {description}
          </div>
        )}
        {meta && (
          <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs text-[#6B6B6B]">
            {meta}
          </div>
        )}
      </div>

      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {secondaryAction}
          {action}
        </div>
      )}
    </div>
  );
};
