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
  Award,
  Clock,
  GraduationCap,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
} from 'lucide-react';
import { percentage } from '../../lib/facultyAnalytics';

type ReportData = EvaluationData & {
  totalEvaluated: number;
  pendingStudents: number;
  averageScore: number | null;
  distribution: Record<string, number>;
  source: string;
  classProgress: {
    id: string;
    code: string;
    total: number;
    completed: number;
    pending: number;
    average: number | null;
  }[];
};

const GRADE_LEVELS = [
  { key: 'XUAT_SAC', label: 'Xuất sắc', range: '≥ 90', color: '#059669', bg: 'bg-[#ECFDF5]', text: 'text-[#065F46]' },
  { key: 'TOT', label: 'Tốt', range: '80 – 89', color: '#1D6FC2', bg: 'bg-[#F0F6FC]', text: 'text-[#12457A]' },
  { key: 'KHA', label: 'Khá', range: '65 – 79', color: '#0284C7', bg: 'bg-[#F0F9FF]', text: 'text-[#0369A1]' },
  { key: 'TRUNG_BINH', label: 'Trung bình', range: '50 – 64', color: '#F59E0B', bg: 'bg-[#FFFBEB]', text: 'text-[#92400E]' },
  { key: 'YEU', label: 'Yếu', range: '< 50', color: '#EF4444', bg: 'bg-[#FEF2F2]', text: 'text-[#991B1B]' },
] as const;

