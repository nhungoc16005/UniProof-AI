import React, { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/apiClient';
import {
  PageHeader,
  SectionHeader,
  StatCard,
  StatusBreakdown,
  FilterBar,
  DataState,
  RankingTable,
} from './shared';
import {
  EvaluationData,
  EvaluationRow,
  errorMessage,
  saveEvaluationExcel,
  evaluationStateLabels,
} from './EvaluationBoard';
import {
  Download,
  Users,
  Award,
  Clock,
  Building2,
  GraduationCap,
  FileSpreadsheet,
  RefreshCw,
} from 'lucide-react';

type Report = EvaluationData & {
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

export const ResultReports: React.FC<{ admin?: boolean }> = ({ admin = false }) => {
  const { activeTerm } = useAuth();
  const [params, setParams] = useSearchParams();
  const termId = params.get('termId') || activeTerm.id;

  const [response, setResponse] = useState<{ key: string; data: Report } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState('');
  const [refresh, setRefresh] = useState(0);

  const facultyId = params.get('facultyId') || '';
  const classId = params.get('classId') || '';
  const query = params.get('q') || '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const pageSize = 25;

  const filters = useMemo(() => {
    return {
      ...(facultyId ? { facultyId } : {}),
      ...(classId ? { classId } : {}),
      ...(query ? { q: query } : {}),
      page,
      pageSize,
    };
  }, [facultyId, classId, query, page, pageSize]);

  const requestKey = JSON.stringify({ termId, filters, admin, refresh });
  const data = response?.key === requestKey ? response.data : null;
  const loadError = failure?.key === requestKey ? failure.message : '';
  const loading = Boolean(termId && !data && !loadError);
  const options = response?.data.term.id === termId ? response.data.filters : { classes: [], faculties: [] };
  const hasFilters = Boolean(facultyId || classId || query.trim() || page > 1);

  useEffect(() => {
    let cancelled = false;
    if (!termId) return;

    apiClient
      .getResultReport(termId, filters)
      .then((result) => {
        if (!cancelled) setResponse({ key: requestKey, data: result });
      })
      .catch((err) => {
        if (!cancelled) setFailure({ key: requestKey, message: errorMessage(err) });
      });

    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  const setFilter = (key: string, value: string) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== 'page') next.delete('page');
      next.set('termId', termId);
      return next;
    });

  const clearFilters = () => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      ['q', 'classId', 'facultyId', 'page'].forEach((k) => next.delete(k));
      next.set('termId', termId);
      return next;
    });
  };

  const exportRows = async () => {
    setExportNotice('');
    setExporting(true);
    try {
      const result = await apiClient.exportResultReport(termId, filters);
      saveEvaluationExcel(result.items, termId);
      setExportNotice('Đã xuất thành công bảng kết quả Excel phù hợp bộ lọc.');
    } catch (err) {
      setExportNotice(errorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const rows: EvaluationRow[] = data?.items || [];
  const groups = data?.classProgress || [];
  const facultyGroups = data?.facultyProgress || [];

  // Distribution horizontal items
  const distributionItems = useMemo(() => {
    const dist = data?.distribution || {};
    return [
      { key: 'XUAT_SAC', label: 'Xuất sắc (≥90)', count: dist.XUAT_SAC || 0, color: 'bg-[#10B981]' },
      { key: 'TOT', label: 'Tốt (80–89)', count: dist.TOT || 0, color: 'bg-[#1D6FC2]' },
      { key: 'KHA', label: 'Khá (65–79)', count: dist.KHA || 0, color: 'bg-[#0284C7]' },
      { key: 'TRUNG_BINH', label: 'Trung bình (50–64)', count: dist.TRUNG_BINH || 0, color: 'bg-[#F59E0B]' },
      { key: 'YEU', label: 'Yếu (<50)', count: dist.YEU || 0, color: 'bg-[#EF4444]' },
      {
        key: 'NOT_SUBMITTED',
        label: 'Ghi nhận không nộp',
        count: data?.summary?.recordedNotSubmitted || 0,
        color: 'bg-[#6B6B6B]',
      },
    ];
  }, [data]);

  // Cột bảng tổng hợp theo lớp
  const classSummaryColumns = useMemo(
    () => [
      {
        key: 'code',
        header: 'Lớp sinh viên',
        render: (row: any) => (
          <button
            type="button"
            onClick={() => setFilter('classId', row.id)}
            className="font-bold text-[#1D6FC2] hover:text-[#175A9E] hover:underline text-left"
          >
            {row.code}
          </button>
        ),
      },
      {
        key: 'total',
        header: 'Sĩ số kỳ',
        render: (row: any) => <span>{row.total}</span>,
      },
      {
        key: 'completed',
        header: 'Đã có kết quả',
        render: (row: any) => (
          <span className="font-semibold text-[#10B981]">{row.completed}</span>
        ),
      },
      {
        key: 'pending',
        header: 'Chưa có kết quả',
        render: (row: any) => (
          <span className={row.pending > 0 ? 'text-[#F59E0B] font-semibold' : 'text-[#6B6B6B]'}>
            {row.pending}
          </span>
        ),
      },
      {
        key: 'rate',
        header: 'Tỷ lệ hoàn thành',
        render: (row: any) => {
          const pct = row.total > 0 ? Math.round((row.completed / row.total) * 100) : 0;
          return (
            <div className="flex items-center gap-2">
              <div className="w-16 h-1.5 rounded-full bg-[#F4F4F6] overflow-hidden">
                <div
                  style={{ width: `${pct}%` }}
                  className={`h-full ${pct === 100 ? 'bg-[#10B981]' : 'bg-[#1D6FC2]'}`}
                />
              </div>
              <span className="text-xs text-[#6B6B6B]">{pct}%</span>
            </div>
          );
        },
      },
      {
        key: 'average',
        header: 'Điểm TB',
        align: 'right' as const,
        render: (row: any) => (
          <span className="font-bold text-[#0A0A0A]">
            {row.average !== null && row.average !== undefined ? row.average : '—'}
          </span>
        ),
      },
    ],
    []
  );

  // Cột bảng tổng hợp theo Khoa (cho Admin)
  const facultySummaryColumns = useMemo(
    () => [
      {
        key: 'name',
        header: 'Khoa / Đơn vị',
        render: (row: any) => (
          <button
            type="button"
            onClick={() => setFilter('facultyId', row.id)}
            className="font-bold text-[#1D6FC2] hover:text-[#175A9E] hover:underline text-left"
          >
            {row.name}
          </button>
        ),
      },
      {
        key: 'total',
        header: 'Sĩ số',
        render: (row: any) => <span>{row.total}</span>,
      },
      {
        key: 'sent',
        header: 'Đã gửi CTSV',
        render: (row: any) => (
          <span className="font-semibold text-[#1D6FC2]">{row.sent}</span>
        ),
      },
      {
        key: 'published',
        header: 'Đã công bố',
        render: (row: any) => (
          <span className="font-semibold text-[#10B981]">{row.published}</span>
        ),
      },
      {
        key: 'appeals',
        header: 'Phúc khảo',
        align: 'right' as const,
        render: (row: any) => (
          <span className={row.pendingAppeals > 0 ? 'text-[#D97706] font-semibold' : 'text-[#6B6B6B]'}>
            {row.pendingAppeals}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6 pb-12 font-sans">
      <PageHeader
        title={admin ? 'Báo cáo điểm rèn luyện toàn trường' : 'Báo cáo điểm rèn luyện Khoa'}
        badge={
          data?.term && (
            <span className="px-2.5 py-1 rounded-[6px] text-xs font-semibold bg-[#F0F6FC] text-[#1D6FC2] border border-[#C2DBF2]">
              {data.term.name}
            </span>
          )
        }
        meta={
          data && (
            <span>
              Cập nhật: {new Date(data.updatedAt).toLocaleString('vi-VN')} · Nguồn:{' '}
              {data.source === 'LEGACY_RUBRIC' ? 'Rubric kỳ lịch sử' : 'Kết quả công bố chính thức'}
            </span>
          )
        }
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRefresh((n) => n + 1)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0A0A0A] bg-[#FFFFFF] hover:bg-[#FAFAFA] border border-[#E8E8EC] rounded-[6px] transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Làm mới
            </button>
            <button
              disabled={loading || exporting || !data?.total}
              onClick={exportRows}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#1D6FC2] hover:bg-[#175A9E] rounded-[6px] btn-primary-lift disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" />
              {exporting ? 'Đang xuất…' : 'Xuất Excel kết quả'}
            </button>
          </div>
        }
      />

      {exportNotice && (
        <div
          role="status"
          className="p-3 rounded-[8px] bg-[#ECFDF5] border border-[#A7F3D0] text-xs text-[#065F46] font-medium"
        >
          {exportNotice}
        </div>
      )}

      {/* FILTER BAR */}
      <FilterBar
        searchQuery={query}
        onSearchChange={(q) => setFilter('q', q)}
        searchPlaceholder="Tìm theo MSSV hoặc họ tên sinh viên..."
        searchAriaLabel="Tìm sinh viên"
        hasActiveFilters={hasFilters}
        onClearFilters={clearFilters}
        selects={[
          ...(admin
            ? [
                {
                  key: 'facultyId',
                  label: 'Tất cả Khoa',
                  value: facultyId,
                  options: options.faculties.map((f) => ({ value: f.id, label: f.name })),
                  onChange: (val: string) => setFilter('facultyId', val),
                  ariaLabel: 'Khoa',
                },
              ]
            : []),
          {
            key: 'classId',
            label: 'Tất cả lớp',
            value: classId,
            options: options.classes.map((c) => ({ value: c.id, label: c.code })),
            onChange: (val: string) => setFilter('classId', val),
            ariaLabel: 'Lớp',
          },
        ]}
      />

      <DataState
        loading={loading}
        loadingMessage="Đang tổng hợp báo cáo điểm rèn luyện…"
        error={loadError}
        onRetry={() => setRefresh((n) => n + 1)}
        isEmpty={!termId}
        emptyTitle="Chưa có kỳ đánh giá"
        emptyDescription="Vui lòng chọn kỳ đánh giá để xem báo cáo thống kê."
      >
        {data && (
          <div className="space-y-6">
            {/* 1. GRID 4 STAT CARDS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard
                label="Sinh viên trong danh sách"
                value={data.total}
                subtitle="Sĩ số theo snapshot kỳ"
                icon={Users}
              />
              <StatCard
                label="Đã công bố kết quả"
                value={data.totalEvaluated}
                subtitle="Đã có publication revision"
                icon={Award}
                highlight
              />
              <StatCard
                label="Chưa có kết quả"
                value={data.pendingStudents}
                subtitle="Đang chấm hoặc chờ duyệt"
                icon={Clock}
              />
              <StatCard
                label="Điểm trung bình"
                value={data.averageScore !== null && data.averageScore !== undefined ? data.averageScore : '—'}
                subtitle="Tính trên sinh viên có điểm"
                icon={GraduationCap}
              />
            </div>

            {/* 2. PHÂN BỐ XẾP LOẠI RÈN LUYỆN */}
            <StatusBreakdown
              title="Phân bố xếp loại rèn luyện toàn bộ danh sách"
              items={distributionItems}
              total={data.total}
            />

            {/* 3. TỔNG HỢP THEO KHOA (CHO ADMIN) */}
            {admin && facultyGroups.length > 0 && (
              <div className="space-y-3">
                <SectionHeader
                  title="Tổng hợp kết quả theo Khoa"
                  description="Bấm vào tên Khoa để lọc sinh viên"
                  count={facultyGroups.length}
                />
                <RankingTable
                  columns={facultySummaryColumns}
                  data={facultyGroups}
                  keyExtractor={(r: any) => r.id}
                  emptyMessage="Chưa có dữ liệu phân công Khoa cho kỳ này."
                />
              </div>
            )}

            {/* 4. TỔNG HỢP THEO LỚP */}
            {groups.length > 0 && (
              <div className="space-y-3">
                <SectionHeader
                  title="Tổng hợp kết quả theo lớp"
                  description="Bấm vào mã lớp để lọc danh sách chi tiết"
                  count={groups.length}
                />
                <RankingTable
                  columns={classSummaryColumns}
                  data={groups}
                  keyExtractor={(r: any) => r.id}
                  emptyMessage="Chưa có dữ liệu tổng hợp theo lớp."
                />
              </div>
            )}

            {/* 5. BẢNG CHI TIẾT SINH VIÊN */}
            <div className="space-y-3">
              <SectionHeader
                title="Danh sách kết quả chi tiết từng sinh viên"
                description={`Hiển thị trang ${page} / ${Math.max(1, Math.ceil(data.total / pageSize))}`}
                count={data.total}
              />

              {rows.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#6B6B6B] border border-[#E8E8EC] rounded-[12px] bg-[#FFFFFF]">
                  Không tìm thấy sinh viên nào phù hợp với bộ lọc hiện tại.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-[12px] border border-[#E8E8EC] bg-[#FFFFFF]">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-[#E8E8EC] bg-[#FAFAFA] text-[#6B6B6B] font-medium text-xs">
                        <th className="py-3 px-3.5">Sinh viên</th>
                        <th className="py-3 px-3.5">Lớp</th>
                        {admin && <th className="py-3 px-3.5">Khoa</th>}
                        <th className="py-3 px-3.5">Trạng thái phiếu</th>
                        <th className="py-3 px-3.5">Điểm công bố</th>
                        <th className="py-3 px-3.5">Xếp loại</th>
                        <th className="py-3 px-3.5 text-right">Phiên bản</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E8EC]">
                      {rows.map((r) => (
                        <tr key={r.studentId} className="hover:bg-[#FAFAFA] transition-colors">
                          <td className="py-2.5 px-3.5">
                            <Link
                              className="font-bold text-[#1D6FC2] hover:text-[#175A9E] hover:underline block"
                              to={
                                (admin ? '/admin/results/' : '/officer/students/') +
                                r.studentId +
                                (admin ? '' : '/assessment') +
                                '?termId=' +
                                termId
                              }
                            >
                              {r.student?.fullName}
                            </Link>
                            <span className="text-[11px] text-[#6B6B6B]">
                              {r.student?.studentCode}
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 text-[#0A0A0A]">{r.class?.code}</td>
                          {admin && (
                            <td className="py-2.5 px-3.5 text-[#6B6B6B]">{r.faculty?.name}</td>
                          )}
                          <td className="py-2.5 px-3.5">
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#FAFAFA] border border-[#E8E8EC] text-[#0A0A0A]">
                              {evaluationStateLabels[r.state] || r.state}
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 font-mono">
                            <strong className="text-sm font-bold text-[#0A0A0A]">
                              {r.officialScore !== null && r.officialScore !== undefined
                                ? `${r.officialScore} đ`
                                : '—'}
                            </strong>
                          </td>
                          <td className="py-2.5 px-3.5">
                            <span
                              className={`px-2 py-0.5 rounded-[4px] text-xs font-semibold ${
                                r.classification === 'XUAT_SAC'
                                  ? 'bg-[#ECFDF5] text-[#065F46]'
                                  : r.classification === 'TOT'
                                  ? 'bg-[#F0F6FC] text-[#12457A]'
                                  : r.classification === 'KHA'
                                  ? 'bg-[#F0F9FF] text-[#0369A1]'
                                  : r.classification === 'TRUNG_BINH'
                                  ? 'bg-[#FFFBEB] text-[#92400E]'
                                  : r.classification === 'YEU'
                                  ? 'bg-[#FEF2F2] text-[#991B1B]'
                                  : 'text-[#6B6B6B]'
                              }`}
                            >
                              {r.classification || 'Chưa công bố'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-mono text-xs text-[#6B6B6B]">
                            {r.publicationRevision ? `v${r.publicationRevision}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* PAGINATION */}
              <div className="flex items-center justify-between gap-3 pt-2 text-xs text-[#6B6B6B]">
                <span>
                  Hiển thị {rows.length} / {data.total} sinh viên
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setFilter('page', String(page - 1))}
                    className="px-3 py-1.5 rounded-[6px] border border-[#E8E8EC] bg-[#FFFFFF] hover:bg-[#FAFAFA] disabled:opacity-40 font-medium"
                  >
                    Trước
                  </button>
                  <span className="font-semibold text-[#0A0A0A]">
                    Trang {page} / {Math.max(1, Math.ceil(data.total / pageSize))}
                  </span>
                  <button
                    disabled={page * pageSize >= data.total}
                    onClick={() => setFilter('page', String(page + 1))}
                    className="px-3 py-1.5 rounded-[6px] border border-[#E8E8EC] bg-[#FFFFFF] hover:bg-[#FAFAFA] disabled:opacity-40 font-medium"
                  >
                    Tiếp
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </DataState>
    </div>
  );
};
