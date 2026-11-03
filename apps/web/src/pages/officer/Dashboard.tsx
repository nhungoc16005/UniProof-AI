import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Users,
  FileClock,
  CheckCircle2,
  Award,
  FileText,
  Clock,
  RefreshCw,
  AlertTriangle,
  MessageSquareWarning,
  Lock,
  LayoutDashboard,
  TableProperties,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFacultyDashboard } from '../../hooks/useFacultyDashboard';
import { ActionQueue, DataState, DeadlineCard, StatCard } from '../../components/shared';
import type { ActionQueueItem } from '../../components/shared/ActionQueue';
import {
  FacultyStateChart,
  FacultyClassChart,
  FacultyEvidenceDonut,
  facultyListHref,
} from '../../components/officer/FacultyCharts';
import { FacultyResultsCard } from '../../components/officer/FacultyResultsCard';
import { FacultyStudentLookup } from '../../components/officer/FacultyStudentLookup';
import { aggregateFacultyClasses, countFacultyStates, percentage } from '../../lib/facultyAnalytics';

const card = 'rounded-[12px] border border-[#E8E8EC] bg-white p-4 sm:p-5 shadow-sm';

function SourceState({
  loading,
  error,
  retry,
  children,
}: {
  loading: boolean;
  error?: string;
  retry: () => unknown;
  children: React.ReactNode;
}) {
  return (
    <DataState
      loading={loading}
      loadingMessage="Đang tổng hợp dữ liệu Khoa…"
      error={error}
      onRetry={() => void retry()}
      skeletonRows={4}
    >
      {children}
    </DataState>
  );
}

