import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileCheck2,
  MessageSquareWarning,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
  Layers,
  ArrowRight,
  Check,
  Inbox,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFacultyEvaluationWorkspace } from '../../hooks/useFacultyEvaluationWorkspace';
import { apiClient } from '../../lib/apiClient';
import {
  aggregateClassWorkflow,
  countFacultyStates,
  type ClassWorkflowSummary,
  type EvidenceQueueSummary,
} from '../../lib/facultyAnalytics';
import { DataState, StatCard } from '../../components/shared';
import { errorMessage } from '../../components/EvaluationBoard';

type QuickFilter = 'all' | 'action' | 'returned' | 'evidence' | 'ready';

const statusConfig = {
  NEEDS_ACTION: {
    label: 'Cần xử lý',
    badgeClass: 'border-rose-200 bg-rose-50 text-rose-700',
    dotClass: 'bg-rose-500',
  },
  WAITING: {
    label: 'Đang chờ',
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
    dotClass: 'bg-amber-500',
  },
  READY: {
    label: 'Sẵn sàng gửi',
    badgeClass: 'border-sky-200 bg-sky-50 text-sky-700',
    dotClass: 'bg-sky-500',
  },
  COMPLETE: {
    label: 'Hoàn tất',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    dotClass: 'bg-emerald-500',
  },
} as const;

const panelDefault: EvidenceQueueSummary = {
  NEEDS_HUMAN_REVIEW: 0,
  NEEDS_SUPPLEMENT: 0,
  PROCESSING: 0,
  APPROVED: 0,
  REJECTED: 0,
  decided: 0,
};

function queryHref(path: string, values: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return `${path}?${params.toString()}`;
}

