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
const quickFilters: Array<{ key: QuickFilter; label: string }> = [
  { key: 'all', label: 'Tất cả' },
  { key: 'action', label: 'Cần xử lý' },
  { key: 'returned', label: 'Phiếu bị trả' },
  { key: 'evidence', label: 'Minh chứng chờ Khoa' },
  { key: 'ready', label: 'Sẵn sàng gửi' },
];

const statusView = {
  NEEDS_ACTION: { label: 'Cần xử lý', className: 'border-red-200 bg-red-50 text-red-700' },
  WAITING: { label: 'Đang chờ', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  READY: { label: 'Sẵn sàng gửi', className: 'border-sky-200 bg-sky-50 text-sky-700' },
  COMPLETE: { label: 'Hoàn tất', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
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
  Object.entries(values).forEach(([key, value]) => { if (value) params.set(key, value); });
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
    sources.evidences.data?.items.forEach(item => {
      const id = item.student?.class?.id || item.student?.classId;
      if (id) result[id] = (result[id] || 0) + 1;
    });
    return result;
  }, [sources.evidences.data]);

  const studentClass = useMemo(
    () => new Map((sources.rows.data || []).map(row => [row.studentId, row.classId])),
    [sources.rows.data],
  );
  const appealsByClass = useMemo(() => {
    const result: Record<string, number> = {};
    sources.appeals.data?.items.forEach(appeal => {
      const id = studentClass.get(appeal.studentId);
      if (id) result[id] = (result[id] || 0) + 1;
    });
    return result;
  }, [sources.appeals.data, studentClass]);

  const classes = useMemo(
    () => aggregateClassWorkflow(sources.rows.data || [], humanReviewByClass, appealsByClass),
    [sources.rows.data, humanReviewByClass, appealsByClass],
  );
  const visibleClasses = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi');
    return classes.filter(cls => {
      if (normalized && !cls.code.toLocaleLowerCase('vi').includes(normalized)) return false;
      if (filter === 'action') return cls.status === 'NEEDS_ACTION';
      if (filter === 'returned') return cls.facultyReturned > 0;
      if (filter === 'evidence') return cls.humanReviewEvidences > 0;
      if (filter === 'ready') return cls.readyToSend > 0;
      return true;
    });
  }, [classes, filter, query]);
  const selectedClass = classes.find(cls => cls.id === classId);

  useEffect(() => {
    if (!classId || sources.rows.loading || !sources.rows.data || selectedClass) return;
    setParams(current => {
      const next = new URLSearchParams(current);
      next.delete('classId');
      return next;
    }, { replace: true });
  }, [classId, selectedClass, sources.rows.data, sources.rows.loading, setParams]);

  const setFilter = (nextFilter: QuickFilter) => setParams(current => {
    const next = new URLSearchParams(current);
    next.set('termId', termId);
    nextFilter === 'all' ? next.delete('filter') : next.set('filter', nextFilter);
    return next;
  });
  const setQuery = (value: string) => setParams(current => {
    const next = new URLSearchParams(current);
    next.set('termId', termId);
    value ? next.set('q', value) : next.delete('q');
    return next;
  });
  const openClass = (id: string) => setParams(current => {
    const next = new URLSearchParams(current);
    next.set('termId', termId);
    next.set('classId', id);
    return next;
  });
  const closeClass = () => setParams(current => {
    const next = new URLSearchParams(current);
    next.delete('classId');
    return next;
  });

  const loading = sources.workflow.loading || sources.rows.loading || sources.evidences.loading || sources.appeals.loading;
  const failure = sources.workflow.error || sources.rows.error;
  const queueWarning = sources.evidences.error || sources.appeals.error;
  const currentReturnTo = `/officer/evaluations?${params.toString()}`;

  return (
    <div className="space-y-6 pb-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#6B6B6B]">
            {user.faculty?.name || 'Khoa phụ trách'}
            {sources.workflow.data?.term && ` · ${sources.workflow.data.term.name}`}
          </p>
          <h1 className="mt-1 text-xl font-semibold font-heading sm:text-2xl">Xử lý đánh giá theo lớp</h1>
          <p className="mt-1 text-sm text-[#6B6B6B]">Tìm lớp cần ưu tiên, sau đó mở đúng danh sách công việc cần xử lý.</p>
        </div>
        <button
          type="button"
          onClick={() => void sources.refresh()}
          disabled={!termId || loading}
          className="inline-flex items-center gap-2 rounded-md border border-[#E8E8EC] bg-white px-3 py-2 text-sm font-medium hover:bg-[#FAFAFA] disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Làm mới
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
            <section aria-label="Việc cần xử lý toàn Khoa" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <StatCard label="Khoa đang chấm" value={counts.REVIEWING} subtitle="Phiếu chưa hoàn tất thẩm định" icon={FileCheck2} to={queryHref('/officer/students', { termId, state: 'REVIEWING' })} />
              <StatCard label="CTSV trả lại" value={counts.FACULTY_RETURNED} subtitle="Cần kiểm tra và hoàn thiện lại" icon={AlertTriangle} to={queryHref('/officer/students', { termId, state: 'FACULTY_RETURNED' })} />
              <StatCard label="Minh chứng chờ Khoa" value={sources.evidences.data?.total ?? '—'} subtitle="Chờ xác minh và ra quyết định" icon={ShieldCheck} to={queryHref('/officer/queue', { termId, status: 'NEEDS_HUMAN_REVIEW' })} />
              <StatCard label="Phúc khảo chờ xử lý" value={sources.appeals.data?.total ?? '—'} subtitle="Cần xem giải trình sinh viên" icon={MessageSquareWarning} to={queryHref('/officer/appeals', { termId, status: 'PENDING' })} />
            </section>

            {queueWarning && (
              <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Một phần số liệu minh chứng hoặc phúc khảo chưa tải được. Tiến độ phiếu vẫn chính xác; hãy thử làm mới để hoàn thiện số liệu ưu tiên.
              </div>
            )}

            <section className="overflow-hidden rounded-xl border border-[#E8E8EC] bg-white">
              <div className="space-y-3 border-b border-[#E8E8EC] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold font-heading">Tiến độ theo lớp</h2>
                    <p className="mt-1 text-xs text-[#6B6B6B]">KPI phía trên luôn tính cho toàn Khoa; tìm kiếm và bộ lọc chỉ áp dụng cho bảng này.</p>
                  </div>
                  <label className="relative min-w-[220px] flex-1 sm:max-w-xs">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B6B6B]" />
                    <span className="sr-only">Tìm lớp</span>
                    <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm mã lớp…" className="w-full rounded-md border border-[#E8E8EC] py-2 pl-9 pr-3 text-sm focus:border-[#1D6FC2] focus:outline-none focus:ring-2 focus:ring-[#1D6FC2]/15" />
                  </label>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Lọc nhanh lớp">
                  {quickFilters.map(item => (
                    <button key={item.key} type="button" aria-pressed={filter === item.key} onClick={() => setFilter(item.key)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${filter === item.key ? 'border-[#1D6FC2] bg-[#E1EDF9] text-[#175A9E]' : 'border-[#E8E8EC] bg-white text-[#6B6B6B] hover:border-[#C2DBF2]'}`}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {visibleClasses.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="border-b border-[#E8E8EC] bg-[#FAFAFA] text-xs text-[#6B6B6B]">
                      <tr><th className="px-4 py-3">Lớp</th><th className="px-4 py-3">Sĩ số kỳ</th><th className="px-4 py-3">Tiến độ xử lý</th><th className="px-4 py-3">Việc chưa hoàn tất</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3 text-right"><span className="sr-only">Thao tác</span></th></tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E8EC]">
                      {visibleClasses.map(cls => {
                        const state = statusView[cls.status];
                        return (
                          <tr key={cls.id} className="hover:bg-[#FAFAFA]">
                            <th scope="row" className="px-4 py-3 font-semibold">{cls.code}</th>
                            <td className="px-4 py-3 tabular-nums">{cls.total}</td>
                            <td className="px-4 py-3">
                              <div className="flex min-w-[220px] items-center gap-3">
                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#E8E8EC]"><div className="h-full rounded-full bg-[#1D6FC2]" style={{ width: `${cls.processedRate}%` }} /></div>
                                <span className="w-12 text-right text-xs font-semibold tabular-nums">{cls.processedRate.toLocaleString('vi-VN')}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3"><strong>{cls.openWork}</strong><span className="ml-1 text-xs text-[#6B6B6B]">việc</span></td>
                            <td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${state.className}`}>{state.label}</span></td>
                            <td className="px-4 py-3 text-right"><button type="button" onClick={() => openClass(cls.id)} className="inline-flex items-center gap-1 text-xs font-semibold text-[#1D6FC2] hover:underline">Xem chi tiết <ChevronRight className="h-3.5 w-3.5" /></button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-5 py-12 text-center"><Search className="mx-auto h-9 w-9 text-[#9C9C9C]" /><h3 className="mt-3 font-semibold">Không tìm thấy lớp phù hợp</h3><p className="mt-1 text-sm text-[#6B6B6B]">Hãy đổi từ khóa hoặc chọn bộ lọc khác.</p><button type="button" onClick={() => { setQuery(''); setFilter('all'); }} className="mt-4 rounded-md border border-[#C2DBF2] bg-[#E1EDF9] px-4 py-2 text-xs font-semibold text-[#175A9E]">Xóa bộ lọc</button></div>
              )}
            </section>
          </>
        )}
      </DataState>

      {selectedClass && <ClassPanel key={`${termId}:${selectedClass.id}`} cls={selectedClass} termId={termId} returnTo={currentReturnTo} onClose={closeClass} />}
    </div>
  );
};

