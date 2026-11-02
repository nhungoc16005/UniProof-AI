import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, LucideIcon } from 'lucide-react';

export interface ActionQueueItem {
  id: string;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  to: string;
  icon?: LucideIcon;
  urgent?: boolean;
}

export interface ActionQueueProps {
  title: string;
  items: ActionQueueItem[];
  emptyMessage?: string;
  viewAllLink?: string;
  viewAllText?: string;
  maxItems?: number;
}

export const ActionQueue: React.FC<ActionQueueProps> = ({
  title,
  items,
  emptyMessage = 'Không có việc cần xử lý ngay.',
  viewAllLink,
  viewAllText = 'Xem tất cả',
  maxItems = 8,
}) => {
  const displayedItems = items.slice(0, maxItems);

  return (
    <div className="rounded-[12px] border border-[#E8E8EC] bg-white overflow-hidden shadow-sm">
      <div className="flex items-center justify-between p-3.5 border-b border-[#E8E8EC] bg-[#FAFAFA]">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold font-heading text-[#0A0A0A]">{title}</h3>
          {items.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#E1EDF9] text-[#1D6FC2] border border-[#C2DBF2]">
              {items.length}
            </span>
          )}
        </div>
        {viewAllLink && items.length > 0 && (
          <Link
            to={viewAllLink}
            className="text-xs font-semibold text-[#1D6FC2] hover:text-[#175A9E] hover:underline"
          >
            {viewAllText} ({items.length}) →
          </Link>
        )}
      </div>

      {displayedItems.length === 0 ? (
        <div className="p-6 text-center text-xs text-[#64748B]">
          {emptyMessage}
        </div>
      ) : (
        <div className="divide-y divide-[#E8E8EC]">
          {displayedItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                to={item.to}
                className="flex items-center justify-between gap-3 p-3 hover:bg-[#F8FAFC] transition-colors group focus:outline-none focus-visible:bg-[#F0F6FC]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {Icon && (
                    <div
                      className={`p-2 rounded-[8px] shrink-0 border transition-colors ${
                        item.urgent
                          ? 'bg-rose-50 text-rose-600 border-rose-200'
                          : 'bg-blue-50 text-[#1D6FC2] border-blue-100'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#0A0A0A] truncate group-hover:text-[#1D6FC2] transition-colors">
                        {item.title}
                      </span>
                      {item.urgent && (
                        <span className="rounded bg-rose-100 px-1.5 py-0.2 text-[10px] font-bold text-rose-700 shrink-0">
                          Ưu tiên
                        </span>
                      )}
                      {item.badge}
                    </div>
                    {item.subtitle && (
                      <p className="text-[11px] text-[#64748B] truncate mt-0.5">
                        {item.subtitle}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 text-[#64748B] group-hover:text-[#1D6FC2] transition-colors">
                  <span className="text-xs hidden sm:inline-block font-semibold">Xử lý</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};