export const PublishedResultsSection: React.FC<{
  termId: string;
  legacy?: boolean;
  classOptions: { id: string; code: string }[];
}> = ({ termId, legacy = false, classOptions }) => {
  const [params, setParams] = useSearchParams();

  const query = params.get('q') || '';
  const classId = params.get('classId') || '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const pageSize = 25;

  const [response, setResponse] = useState<{ key: string; data: ReportData } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState('');
  const [showAllClasses, setShowAllClasses] = useState(false);

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

  const sortedClassProgress = useMemo(() => {
    if (!data?.classProgress) return [];
    return [...data.classProgress].sort((a, b) => b.pending - a.pending || b.total - a.total);
  }, [data?.classProgress]);

  const visibleClasses = showAllClasses ? sortedClassProgress : sortedClassProgress.slice(0, 8);

  const distribution = data?.distribution || {};
  const totalEvaluated = data?.totalEvaluated ?? 0;
  const maxGradeCount = Math.max(1, ...GRADE_LEVELS.map((g) => distribution[g.key] || 0));

  const hasFilters = Boolean(classId || query.trim() || page > 1);

  return (
    <div className="space-y-6">
      {/* SECTION HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8E8EC] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1D6FC2] text-[11px] font-bold text-white">
              3
            </span>
            <h2 className="text-lg font-semibold font-heading text-[#0A0A0A]">
              {legacy ? 'Kết quả kỳ lịch sử' : 'Kết quả đã công bố'}
            </h2>
            <span className="rounded-full border border-[#C2DBF2] bg-[#F0F6FC] px-2 py-0.5 text-[11px] font-medium text-[#1D6FC2]">
              {data?.source === 'LEGACY_RUBRIC' ? 'Rubric kỳ lịch sử' : 'Official Publication'}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#6B6B6B]">
            Dữ liệu lấy từ phiên bản công bố chính thức mới nhất. Sinh viên chưa có kết quả và ghi nhận không nộp được thống kê riêng.
          </p>
        </div>
        {data && (
          <span className="text-xs text-[#6B6B6B]">
            Cập nhật: {new Date(data.updatedAt).toLocaleString('vi-VN')}
          </span>
        )}
      </div>

      <DataState
        loading={loading && !data}
        error={error}
        onRetry={() => setFilter('page', String(page))}
        loadingMessage="Đang tổng hợp kết quả công bố…"
      >
        {data && (
          <div className="space-y-6">
            {/* CONTEXTUAL METRIC BANNER */}
            <div className="grid grid-cols-1 divide-y divide-[#E8E8EC] rounded-[12px] border border-[#E8E8EC] bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <div className="p-4 sm:p-5 flex items-center gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#ECFDF5] text-[#059669]">
                  <Award className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-[#6B6B6B]">Đã có kết quả chính thức</p>
                  <p className="text-lg font-bold font-heading text-[#0A0A0A]">
                    {data.totalEvaluated.toLocaleString('vi-VN')}{' '}
                    <span className="text-xs font-normal text-[#6B6B6B]">
                      / {data.total.toLocaleString('vi-VN')} SV ({percentage(data.totalEvaluated, data.total)}%)
                    </span>
                  </p>
                </div>
              </div>

              <div className="p-4 sm:p-5 flex items-center gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#FFFBEB] text-[#D97706]">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-[#6B6B6B]">Chưa có kết quả</p>
                  <p className="text-lg font-bold font-heading text-[#D97706]">
                    {data.pendingStudents.toLocaleString('vi-VN')}{' '}
                    <span className="text-xs font-normal text-[#6B6B6B]">
                      ({percentage(data.pendingStudents, data.total)}%)
                    </span>
                  </p>
                </div>
              </div>

              <div className="p-4 sm:p-5 flex items-center gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F0F6FC] text-[#1D6FC2]">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-[#6B6B6B]">Điểm trung bình đã công bố</p>
                  <p className="text-lg font-bold font-heading text-[#1D6FC2]">
                    {data.averageScore !== null && data.averageScore !== undefined
                      ? `${data.averageScore} / 100`
                      : 'Chưa có'}
                  </p>
                </div>
              </div>
            </div>

            {/* TWO-COLUMN RESULTS MATRIX: PHỔ ĐIỂM + TIẾN ĐỘ THEO LỚP */}
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              {/* PHỔ ĐIỂM XẾP LOẠI RÈN LUYỆN */}
              <section
                aria-label="Phổ điểm xếp loại rèn luyện"
                className="rounded-[12px] border border-[#E8E8EC] bg-white p-4 sm:p-5 space-y-4"
              >
                <div>
                  <h3 className="text-base font-semibold font-heading text-[#0A0A0A]">
                    Phổ điểm xếp loại rèn luyện
                  </h3>
                  <p className="mt-0.5 text-xs text-[#6B6B6B]">
                    Tỷ trọng 5 mức xếp loại trên {totalEvaluated.toLocaleString('vi-VN')} sinh viên đã có điểm.
                  </p>
                </div>

                {totalEvaluated === 0 ? (
                  <p className="py-8 text-center text-xs text-[#6B6B6B]">
                    Chưa có sinh viên nào có kết quả công bố trong kỳ này.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {GRADE_LEVELS.map((grade) => {
                      const count = distribution[grade.key] || 0;
                      const pctOfEvaluated = percentage(count, totalEvaluated);
                      const barWidth = Math.round((count / maxGradeCount) * 100);

                      return (
                        <div key={grade.key} className="space-y-1">
                          <div className="flex items-baseline justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 rounded-sm shrink-0"
                                style={{ backgroundColor: grade.color }}
                              />
                              <span className="font-semibold text-[#0A0A0A]">{grade.label}</span>
                              <span className="text-[#6B6B6B]">({grade.range} đ)</span>
                            </div>
                            <div className="tabular-nums text-xs">
                              <strong className="text-[#0A0A0A] font-bold">
                                {count.toLocaleString('vi-VN')} SV
                              </strong>
                              <span className="ml-2 text-[#6B6B6B]">({pctOfEvaluated}%)</span>
                            </div>
                          </div>
                          <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#F1F3F5]">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{ width: `${barWidth}%`, backgroundColor: grade.color }}
                              title={`${grade.label}: ${count} SV (${pctOfEvaluated}%)`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* TÁCH RIÊNG CHƯA CÓ KẾT QUẢ & GHI NHẬN KHÔNG NỘP */}
                <div className="grid gap-2.5 border-t border-[#E8E8EC] pt-3 text-xs sm:grid-cols-2">
                  <div className="rounded-lg border border-[#E8E8EC] bg-[#FAFAFA] p-2.5">
                    <div className="flex items-center gap-1.5 font-semibold text-[#0A0A0A]">
                      <span className="h-2 w-2 rounded-full bg-[#D97706]" />
                      Chưa có kết quả: <strong className="text-[#D97706]">{data.pendingStudents} SV</strong>
                    </div>
                    <p className="mt-1 text-[11px] text-[#6B6B6B]">
                      Đang ở khâu tự chấm hoặc thẩm định, chưa tính vào phổ điểm.
                    </p>
                  </div>

                  <div className="rounded-lg border border-[#E8E8EC] bg-[#FAFAFA] p-2.5">
                    <div className="flex items-center gap-1.5 font-semibold text-[#0A0A0A]">
                      <span className="h-2 w-2 rounded-full bg-[#991B1B]" />
                      Ghi nhận không nộp:{' '}
                      <strong className="text-[#991B1B]">
                        {(data.summary?.recordedNotSubmitted ?? 0).toLocaleString('vi-VN')} SV
                      </strong>
                    </div>
                    <p className="mt-1 text-[11px] text-[#6B6B6B]">
                      Thống kê riêng theo quy chế, không xếp vào nhóm điểm thấp.
                    </p>
                  </div>
                </div>
              </section>

              {/* TIẾN ĐỘ CÔNG BỐ THEO LỚP */}
              {sortedClassProgress.length > 0 && (
                <section
                  aria-label="Tiến độ công bố theo lớp"
                  className="rounded-[12px] border border-[#E8E8EC] bg-white p-4 sm:p-5 space-y-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold font-heading text-[#0A0A0A]">
                        Tiến độ công bố theo lớp
                      </h3>
                      <p className="mt-0.5 text-xs text-[#6B6B6B]">
                        Lớp còn nhiều sinh viên chưa có kết quả xếp lên trước. Bấm mã lớp để lọc bảng bên dưới.
                      </p>
                    </div>
                    {sortedClassProgress.length > 8 && (
                      <button
                        type="button"
                        onClick={() => setShowAllClasses((v) => !v)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#1D6FC2] hover:underline"
                      >
                        {showAllClasses ? 'Thu gọn' : `Xem tất cả (${sortedClassProgress.length})`}
                        {showAllClasses ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                    )}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[380px] text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#E8E8EC] bg-[#FAFAFA] text-[#6B6B6B] font-medium">
                          <th className="py-2 px-2.5">Lớp</th>
                          <th className="py-2 px-2.5">Sĩ số</th>
                          <th className="py-2 px-2.5">Đã công bố</th>
                          <th className="py-2 px-2.5">Chưa có KQ</th>
                          <th className="py-2 px-2.5 text-right">Điểm TB</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E8E8EC]">
                        {visibleClasses.map((cls) => {
                          const pct = cls.total > 0 ? Math.round((cls.completed / cls.total) * 100) : 0;
                          const isSelected = classId === cls.id;

                          return (
                            <tr
                              key={cls.id}
                              className={`transition-colors ${
                                isSelected ? 'bg-[#F0F6FC]' : 'hover:bg-[#FAFAFA]'
                              }`}
                            >
                              <td className="py-2 px-2.5">
                                <button
                                  type="button"
                                  onClick={() => setFilter('classId', isSelected ? '' : cls.id)}
                                  className={`font-semibold hover:underline text-left ${
                                    isSelected ? 'text-[#175A9E] font-bold' : 'text-[#1D6FC2]'
                                  }`}
                                  title={`Lọc danh sách theo lớp ${cls.code}`}
                                >
                                  {cls.code}
                                  {isSelected && <span className="ml-1 text-[10px] text-[#1D6FC2]">(Đang lọc)</span>}
                                </button>
                              </td>
                              <td className="py-2 px-2.5 tabular-nums text-[#0A0A0A]">{cls.total}</td>
                              <td className="py-2 px-2.5 tabular-nums font-semibold text-[#059669]">
                                {cls.completed} <span className="text-[10px] text-[#6B6B6B]">({pct}%)</span>
                              </td>
                              <td className="py-2 px-2.5 tabular-nums">
                                <span
                                  className={
                                    cls.pending > 0
                                      ? 'font-semibold text-[#D97706]'
                                      : 'text-[#6B6B6B]'
                                  }
                                >
                                  {cls.pending}
                                </span>
                              </td>
                              <td className="py-2 px-2.5 text-right tabular-nums font-bold text-[#0A0A0A]">
                                {cls.average !== null && cls.average !== undefined ? cls.average : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </div>

            {/* SECTION 4: TRA CỨU CHI TIẾT VÀ XUẤT EXCEL (#tra-cuu) */}
            <section
              id="tra-cuu"
              aria-label="Tra cứu chi tiết và xuất Excel"
              className="rounded-[12px] border border-[#E8E8EC] bg-white p-4 sm:p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8E8EC] pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1D6FC2] text-[11px] font-bold text-white">
                      4
                    </span>
                    <h3 className="text-base font-semibold font-heading text-[#0A0A0A]">
                      Tra cứu chi tiết từng sinh viên & Xuất báo cáo
                    </h3>
                  </div>
                  <p className="mt-0.5 text-xs text-[#6B6B6B]">
                    Bộ lọc tại đây áp dụng riêng cho bảng tra cứu và xuất file Excel kết quả.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={exporting || loading || !data.total}
                  onClick={handleExport}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#1D6FC2] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#175A9E] transition-colors disabled:opacity-40"
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

              {/* FILTER BAR FOR DETAIL LOOKUP */}
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

              {/* STUDENT TABLE */}
              {data.items.length === 0 ? (
                <div className="rounded-lg border border-[#E8E8EC] bg-[#FAFAFA] p-8 text-center text-xs text-[#6B6B6B]">
                  Không tìm thấy sinh viên nào phù hợp với bộ lọc hiện tại.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-[#E8E8EC]">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-[#E8E8EC] bg-[#FAFAFA] text-[#6B6B6B] font-medium text-xs">
                        <th className="py-2.5 px-3.5">Sinh viên</th>
                        <th className="py-2.5 px-3.5">Lớp</th>
                        <th className="py-2.5 px-3.5">Trạng thái phiếu</th>
                        <th className="py-2.5 px-3.5">Điểm công bố</th>
                        <th className="py-2.5 px-3.5">Xếp loại</th>
                        <th className="py-2.5 px-3.5 text-right">Phiên bản</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E8EC] bg-white">
                      {data.items.map((r: EvaluationRow) => {
                        const gradeMeta = GRADE_LEVELS.find((g) => g.key === r.classification);

                        return (
                          <tr key={r.studentId} className="hover:bg-[#FAFAFA] transition-colors">
                            <td className="py-2 px-3.5">
                              <Link
                                className="font-semibold text-[#1D6FC2] hover:underline block"
                                to={`/officer/students/${r.studentId}/assessment?termId=${termId}`}
                              >
                                {r.student?.fullName || 'Sinh viên'}
                              </Link>
                              <span className="text-[11px] text-[#6B6B6B]">
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

              {/* PAGINATION */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-[#6B6B6B]">
                <span>
                  Hiển thị {data.items.length} / {data.total} sinh viên
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setFilter('page', String(page - 1))}
                    className="rounded-md border border-[#E8E8EC] bg-white px-3 py-1.5 font-medium hover:bg-[#FAFAFA] disabled:opacity-40"
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
                    className="rounded-md border border-[#E8E8EC] bg-white px-3 py-1.5 font-medium hover:bg-[#FAFAFA] disabled:opacity-40"
                  >
                    Tiếp
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}
      </DataState>
    </div>
  );
};