function ClassPanel({ cls, termId, returnTo, onClose }: { cls: ClassWorkflowSummary; termId: string; returnTo: string; onClose: () => void }) {
  const [summary, setSummary] = useState<EvidenceQueueSummary>(panelDefault);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState('');
  const request = useRef(0);
  const panelRef = useRef<HTMLElement>(null);
  const load = async () => {
    const generation = ++request.current;
    setLoading(true); setFailure('');
    try {
      const [human, supplement, processing] = await Promise.all([
        apiClient.getReviewQueuePage({ termId, classId: cls.id, status: 'NEEDS_HUMAN_REVIEW', page: 1, pageSize: 1 }),
        apiClient.getReviewQueuePage({ termId, classId: cls.id, status: 'NEEDS_SUPPLEMENT', page: 1, pageSize: 1 }),
        apiClient.getReviewQueuePage({ termId, classId: cls.id, status: 'PROCESSING', page: 1, pageSize: 1 }),
      ]);
      if (generation !== request.current) return;
      setSummary({ ...panelDefault, NEEDS_HUMAN_REVIEW: human.total, NEEDS_SUPPLEMENT: supplement.total, PROCESSING: processing.total });
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
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', keyboard);
    return () => { request.current += 1; window.removeEventListener('keydown', keyboard); previousFocus?.focus(); };
  }, []);

  const link = (path: string, values: Record<string, string | undefined>) => queryHref(path, { termId, classId: cls.id, returnTo, ...values });
  const sections = [
    { title: 'Cần Khoa xử lý', items: [
      { label: 'Phiếu đang chấm', value: cls.reviewing, to: link('/officer/students', { state: 'REVIEWING' }) },
      { label: 'Phiếu CTSV trả lại', value: cls.facultyReturned, to: link('/officer/students', { state: 'FACULTY_RETURNED' }) },
      { label: 'Minh chứng chờ xác minh', value: loading || failure ? '—' : summary.NEEDS_HUMAN_REVIEW, to: link('/officer/queue', { status: 'NEEDS_HUMAN_REVIEW' }) },
      { label: 'Phúc khảo chờ xử lý', value: cls.pendingAppeals, to: link('/officer/appeals', { status: 'PENDING' }) },
    ] },
    { title: 'Đang chờ', items: [
      { label: 'Chờ sinh viên sửa phiếu', value: cls.studentReturned, to: link('/officer/students', { state: 'STUDENT_RETURNED' }) },
      { label: 'Chờ sinh viên bổ sung minh chứng', value: loading || failure ? '—' : summary.NEEDS_SUPPLEMENT, to: link('/officer/queue', { status: 'NEEDS_SUPPLEMENT' }) },
      { label: 'Minh chứng đang được hệ thống xử lý', value: loading || failure ? '—' : summary.PROCESSING, to: link('/officer/queue', { status: 'PROCESSING' }) },
    ] },
    { title: 'Sắp hoàn tất', items: [
      { label: 'Sẵn sàng gửi CTSV', value: cls.readyToSend, to: link('/officer/students', { state: 'READY' }) },
      { label: 'Chờ CTSV công bố', value: cls.waitingPublication, to: link('/officer/students', { state: 'SENT' }) },
      { label: 'Đã công bố', value: cls.published, to: link('/officer/students', { state: 'PUBLISHED' }) },
      { label: 'Ghi nhận không nộp', value: cls.recorded, to: link('/officer/students', { state: 'NOT_SUBMITTED_RECORDED' }) },
    ] },
  ];
  const priorityLink = summary.NEEDS_HUMAN_REVIEW > 0
    ? { label: 'Xem minh chứng chờ xác minh', to: link('/officer/queue', { status: 'NEEDS_HUMAN_REVIEW' }) }
    : cls.facultyReturned > 0
    ? { label: 'Xem phiếu CTSV trả lại', to: link('/officer/students', { state: 'FACULTY_RETURNED' }) }
    : cls.pendingAppeals > 0
    ? { label: 'Xem phúc khảo chờ xử lý', to: link('/officer/appeals', { status: 'PENDING' }) }
    : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" role="dialog" aria-modal="true" aria-label={`Chi tiết lớp ${cls.code}`} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <aside ref={panelRef} className="flex h-full w-full flex-col bg-white shadow-2xl sm:max-w-lg">
        <header className="shrink-0 border-b border-[#E8E8EC] p-5">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-[#6B6B6B]">Chi tiết tiến độ lớp</p><h2 className="mt-1 text-xl font-semibold font-heading">{cls.code}</h2><p className="mt-1 text-sm text-[#6B6B6B]">{cls.total} sinh viên trong danh sách kỳ</p></div><button autoFocus type="button" onClick={onClose} aria-label="Đóng chi tiết lớp" className="rounded-md border border-[#E8E8EC] p-2 hover:bg-[#FAFAFA]"><X className="h-4 w-4" /></button></div>
          <div className="mt-4 flex items-center gap-3"><div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#E8E8EC]"><div className="h-full rounded-full bg-[#1D6FC2]" style={{ width: `${cls.processedRate}%` }} /></div><strong className="text-sm tabular-nums">{cls.processedRate.toLocaleString('vi-VN')}%</strong></div>
          <p className="mt-2 text-xs text-[#6B6B6B]">{cls.processed}/{cls.total} hồ sơ đã hoàn tất bước xử lý tại Khoa.</p>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {failure && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">Không tải đủ thống kê minh chứng: {failure}<button type="button" onClick={() => void load()} className="ml-2 font-semibold underline">Thử lại</button></div>}
          {loading && <p role="status" className="mb-4 inline-flex items-center gap-2 text-sm text-[#6B6B6B]"><RefreshCw className="h-4 w-4 animate-spin" /> Đang kiểm tra trạng thái minh chứng…</p>}
          <div className="space-y-6">{sections.map(section => <section key={section.title}><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6B6B6B]">{section.title}</h3><div className="divide-y divide-[#E8E8EC] rounded-lg border border-[#E8E8EC]">{section.items.map(item => <Link key={item.label} to={item.to} className="flex items-center justify-between gap-3 px-3 py-3 text-sm hover:bg-[#FAFAFA]"><span>{item.label}</span><span className="inline-flex items-center gap-2"><strong className="tabular-nums">{item.value}</strong><ChevronRight className="h-3.5 w-3.5 text-[#6B6B6B]" /></span></Link>)}</div></section>)}</div>
        </div>
        <footer className="shrink-0 space-y-2 border-t border-[#E8E8EC] bg-white p-4">
          <Link to={link('/officer/students', {})} className="flex w-full items-center justify-center rounded-md bg-[#1D6FC2] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#175A9E]">Mở phiếu của lớp</Link>
          {priorityLink && <Link to={priorityLink.to} className="flex w-full items-center justify-center rounded-md border border-[#C2DBF2] px-4 py-2.5 text-sm font-semibold text-[#175A9E] hover:bg-[#F0F6FC]">{priorityLink.label}</Link>}
        </footer>
      </aside>
    </div>
  );
}
