import React, { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiClient } from '../../lib/apiClient';
import { FilterBar, DataState } from '../shared';
import {
  EvaluationData,
  EvaluationRow,
  errorMessage,
  saveEvaluationExcel,
  evaluationStateLabels,
} from '../EvaluationBoard';
import {
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
} from 'lucide-react';

const GRADE_LEVELS = [
  { key: 'XUAT_SAC', label: 'Xuất sắc', bg: 'bg-[#ECFDF5]', text: 'text-[#065F46]' },
  { key: 'TOT', label: 'Tốt', bg: 'bg-[#F0F6FC]', text: 'text-[#12457A]' },
  { key: 'KHA', label: 'Khá', bg: 'bg-[#F0F9FF]', text: 'text-[#0369A1]' },
  { key: 'TRUNG_BINH', label: 'Trung bình', bg: 'bg-[#FFFBEB]', text: 'text-[#92400E]' },
  { key: 'YEU', label: 'Yếu', bg: 'bg-[#FEF2F2]', text: 'text-[#991B1B]' },
] as const;

type SortField = 'name' | 'score' | 'class';
type SortDirection = 'asc' | 'desc';

export const FacultyStudentLookup: React.FC<{
  termId: string;
  classOptions: { id: string; code: string }[];
}> = ({ termId, classOptions }) => {
  const [params, setParams] = useSearchParams();

  const query = params.get('q') || '';
  const classId = params.get('classId') || '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const pageSize = 25;

  const [response, setResponse] = useState<{ key: string; data: EvaluationData } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState('');

  // Local sorting
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const requestKey = `${termId}:${query}:${classId}:${page}`;

  useEffect(() => {
    let cancelled = false;
    if (!termId) return;

    setLoading(true);
    setFailure(null);

    const filters = {
      ...(classId ? { classId } : {}),
      ...(query.trim() ? { q: query.trim() } : {}),
      page,
      pageSize,
    };

    apiClient
      .getResultReport(termId, filters)
      .then((res) => {
        if (!cancelled) {
          setResponse({ key: requestKey, data: res });
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setFailure({ key: requestKey, message: errorMessage(err) });
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [termId, query, classId, page]);

  const data = response?.key === requestKey ? response.data : null;
  const error = failure?.key === requestKey ? failure.message : '';

  const setFilter = (key: string, value: string) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== 'page') next.delete('page');
      return next;
    });
  };

  const clearFilters = () => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('q');
      next.delete('classId');
      next.delete('page');
      return next;
    });
  };

  const handleExport = async () => {
    setExportNotice('');
    setExporting(true);
    try {
      const result = await apiClient.exportResultReport(termId, {
        ...(classId ? { classId } : {}),
        ...(query.trim() ? { q: query.trim() } : {}),
      });
      saveEvaluationExcel(result.items, termId);
      setExportNotice('Đã xuất thành công bảng kết quả Excel phù hợp bộ lọc.');
    } catch (err) {
      setExportNotice(errorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedRows = useMemo(() => {
    if (!data?.items) return [];
    const rows = [...data.items];

    rows.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        const nameA = a.student?.fullName || '';
        const nameB = b.student?.fullName || '';
        comparison = nameA.localeCompare(nameB, 'vi');
      } else if (sortField === 'score') {
        const scoreA = a.officialScore ?? -1;
        const scoreB = b.officialScore ?? -1;
        comparison = scoreA - scoreB;
      } else if (sortField === 'class') {
        const classA = a.class?.code || '';
        const classB = b.class?.code || '';
        comparison = classA.localeCompare(classB, 'vi');
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return rows;
  }, [data?.items, sortField, sortDirection]);

  const hasFilters = Boolean(classId || query.trim() || page > 1);

  return (
    <div className="space-y-4">
      {/* TOOLBAR: FILTERS + EXPORT ACTION */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[#E8E8EC] bg-white p-3 sm:p-4">
        <div className="flex-1 min-w-[280px]">
          <FilterBar
            searchQuery={query}
            onSearchChange={(q) => setFilter('q', q)}
            searchPlaceholder="Tìm theo MSSV hoặc họ tên sinh viên..."
            searchAriaLabel="Tìm sinh viên"
            hasActiveFilters={hasFilters}
            onClearFilters={clearFilters}
            selects={[
              {
                key: 'classId',
                label: 'Tất cả lớp',
                value: classId,
                options: classOptions.map((c) => ({ value: c.id, label: c.code })),
                onChange: (val: string) => setFilter('classId', val),
                ariaLabel: 'Lọc theo lớp',
              },
            ]}
          />
        </div>

        <button
          type="button"
          disabled={exporting || loading || !data?.total}
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#1D6FC2] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#175A9E] transition-colors disabled:opacity-40 shrink-0"
        >
          <Download className="h-3.5 w-3.5" />
          {exporting ? 'Đang xuất…' : 'Xuất Excel kết quả'}
        </button>
      </div>

      {exportNotice && (
        <div
          role="status"
          className="rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] p-3 text-xs font-medium text-[#065F46]"
        >
          {exportNotice}
        </div>
      )}

      {/* DATA TABLE CONTAINER */}
      <DataState
        loading={loading && !data}
        error={error}
        onRetry={() => setFilter('page', String(page))}
        loadingMessage="Đang tải danh sách sinh viên…"
      >
        {data && (
          <div className="rounded-[12px] border border-[#E8E8EC] bg-white overflow-hidden shadow-sm">
            {sortedRows.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#6B6B6B]">
                Không tìm thấy sinh viên nào phù hợp với điều kiện tìm kiếm.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[620px]">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="sticky top-0 z-10 border-b border-[#E8E8EC] bg-[#FAFAFA] text-[#6B6B6B] font-medium text-xs">
                    <tr>
                      <th className="py-2.5 px-3.5">
                        <button
                          type="button"
                          onClick={() => handleSort('name')}
                          className="inline-flex items-center gap-1 hover:text-[#0A0A0A] font-semibold"
                        >
                          Sinh viên
                          {sortField === 'name' ? (
                            sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 text-[#1D6FC2]" /> : <ArrowDown className="h-3 w-3 text-[#1D6FC2]" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 text-gray-400" />
                          )}
                        </button>
                      </th>
                      <th className="py-2.5 px-3.5">
                        <button
                          type="button"
                          onClick={() => handleSort('class')}
                          className="inline-flex items-center gap-1 hover:text-[#0A0A0A] font-semibold"
                        >
                          Lớp
                          {sortField === 'class' ? (
                            sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 text-[#1D6FC2]" /> : <ArrowDown className="h-3 w-3 text-[#1D6FC2]" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 text-gray-400" />
                          )}
                        </button>
                      </th>
                      <th className="py-2.5 px-3.5">Trạng thái phiếu</th>
                      <th className="py-2.5 px-3.5">
                        <button
                          type="button"
                          onClick={() => handleSort('score')}
                          className="inline-flex items-center gap-1 hover:text-[#0A0A0A] font-semibold"
                        >
                          Điểm công bố
                          {sortField === 'score' ? (
                            sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 text-[#1D6FC2]" /> : <ArrowDown className="h-3 w-3 text-[#1D6FC2]" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 text-gray-400" />
                          )}
                        </button>
                      </th>
                      <th className="py-2.5 px-3.5">Xếp loại</th>
                      <th className="py-2.5 px-3.5 text-right">Phiên bản</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E8EC] bg-white">
                    {sortedRows.map((r: EvaluationRow) => {
                      const gradeMeta = GRADE_LEVELS.find((g) => g.key === r.classification);

                      return (
                        <tr key={r.studentId} className="hover:bg-[#FAFAFA] transition-colors">
                          <td className="py-2 px-3.5">
                            <Link
                              className="font-semibold text-[#1D6FC2] hover:underline block truncate max-w-[200px]"
                              to={`/officer/students/${r.studentId}/assessment?termId=${termId}`}
                              title={`Xem phiếu đánh giá của ${r.student?.fullName}`}
                            >
                              {r.student?.fullName || 'Sinh viên'}
                            </Link>
                            <span className="text-[11px] text-[#6B6B6B] font-mono">
                              {r.student?.studentCode}
                            </span>
                          </td>
                          <td className="py-2 px-3.5 text-[#0A0A0A] font-medium">
                            {r.class?.code || '—'}
                          </td>
                          <td className="py-2 px-3.5">
                            <span className="inline-block rounded-full border border-[#E8E8EC] bg-[#FAFAFA] px-2 py-0.5 text-[11px] font-medium text-[#0A0A0A]">
                              {evaluationStateLabels[r.state] || r.state}
                            </span>
                          </td>
                          <td className="py-2 px-3.5 font-mono">
                            <strong className="text-sm font-bold text-[#0A0A0A]">
                              {r.officialScore !== null && r.officialScore !== undefined
                                ? `${r.officialScore} đ`
                                : '—'}
                            </strong>
                          </td>
                          <td className="py-2 px-3.5">
                            <span
                              className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${
                                gradeMeta ? `${gradeMeta.bg} ${gradeMeta.text}` : 'text-[#6B6B6B]'
                              }`}
                            >
                              {gradeMeta?.label || r.classification || 'Chưa công bố'}
                            </span>
                          </td>
                          <td className="py-2 px-3.5 text-right font-mono text-xs text-[#6B6B6B]">
                            {r.publicationRevision ? `v${r.publicationRevision}` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* PAGINATION FOOTER */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E8E8EC] bg-[#FAFAFA] p-3 text-xs text-[#6B6B6B]">
              <span>
                Hiển thị <strong>{data.items.length}</strong> / <strong>{data.total}</strong> sinh viên
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setFilter('page', String(page - 1))}
                  className="rounded-md border border-[#E8E8EC] bg-white px-3 py-1.5 font-medium hover:bg-[#F4F4F6] disabled:opacity-40"
                >
                  Trước
                </button>
                <span className="font-semibold text-[#0A0A0A]">
                  Trang {page} / {Math.max(1, Math.ceil(data.total / pageSize))}
                </span>
                <button
                  type="button"
                  disabled={page * pageSize >= data.total}
                  onClick={() => setFilter('page', String(page + 1))}
                  className="rounded-md border border-[#E8E8EC] bg-white px-3 py-1.5 font-medium hover:bg-[#F4F4F6] disabled:opacity-40"
                >
                  Tiếp
                </button>
              </div>
            </div>
          </div>
        )}
      </DataState>
    </div>
  );
};