export const OfficerDashboard: React.FC = () => {
  const { user, activeTerm } = useAuth();
  const [params, setParams] = useSearchParams();
  const termId = params.get('termId') || activeTerm.id;
  const sources = useFacultyDashboard(termId, user.id);
  const { workflow, rows, kpi, report } = sources;

  const term = workflow.data?.term;
  const summary = workflow.data?.summary;
  const total = workflow.data?.total ?? 0;
  const legacy = Boolean(term && !term.workflowEnabled);
  const isClosed = term?.status === 'CLOSED';
  const counts = useMemo(() => countFacultyStates(rows.data || []), [rows.data]);
  const classes = useMemo(() => aggregateFacultyClasses(rows.data || []), [rows.data]);
  const rowReady = Boolean(rows.data);

  // View mode switcher: 'overview' vs 'lookup'
  const initialView = params.get('view') === 'lookup' || window.location.hash === '#tra-cuu' ? 'lookup' : 'overview';
  const [viewMode, setViewMode] = useState<'overview' | 'lookup'>(initialView);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  // Handle URL hashes and query param changes
  useEffect(() => {
    const hash = window.location.hash;
    const view = params.get('view');
    if (view === 'lookup' || hash === '#tra-cuu') {
      setViewMode('lookup');
    } else if (view === 'overview') {
      setViewMode('overview');
    }
  }, [params]);

  const handleViewChange = (mode: 'overview' | 'lookup', classId?: string) => {
    setViewMode(mode);
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('view', mode);
      if (classId) next.set('classId', classId);
      return next;
    });
  };

  const pastSubmission = Boolean(term?.submissionDeadline && now > Date.parse(term.submissionDeadline));

  const actions = useMemo<ActionQueueItem[]>(() => {
    if (!term || legacy || !summary) return [];
    const items: ActionQueueItem[] = [];
    if (rowReady && counts.FACULTY_RETURNED)
      items.push({
        id: 'faculty-returned',
        title: counts.FACULTY_RETURNED + ' kết quả CTSV trả Khoa',
        subtitle: 'Kiểm tra lý do trả và hoàn thiện lại kết quả.',
        to: facultyListHref(termId, 'FACULTY_RETURNED'),
        icon: AlertTriangle,
        urgent: true,
      });
    if (summary.pendingAppeals)
      items.push({
        id: 'appeals',
        title: summary.pendingAppeals + ' phúc khảo chờ giải quyết',
        subtitle: 'Xem căn cứ và kết quả đã công bố liên quan.',
        to: '/officer/appeals?' + new URLSearchParams({ termId, status: 'PENDING' }),
        icon: MessageSquareWarning,
        urgent: true,
      });
    if (kpi.data?.pendingEvidences)
      items.push({
        id: 'evidence',
        title: kpi.data.pendingEvidences + ' minh chứng chưa xử lý xong',
        subtitle: 'Có thể đang xác minh hoặc chờ bổ sung. Mở hàng đợi để kiểm tra.',
        to: '/officer/queue?' + new URLSearchParams({ termId }),
        icon: FileClock,
      });
    if (summary.ready)
      items.push({
        id: 'ready',
        title: summary.ready + ' kết quả sẵn sàng gửi CTSV',
        subtitle: 'Kiểm tra lần cuối trước khi bàn giao.',
        to: facultyListHref(termId, 'READY'),
        icon: CheckCircle2,
      });
    if (rowReady && counts.STUDENT_RETURNED)
      items.push({
        id: 'returned',
        title: counts.STUDENT_RETURNED + ' đánh giá chờ sinh viên chỉnh sửa',
        subtitle: 'Theo dõi bổ sung và nộp lại trước hạn chấm.',
        to: facultyListHref(termId, 'STUDENT_RETURNED'),
        icon: Clock,
      });
    if (pastSubmission && summary.notSubmitted)
      items.push({
        id: 'not-submitted',
        title: summary.notSubmitted + ' sinh viên quá hạn chưa nộp',
        subtitle: 'Kiểm tra danh sách và ghi nhận theo quy chế.',
        to: facultyListHref(termId, 'NOT_SUBMITTED'),
        icon: AlertTriangle,
        urgent: true,
      });
    return items;
  }, [term, summary, legacy, rowReady, counts, kpi.data, termId, pastSubmission]);

  const termStatus = !term
    ? ''
    : isClosed
    ? 'Đã chốt · Chỉ xem'
    : term.status === 'REVIEWING'
    ? 'Đang chấm duyệt'
    : term.status === 'UPCOMING'
    ? 'Sắp diễn ra'
    : pastSubmission
    ? 'Đã hết hạn nộp mới'
    : 'Đang mở nộp';

  const busy = workflow.loading || rows.loading || kpi.loading || report.loading;

  const dateStatus = (deadline: string | undefined, kind: 'submission' | 'review' | 'appeal') => {
    if (isClosed) return 'Kỳ đã đóng';
    if (!deadline) return 'Chưa thiết lập';
    if (term?.status === 'UPCOMING') return 'Kỳ chưa mở';
    if (now > Date.parse(deadline)) return 'Đã hết hạn';
    if (kind === 'submission' && term?.status === 'REVIEWING')
      return 'Đóng nộp mới · Phiếu bị trả theo quyền riêng';
    return kind === 'appeal' ? 'Áp dụng khi đủ điều kiện phúc khảo' : 'Còn trong hạn';
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* 1. HEADER CHÍNH */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#6B6B6B]">
            {user.faculty?.name || 'Khoa phụ trách'}
            {term && ' · ' + term.name}
          </p>
          <h1 className="mt-1 text-xl font-semibold font-heading sm:text-2xl text-[#0A0A0A]">
            Tổng quan Khoa
          </h1>
          <p className="mt-1 text-sm text-[#6B6B6B]">
            Trung tâm điều hành rèn luyện: theo dõi tiến độ xử lý, thẩm định minh chứng và báo cáo kết quả công bố.
          </p>
          {term && (
            <p className="mt-2 text-xs text-[#6B6B6B]">
              <span className="mr-2 inline-flex items-center gap-1 rounded-full border border-[#E8E8EC] bg-white px-2 py-0.5">
                {isClosed && <Lock className="h-3 w-3" />}
                {termStatus}
              </span>
              Cập nhật {new Date(workflow.data!.updatedAt).toLocaleString('vi-VN')}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !termId}
            onClick={() => void sources.refresh()}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#E8E8EC] bg-white px-3 py-2 text-sm font-medium text-[#0A0A0A] hover:bg-[#FAFAFA] disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={'h-4 w-4 ' + (busy ? 'animate-spin' : '')} />
            Làm mới
          </button>
          <Link
            to={facultyListHref(termId)}
            className="rounded-md bg-[#1D6FC2] px-4 py-2 text-sm font-medium text-white hover:bg-[#175A9E] transition-colors"
          >
            Mở hồ sơ rèn luyện
          </Link>
        </div>
      </header>

      {!termId ? (
        <p className={card}>Chưa có kỳ đánh giá. Vui lòng liên hệ CTSV để kiểm tra phân công.</p>
      ) : (
        <SourceState loading={workflow.loading} error={workflow.error} retry={sources.refreshWorkflow}>
          {term && summary && (
            <>
              {/* 2. 3 MỐC THỜI HẠN */}
              <div className="grid gap-3 md:grid-cols-3">
                <DeadlineCard
                  label="Hạn nộp sinh viên"
                  deadline={term.submissionDeadline}
                  statusText={dateStatus(term.submissionDeadline, 'submission')}
                  expired={pastSubmission && !isClosed}
                />
                <DeadlineCard
                  label="Hạn chấm của Khoa"
                  deadline={term.reviewDeadline}
                  statusText={dateStatus(term.reviewDeadline, 'review')}
                  expired={Boolean(term.reviewDeadline && now > Date.parse(term.reviewDeadline) && !isClosed)}
                />
                <DeadlineCard
                  label="Hạn phúc khảo"
                  deadline={term.appealDeadline}
                  statusText={dateStatus(term.appealDeadline, 'appeal')}
                  expired={Boolean(now > Date.parse(term.appealDeadline) && !isClosed)}
                />
              </div>

              {legacy && (
                <p className="rounded-lg border border-[#E8E8EC] bg-[#F4F4F6] p-3 text-xs text-[#0A0A0A]">
                  Kỳ lịch sử: tra cứu kết quả và minh chứng hiện có; không áp dụng tiến độ bàn giao của workflow mới.
                </p>
              )}
              {isClosed && !legacy && (
                <p className="rounded-lg border border-[#E8E8EC] bg-[#F4F4F6] p-3 text-xs text-[#0A0A0A]">
                  Kỳ đã chốt. Số liệu được hiển thị để tra cứu, các hồ sơ chỉ được xem.
                </p>
              )}

              {/* 3. 5 CHỈ SỐ KPI CHÍNH */}
              {!legacy && (
                <div aria-label="5 chỉ số chính của Khoa" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                  <StatCard
                    label="Tổng sinh viên"
                    value={total}
                    subtitle={(workflow.data?.filters.classes.length ?? 0) + ' lớp trong kỳ'}
                    icon={Users}
                    variant="primary"
                    to={facultyListHref(termId)}
                  />
                  <StatCard
                    label="Chưa nộp tự đánh giá"
                    value={summary.notSubmitted}
                    subtitle={percentage(summary.notSubmitted, total).toLocaleString('vi-VN') + '% sinh viên'}
                    icon={FileText}
                    variant="warning"
                    to={facultyListHref(termId, 'NOT_SUBMITTED')}
                  />
                  <StatCard
                    label="Khoa đang chấm"
                    value={summary.reviewing}
                    subtitle="Chưa hoàn tất thẩm định"
                    icon={FileClock}
                    variant="info"
                    to={facultyListHref(termId, 'REVIEWING')}
                  />
                  <StatCard
                    label="Sẵn sàng gửi CTSV"
                    value={summary.ready}
                    subtitle="Đủ điều kiện bàn giao"
                    icon={CheckCircle2}
                    variant="success"
                    to={facultyListHref(termId, 'READY')}
                  />
                  <StatCard
                    label="Đã công bố"
                    value={summary.published}
                    subtitle={`${percentage(summary.published, total)}% đã có kết quả`}
                    icon={Award}
                    highlight
                    variant="primary"
                    to="#"
                    onClick={() => handleViewChange('lookup')}
                  />
                </div>
              )}

              {/* 4. SEGMENTED CONTROL: CHUYỂN ĐỔI CHẾ ĐỘ XEM */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8E8EC] pb-3">
                <div className="flex items-center gap-1.5 rounded-[10px] border border-[#CBD5E1] bg-[#F1F5F9] p-1.5 shadow-inner">
                  <button
                    type="button"
                    onClick={() => handleViewChange('overview')}
                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                      viewMode === 'overview'
                        ? 'bg-white text-[#1D6FC2] shadow-sm border border-black/5'
                        : 'text-[#64748B] hover:text-[#0A0A0A]'
                    }`}
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Tổng quan điều hành
                  </button>
                  <button
                    type="button"
                    onClick={() => handleViewChange('lookup')}
                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                      viewMode === 'lookup'
                        ? 'bg-white text-[#1D6FC2] shadow-sm border border-black/5'
                        : 'text-[#64748B] hover:text-[#0A0A0A]'
                    }`}
                  >
                    <TableProperties className="h-4 w-4" />
                    Tra cứu sinh viên
                    {total ? (
                      <span className="ml-1 rounded-full bg-[#1D6FC2] px-1.5 py-0.2 text-[10px] font-bold text-white">
                        {total}
                      </span>
                    ) : null}
                  </button>
                </div>

                <div className="text-xs text-[#64748B] font-medium flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#10B981]" />
                  {viewMode === 'overview'
                    ? 'Bố cục điều hành 2 cột · Tối ưu theo dõi & xử lý'
                    : 'Bảng dữ liệu toàn màn hình · Tìm kiếm & Xuất Excel'}
                </div>
              </div>

              {/* 5A. CHẾ ĐỘ 1: TỔNG QUAN ĐIỀU HÀNH (2x2 GRID + TIẾN ĐỘ LỚP) */}
              {viewMode === 'overview' && (
                <div className="space-y-6">
                  {/* 2x2 HYBRID GRID */}
                  <div className="grid items-start gap-6 lg:grid-cols-2">
                    {/* CARD 1: TIẾN ĐỘ PHIẾU */}
                    <section className={card} aria-label="Tiến độ phiếu">
                      <SourceState loading={rows.loading} error={rows.error} retry={sources.refreshWorkflow}>
                        <FacultyStateChart counts={counts} total={total} termId={termId} />
                      </SourceState>
                    </section>

                    {/* CARD 2: VIỆC CẦN XỬ LÝ (ACTION QUEUE) */}
                    <section className="space-y-3" aria-label="Việc cần xử lý">
                      <ActionQueue
                        title={isClosed ? 'Hồ sơ cần theo dõi' : 'Việc cần xử lý ngay'}
                        items={actions}
                        emptyMessage={
                          rows.loading || rows.error || kpi.loading || kpi.error
                            ? 'Chưa đủ dữ liệu để kết luận các việc còn tồn.'
                            : 'Không có việc cần xử lý trong kỳ này.'
                        }
                      />
                      {(rows.loading || kpi.loading) && (
                        <p role="status" className="text-xs text-[#6B6B6B]">
                          Đang kiểm tra thêm kết quả bị trả và minh chứng…
                        </p>
                      )}
                      {(rows.error || kpi.error) && (
                        <p className="text-xs text-amber-800">
                          Một phần thống kê công việc chưa tải được. Xem lỗi và thử lại ở khu vực tương ứng.
                        </p>
                      )}
                    </section>

                    {/* CARD 3: MINH CHỨNG */}
                    <section className={card} aria-label="Tình hình minh chứng">
                      <SourceState loading={kpi.loading} error={kpi.error} retry={sources.refreshKpi}>
                        {kpi.data && <FacultyEvidenceDonut kpi={kpi.data} termId={termId} />}
                      </SourceState>
                    </section>

                    {/* CARD 4: KẾT QUẢ CÔNG BỐ */}
                    <section className={card} aria-label="Kết quả công bố">
                      <SourceState loading={report.loading} error={report.error} retry={sources.refreshReport}>
                        <FacultyResultsCard
                          report={report.data as any}
                          termId={termId}
                          onOpenLookup={(selectedClassId) => handleViewChange('lookup', selectedClassId)}
                        />
                      </SourceState>
                    </section>
                  </div>

                  {/* FULL-WIDTH: TIẾN ĐỘ GIỮA CÁC LỚP */}
                  {!legacy && (
                    <section className={card} aria-label="Tiến độ giữa các lớp">
                      <SourceState loading={rows.loading} error={rows.error} retry={sources.refreshWorkflow}>
                        <FacultyClassChart key={termId} classes={classes} termId={termId} />
                      </SourceState>
                    </section>
                  )}

                  {/* BOTTOM CTA: LINK CHUYỂN NHANH TRA CỨU */}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[#E8E8EC] bg-[#FAFAFA] p-4 text-xs">
                    <div>
                      <p className="font-semibold text-[#0A0A0A]">
                        Cần tra cứu điểm chi tiết, phân loại sinh viên hoặc xuất file Excel?
                      </p>
                      <p className="text-[#6B6B6B] mt-0.5">
                        Chuyển sang chế độ Tra cứu để mở bảng dữ liệu toàn màn hình với bộ lọc nâng cao.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleViewChange('lookup')}
                      className="inline-flex items-center gap-1.5 rounded-md bg-[#1D6FC2] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#175A9E] transition-colors"
                    >
                      <TableProperties className="h-3.5 w-3.5" />
                      Mở bảng tra cứu sinh viên →
                    </button>
                  </div>
                </div>
              )}

              {/* 5B. CHẾ ĐỘ 2: TRA CỨU NGHIỆP VỤ (FULL-WIDTH STUDENT TABLE) */}
              {viewMode === 'lookup' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-base font-semibold font-heading text-[#0A0A0A]">
                        Tra cứu kết quả rèn luyện từng sinh viên
                      </h2>
                      <p className="text-xs text-[#6B6B6B]">
                        Tìm kiếm, lọc theo lớp, sắp xếp theo cột và xuất báo cáo Excel theo đúng danh sách lọc.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleViewChange('overview')}
                      className="text-xs font-semibold text-[#1D6FC2] hover:underline"
                    >
                      ← Quay lại Tổng quan điều hành
                    </button>
                  </div>

                  <FacultyStudentLookup
                    termId={termId}
                    classOptions={workflow.data?.filters.classes || []}
                  />
                </div>
              )}
            </>
          )}
        </SourceState>
      )}
    </div>
  );
};
