import React from 'react';

export interface RankingColumn<T> {
  key: string;
  header: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
  render: (row: T, index: number) => React.ReactNode;
}
export interface RankingTableProps<T> {
  columns: RankingColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

export function RankingTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage = 'Không có dữ liệu',
}: RankingTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-[#6B6B6B] border border-[#E8E8EC] rounded-[12px] bg-[#FFFFFF]">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[12px] border border-[#E8E8EC] bg-[#FFFFFF]">
      <table className="w-full text-left text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-[#E8E8EC] bg-[#FAFAFA] text-[#6B6B6B] font-medium text-xs">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`py-3 px-3.5 ${
                  col.align === 'right'
                    ? 'text-right'
                    : col.align === 'center'
                    ? 'text-center'
                    : 'text-left'
                } ${col.className || ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E8E8EC]">
          {data.map((row, index) => (
            <tr
              key={keyExtractor(row)}
              onClick={() => onRowClick?.(row)}
              className={`transition-colors ${
                onRowClick
                  ? 'hover:bg-[#F0F6FC]/50 cursor-pointer'
                  : 'hover:bg-[#FAFAFA]'
              }`}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`py-2.5 px-3.5 text-[#0A0A0A] ${
                    col.align === 'right'
                      ? 'text-right'
                      : col.align === 'center'
                      ? 'text-center'
                      : 'text-left'
                  } ${col.className || ''}`}
                >
                  {col.render(row, index)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
