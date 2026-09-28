import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => {
  return (
    <div
      className={`animate-pulse bg-slate-200/70 rounded-md ${className}`}
    />
  );
};

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 6 }) => {
  return (
    <div className="divide-y divide-slate-100 p-4 space-y-3">
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div key={rIdx} className="flex items-center gap-4 pt-3">
          {Array.from({ length: cols }).map((_, cIdx) => (
            <div
              key={cIdx}
              className={`h-4 bg-slate-200/60 rounded animate-pulse ${
                cIdx === 0 ? 'w-1/3' : cIdx === 1 ? 'w-1/6' : 'w-1/12'
              }`}
            />
          ))}
        </div>
      ))}
    </div>
  );
};