export const EvaluationsByClass: React.FC = () => {
  const { user, activeTerm } = useAuth();
  const [params, setParams] = useSearchParams();
  const termId = params.get('termId') || activeTerm.id;
  const classId = params.get('classId') || '';
  const filter = (params.get('filter') || 'all') as QuickFilter;
  const query = params.get('q') || '';
  const sources = useFacultyEvaluationWorkspace(termId, user.id);
  const counts = useMemo(() => countFacultyStates(sources.rows.data || []), [sources.rows.data]);

  const humanReviewByClass = useMemo(() => {
    const result: Record<string, number> = {};
    sources.evidences.data?.items.forEach((item) => {
      const id = item.student?.class?.id || item.student?.classId;
      if (id) result[id] = (result[id] || 0) + 1;
    });
    return result;
  }, [sources.evidences.data]);

  const studentClass = useMemo(
    () => new Map((sources.rows.data || []).map((row) => [row.studentId, row.classId])),
    [sources.rows.data],
  );
  const appealsByClass = useMemo(() => {
    const result: Record<string, number> = {};
    sources.appeals.data?.items.forEach((appeal) => {
      const id = studentClass.get(appeal.studentId);
      if (id) result[id] = (result[id] || 0) + 1;
    });
    return result;
  }, [sources.appeals.data, studentClass]);

  const classes = useMemo(
    () => aggregateClassWorkflow(sources.rows.data || [], humanReviewByClass, appealsByClass),
    [sources.rows.data, humanReviewByClass, appealsByClass],
  );

  // Dynamic filter options with counts
  const quickFilters = useMemo(
    () => [
      { key: 'all' as QuickFilter, label: 'Tất cả', count: classes.length },
      {
        key: 'action' as QuickFilter,
        label: 'Cần xử lý',
        count: classes.filter((c) => c.status === 'NEEDS_ACTION').length,
        urgent: classes.some((c) => c.status === 'NEEDS_ACTION'),
      },
      {
        key: 'returned' as QuickFilter,
        label: 'CTSV trả lại',
        count: classes.filter((c) => c.facultyReturned > 0).length,
        urgent: classes.some((c) => c.facultyReturned > 0),
      },
      {
        key: 'evidence' as QuickFilter,
        label: 'Minh chứng chờ Khoa',
        count: classes.filter((c) => c.humanReviewEvidences > 0).length,
      },
      {
        key: 'ready' as QuickFilter,
        label: 'Sẵn sàng gửi',
        count: classes.filter((c) => c.readyToSend > 0).length,
      },
    ],
    [classes],
  );

  const visibleClasses = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi');
    return classes.filter((cls) => {
      if (normalized && !cls.code.toLocaleLowerCase('vi').includes(normalized)) return false;
      if (filter === 'action') return cls.status === 'NEEDS_ACTION';
      if (filter === 'returned') return cls.facultyReturned > 0;
      if (filter === 'evidence') return cls.humanReviewEvidences > 0;
      if (filter === 'ready') return cls.readyToSend > 0;
      return true;
    });
  }, [classes, filter, query]);

  const selectedClass = classes.find((cls) => cls.id === classId);

  useEffect(() => {
    if (!classId || sources.rows.loading || !sources.rows.data || selectedClass) return;
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete('classId');
        return next;
      },
      { replace: true },
    );
  }, [classId, selectedClass, sources.rows.data, sources.rows.loading, setParams]);

  const setFilter = (nextFilter: QuickFilter) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set('termId', termId);
      nextFilter === 'all' ? next.delete('filter') : next.set('filter', nextFilter);
      return next;
    });

  const setQuery = (value: string) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set('termId', termId);
      value ? next.set('q', value) : next.delete('q');
      return next;
    });

  const openClass = (id: string) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set('termId', termId);
      next.set('classId', id);
      return next;
    });

  const closeClass = () =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('classId');
      return next;
    });

  const loading =
    sources.workflow.loading ||
    sources.rows.loading ||
    sources.evidences.loading ||
    sources.appeals.loading;
  const failure = sources.workflow.error || sources.rows.error;
  const queueWarning = sources.evidences.error || sources.appeals.error;
  const currentReturnTo = `/officer/evaluations?${params.toString()}`;

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* 1. PAGE HEADER */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#64748B]">
            <span>{user.faculty?.name || 'Khoa phụ trách'}</span>
            {sources.workflow.data?.term && (
              <>
                <span>•</span>
                <span className="text-[#0F172A]">{sources.workflow.data.term.name}</span>
              </>
            )}
          </div>
          <h1 className="mt-1 text-xl font-bold font-heading sm:text-2xl text-[#0F172A] tracking-tight">
            Xử lý đánh giá theo lớp
          </h1>
          <p className="mt-1 text-sm text-[#64748B]">
            Theo dõi tiến độ, ưu tiên giải quyết các lớp còn tồn đọng và quản lý thẩm định hồ sơ theo lớp.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void sources.refresh()}
          disabled={!termId || loading}
          className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-3.5 py-2 text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC] disabled:opacity-50 transition-colors shadow-2xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-[#1D6FC2]' : ''}`} />
          Làm mới
        </button>
      </header>

      <DataState
        loading={loading}
        loadingMessage="Đang tổng hợp tiến độ các lớp…"
        error={failure}
        onRetry={() => void sources.refresh()}
        isEmpty={!termId}
        emptyTitle="Chưa có kỳ đánh giá"
        emptyDescription="Vui lòng liên hệ Phòng CTSV để kiểm tra kỳ và danh sách sinh viên của Khoa."
      >
        {sources.workflow.data && sources.rows.data && (
          <>
            {/* 2. 4 EXECUTIVE STATCARDS */}
            <section aria-label="Việc cần xử lý toàn Khoa" className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
              <StatCard
                label="Khoa đang đánh giá"
                value={counts.REVIEWING}
                subtitle="Chưa hoàn tất thẩm định"
                icon={FileCheck2}
                variant="warning"
                to={queryHref('/officer/students', { termId, state: 'REVIEWING' })}
              />
              <StatCard
                label="CTSV trả lại"
                value={counts.FACULTY_RETURNED}
                subtitle="Cần kiểm tra và sửa lại"
                icon={AlertTriangle}
                variant="danger"
                to={queryHref('/officer/students', { termId, state: 'FACULTY_RETURNED' })}
              />
              <StatCard
                label="Minh chứng chờ Khoa"
                value={sources.evidences.data?.total ?? '—'}
                subtitle="Chờ xác minh & ra quyết định"
                icon={ShieldCheck}
                variant="info"
                to={queryHref('/officer/queue', { termId, status: 'NEEDS_HUMAN_REVIEW' })}
              />
              <StatCard
                label="Phúc khảo chờ xử lý"
                value={sources.appeals.data?.total ?? '—'}
                subtitle="Cần xem giải trình sinh viên"
                icon={MessageSquareWarning}
                variant="primary"
                to={queryHref('/officer/appeals', { termId, status: 'PENDING' })}
              />
            </section>

            {queueWarning && (
              <div
                role="status"
                className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900 flex items-start gap-2.5"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <p>
                  Một phần số liệu minh chứng hoặc phúc khảo chưa tải đủ. Tiến độ đánh giá của các lớp vẫn chính xác; hãy thử làm mới để đồng bộ dữ liệu ưu tiên.
                </p>
              </div>
            )}

            {/* 3. CLASS PROGRESS TABLE & TOOLBAR */}
            <section className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-xs">
              {/* Toolbar */}
              <div className="space-y-3.5 border-b border-[#E2E8F0] p-4 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-bold font-heading text-sm sm:text-base text-[#0F172A] flex items-center gap-2">
                      <Layers className="h-4 w-4 text-[#1D6FC2]" />
                      Bảng tiến độ theo lớp
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 border border-slate-200">
                        {visibleClasses.length}/{classes.length} lớp
                      </span>
                    </h2>
                    <p className="mt-0.5 text-xs text-[#64748B]">
                      KPI phía trên tính toàn Khoa; tìm kiếm và lọc dưới đây áp dụng trực tiếp cho danh sách lớp.
                    </p>
                  </div>

                  {/* Search box */}
                  <label className="relative min-w-[220px] flex-1 sm:max-w-xs">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94A3B8]" />
                    <span className="sr-only">Tìm lớp</span>
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Tìm theo mã lớp (VD: 21TCLC)…"
                      className="w-full rounded-lg border border-[#E2E8F0] bg-white py-2 pl-9 pr-8 text-xs text-[#0F172A] placeholder-[#94A3B8] transition-colors focus:border-[#1D6FC2] focus:outline-none focus:ring-2 focus:ring-[#1D6FC2]/15"
                    />
                    {query && (
                      <button
                        type="button"
                        onClick={() => setQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A]"
                        aria-label="Xóa tìm kiếm"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </label>
                </div>

                {/* Quick filter pills */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1" aria-label="Lọc nhanh lớp">
                  {quickFilters.map((item) => {
                    const active = filter === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setFilter(item.key)}
                        className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                          active
                            ? 'bg-[#1D6FC2] text-white shadow-2xs'
                            : 'border border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC] hover:border-[#CBD5E1]'
                        }`}
                      >
                        <span>{item.label}</span>
                        <span
                          className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                            active
                              ? 'bg-white/20 text-white'
                              : item.urgent && item.count > 0
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {item.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* High-density Data Table */}
              {visibleClasses.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-xs">
                    <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-bold uppercase tracking-wider text-[#475569]">
                      <tr>
                        <th scope="col" className="px-4 py-3">Lớp</th>
                        <th scope="col" className="px-4 py-3">Sĩ số kỳ</th>
                        <th scope="col" className="px-4 py-3 min-w-[220px]">Tiến độ xử lý tại Khoa</th>
                        <th scope="col" className="px-4 py-3">Tồn đọng</th>
                        <th scope="col" className="px-4 py-3">Trạng thái</th>
                        <th scope="col" className="px-4 py-3 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0] bg-white">
                      {visibleClasses.map((cls) => {
                        const state = statusConfig[cls.status];
                        const isComplete = cls.processedRate === 100;

                        return (
                          <tr
                            key={cls.id}
                            className="hover:bg-[#F8FAFC]/80 transition-colors group"
                          >
                            {/* Class Code */}
                            <th scope="row" className="px-4 py-3.5">
                              <button
                                type="button"
                                onClick={() => openClass(cls.id)}
                                className="font-bold text-sm text-[#0F172A] group-hover:text-[#1D6FC2] hover:underline text-left"
                              >
                                {cls.code}
                              </button>
                            </th>

                            {/* Total Students */}
                            <td className="px-4 py-3.5 tabular-nums">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]">
                                {cls.total} SV
                              </span>
                            </td>

                            {/* Processed Rate */}
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#F1F5F9] border border-[#E2E8F0]">
                                  <div
                                    className={`h-full rounded-full transition-all duration-300 ${
                                      isComplete ? 'bg-[#059669]' : 'bg-[#1D6FC2]'
                                    }`}
                                    style={{ width: `${cls.processedRate}%` }}
                                  />
                                </div>
                                <span
                                  className={`w-12 text-right text-xs font-bold tabular-nums ${
                                    isComplete ? 'text-[#059669]' : 'text-[#0F172A]'
                                  }`}
                                >
                                  {cls.processedRate.toLocaleString('vi-VN')}%
                                </span>
                              </div>
                              <span className="text-[10px] text-[#64748B] mt-0.5 block">
                                {cls.processed}/{cls.total} hồ sơ đã xong phần Khoa
                              </span>
                            </td>

                            {/* Open Work */}
                            <td className="px-4 py-3.5">
                              {cls.openWork > 0 ? (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                                  <strong>{cls.openWork}</strong> việc
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs text-[#64748B] font-medium">
                                  <Check className="h-3 w-3 text-emerald-600" /> 0 việc tồn
                                </span>
                              )}
                            </td>

                            {/* Status */}
                            <td className="px-4 py-3.5">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${state.badgeClass}`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${state.dotClass}`} />
                                {state.label}
                              </span>
                            </td>

                            {/* Action */}
                            <td className="px-4 py-3.5 text-right">
                              <button
                                type="button"
                                onClick={() => openClass(cls.id)}
                                className="inline-flex items-center gap-1 rounded-lg border border-[#C2DBF2] bg-[#F0F6FC] px-3 py-1.5 text-xs font-semibold text-[#1D6FC2] hover:bg-[#E1EDF9] transition-colors"
                              >
                                Chi tiết
                                <ChevronRight className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-5 py-14 text-center">
                  <Inbox className="mx-auto h-10 w-10 text-[#94A3B8]" />
                  <h3 className="mt-3 font-bold font-heading text-sm text-[#0F172A]">
                    Không tìm thấy lớp phù hợp
                  </h3>
                  <p className="mt-1 text-xs text-[#64748B]">
                    Hãy thử đổi từ khóa tìm kiếm hoặc chọn bộ lọc trạng thái khác.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      setFilter('all');
                    }}
                    className="mt-4 rounded-lg border border-[#C2DBF2] bg-[#F0F6FC] px-4 py-2 text-xs font-semibold text-[#1D6FC2] hover:bg-[#E1EDF9] transition-colors"
                  >
                    Xóa bộ lọc
                  </button>
                </div>
              )}
            </section>
          </>
        )}
      </DataState>

      {/* 4. DRAWER CHI TIẾT LỚP */}
      {selectedClass && (
        <ClassPanel
          key={`${termId}:${selectedClass.id}`}
          cls={selectedClass}
          termId={termId}
          returnTo={currentReturnTo}
          onClose={closeClass}
        />
      )}
    </div>
  );
};

function ClassPanel({
  cls,
  termId,
  returnTo,
  onClose,
}: {
  cls: ClassWorkflowSummary;
  termId: string;
  returnTo: string;
  onClose: () => void;
}) {
  const [summary, setSummary] = useState<EvidenceQueueSummary>(panelDefault);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState('');
  const request = useRef(0);
  const panelRef = useRef<HTMLElement>(null);

  const load = async () => {
    const generation = ++request.current;
    setLoading(true);
    setFailure('');
    try {
      const [human, supplement, processing] = await Promise.all([
        apiClient.getReviewQueuePage({
          termId,
          classId: cls.id,
          status: 'NEEDS_HUMAN_REVIEW',
          page: 1,
          pageSize: 1,
        }),
        apiClient.getReviewQueuePage({
          termId,
          classId: cls.id,
          status: 'NEEDS_SUPPLEMENT',
          page: 1,
          pageSize: 1,
        }),
        apiClient.getReviewQueuePage({
          termId,
          classId: cls.id,
          status: 'PROCESSING',
          page: 1,
          pageSize: 1,
        }),
      ]);
      if (generation !== request.current) return;
      setSummary({
        ...panelDefault,
        NEEDS_HUMAN_REVIEW: human.total,
        NEEDS_SUPPLEMENT: supplement.total,
        PROCESSING: processing.total,
      });
    } catch (error) {
      if (generation === request.current) setFailure(errorMessage(error));
    } finally {
      if (generation === request.current) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const previousFocus = document.activeElement as HTMLElement | null;
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = [
        ...panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ];
      if (!focusable.length) return;
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', keyboard);
    return () => {
      request.current += 1;
      window.removeEventListener('keydown', keyboard);
      previousFocus?.focus();
    };
  }, []);

  const link = (path: string, values: Record<string, string | undefined>) =>
    queryHref(path, { termId, classId: cls.id, returnTo, ...values });

  interface PanelItem {
    label: string;
    value: string | number;
    to: string;
    urgent?: boolean;
  }

  const sections: Array<{
    title: string;
    accentColor: string;
    badge?: string;
    items: PanelItem[];
  }> = [
    {
      title: 'Cần Khoa xử lý',
      accentColor: 'border-l-4 border-l-rose-500',
      badge: 'Ưu tiên',
      items: [
        {
          label: 'Đang đánh giá',
          value: cls.reviewing,
          to: link('/officer/students', { state: 'REVIEWING' }),
          urgent: cls.reviewing > 0,
        },
        {
          label: 'Kết quả CTSV trả lại',
          value: cls.facultyReturned,
          to: link('/officer/students', { state: 'FACULTY_RETURNED' }),
          urgent: cls.facultyReturned > 0,
        },
        {
          label: 'Minh chứng chờ xác minh',
          value: loading || failure ? '—' : summary.NEEDS_HUMAN_REVIEW,
          to: link('/officer/queue', { status: 'NEEDS_HUMAN_REVIEW' }),
          urgent: summary.NEEDS_HUMAN_REVIEW > 0,
        },
        {
          label: 'Phúc khảo chờ xử lý',
          value: cls.pendingAppeals,
          to: link('/officer/appeals', { status: 'PENDING' }),
          urgent: cls.pendingAppeals > 0,
        },
      ],
    },
    {
      title: 'Đang chờ',
      accentColor: 'border-l-4 border-l-amber-500',
      items: [
        {
          label: 'Chờ sinh viên chỉnh sửa',
          value: cls.studentReturned,
          to: link('/officer/students', { state: 'STUDENT_RETURNED' }),
        },
        {
          label: 'Chờ sinh viên bổ sung minh chứng',
          value: loading || failure ? '—' : summary.NEEDS_SUPPLEMENT,
          to: link('/officer/queue', { status: 'NEEDS_SUPPLEMENT' }),
        },
        {
          label: 'Minh chứng đang xử lý tự động',
          value: loading || failure ? '—' : summary.PROCESSING,
          to: link('/officer/queue', { status: 'PROCESSING' }),
        },
      ],
    },
    {
      title: 'Sắp hoàn tất',
      accentColor: 'border-l-4 border-l-emerald-500',
      items: [
        {
          label: 'Sẵn sàng gửi CTSV',
          value: cls.readyToSend,
          to: link('/officer/students', { state: 'READY' }),
        },
        {
          label: 'Chờ CTSV công bố',
          value: cls.waitingPublication,
          to: link('/officer/students', { state: 'SENT' }),
        },
        {
          label: 'Đã công bố kết quả',
          value: cls.published,
          to: link('/officer/students', { state: 'PUBLISHED' }),
        },
        {
          label: 'Ghi nhận không nộp',
          value: cls.recorded,
          to: link('/officer/students', { state: 'NOT_SUBMITTED_RECORDED' }),
        },
      ],
    },
  ];

  const priorityLink =
    summary.NEEDS_HUMAN_REVIEW > 0
      ? {
          label: `Xác minh ${summary.NEEDS_HUMAN_REVIEW} minh chứng tồn đọng`,
          to: link('/officer/queue', { status: 'NEEDS_HUMAN_REVIEW' }),
        }
      : cls.facultyReturned > 0
      ? {
          label: `Hoàn thiện ${cls.facultyReturned} phiếu CTSV trả lại`,
          to: link('/officer/students', { state: 'FACULTY_RETURNED' }),
        }
      : cls.pendingAppeals > 0
      ? {
          label: `Giải quyết ${cls.pendingAppeals} phúc khảo chờ`,
          to: link('/officer/appeals', { status: 'PENDING' }),
        }
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-2xs transition-opacity duration-200"
      role="dialog"
      aria-modal="true"
      aria-label={`Chi tiết lớp ${cls.code}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        ref={panelRef}
        className="flex h-full w-full flex-col bg-white shadow-2xl border-l border-[#E2E8F0] sm:max-w-lg animate-in slide-in-from-right duration-200"
      >
        {/* HEADER CỐ ĐỊNH */}
        <header className="shrink-0 border-b border-[#E2E8F0] p-5 bg-[#F8FAFC]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Chi tiết tiến độ lớp
              </span>
              <h2 className="mt-0.5 text-2xl font-bold font-heading text-[#0F172A] tracking-tight">
                {cls.code}
              </h2>
              <p className="mt-1 text-xs text-[#64748B]">
                Sĩ số: <strong className="text-[#0F172A]">{cls.total} sinh viên</strong> trong danh sách kỳ này
              </p>
            </div>
            <button
              autoFocus
              type="button"
              onClick={onClose}
              aria-label="Đóng chi tiết lớp"
              className="rounded-lg border border-[#E2E8F0] bg-white p-2 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors shadow-2xs"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="mt-4 rounded-xl border border-[#E2E8F0] bg-white p-3 shadow-2xs">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-[#0F172A]">Tiến độ xử lý tại Khoa:</span>
              <strong className="text-[#1D6FC2] font-bold tabular-nums">
                {cls.processed}/{cls.total} hồ sơ ({cls.processedRate.toLocaleString('vi-VN')}%)
              </strong>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#F1F5F9] border border-[#E2E8F0]">
              <div
                className="h-full rounded-full bg-[#1D6FC2] transition-all duration-300"
                style={{ width: `${cls.processedRate}%` }}
              />
            </div>
          </div>
        </header>

        {/* CONTENT CUỘN ĐỘC LẬP */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5 space-y-5">
          {failure && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 flex items-start gap-2"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <span>Không tải đủ thống kê minh chứng: {failure}</span>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="ml-2 font-bold underline"
                >
                  Thử lại
                </button>
              </div>
            </div>
          )}

          {loading && (
            <p
              role="status"
              className="inline-flex items-center gap-2 text-xs font-medium text-[#64748B]"
            >
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#1D6FC2]" /> Đang kiểm tra trạng thái minh chứng…
            </p>
          )}

          {/* 3 NHÓM THỐNG KÊ CHI TIẾT */}
          {sections.map((section) => (
            <section key={section.title} className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#475569]">
                  {section.title}
                </h3>
                {section.badge && (
                  <span className="rounded bg-rose-100 px-1.5 py-0.2 text-[10px] font-bold text-rose-700">
                    {section.badge}
                  </span>
                )}
              </div>

              <div
                className={`overflow-hidden rounded-xl border border-[#E2E8F0] bg-white divide-y divide-[#E2E8F0] shadow-2xs ${section.accentColor}`}
              >
                {section.items.map((item) => (
                  <Link
                    key={item.label}
                    to={item.to}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs hover:bg-[#F8FAFC] transition-colors group"
                  >
                    <span className="text-[#334155] font-medium group-hover:text-[#1D6FC2] transition-colors">
                      {item.label}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <strong
                        className={`tabular-nums text-xs px-2 py-0.5 rounded-full ${
                          item.urgent
                            ? 'bg-rose-50 text-rose-700 border border-rose-200 font-bold'
                            : 'bg-slate-100 text-[#0F172A] font-semibold'
                        }`}
                      >
                        {item.value}
                      </strong>
                      <ChevronRight className="h-3.5 w-3.5 text-[#94A3B8] group-hover:text-[#1D6FC2] transition-colors" />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* FOOTER CỐ ĐỊNH */}
        <footer className="shrink-0 space-y-2 border-t border-[#E2E8F0] bg-[#F8FAFC] p-4">
          <Link
            to={link('/officer/students', {})}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#1D6FC2] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#175A9E] transition-colors shadow-2xs"
          >
            Mở danh sách đánh giá của lớp <ArrowRight className="h-3.5 w-3.5" />
          </Link>

          {priorityLink && (
            <Link
              to={priorityLink.to}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#C2DBF2] bg-white px-4 py-2 text-xs font-bold text-[#1D6FC2] hover:bg-[#F0F6FC] transition-colors"
            >
              <AlertTriangle className="h-3.5 w-3.5 text-[#D97706]" />
              {priorityLink.label}
            </Link>
          )}
        </footer>
      </aside>
    </div>
  );
}
