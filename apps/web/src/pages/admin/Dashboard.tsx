import React, { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/apiClient';
import {
  PageHeader,
  SectionHeader,
  StatCard,
  ProgressCard,
  StatusBreakdown,
  ActionQueue,
  DeadlineCard,
  DataState,
  InsightPanel,
} from '../../components/shared';
import {
  EvaluationData,
  PublicationConditions,
  evaluationStateLabels,
  errorMessage,
} from '../../components/EvaluationBoard';
import {
  Users,
  FileCheck,
  Send,
  AlertTriangle,
  FileClock,
  MessageSquareWarning,
  Award,
  ChevronRight,
  RefreshCw,
  Building2,
  Calendar,
  ExternalLink,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { activeTerm } = useAuth();
  const [params] = useSearchParams();
  const termId = params.get('termId') || activeTerm.id;

  const [workflowData, setWorkflowData] = useState<EvaluationData | null>(null);
  const [conditions, setConditions] = useState<PublicationConditions | null>(null);
  const [reportData, setReportData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!termId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    Promise.all([
      apiClient.getEvaluationWorkflow(termId),
      apiClient.getPublicationConditions(termId).catch(() => null),
      apiClient.getResultReport(termId).catch(() => null),
    ])
      .then(([wf, cond, rep]) => {
        if (cancelled) return;
        setWorkflowData(wf);
        setConditions(cond);
        setReportData(rep);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [termId, refreshKey]);

  const summary = workflowData?.summary || {};
  const totalStudents = workflowData?.total ?? 0;
  const term = workflowData?.term;

  // Sắp xếp Khoa có tồn đọng cao lên trước (tồn = total - sent + pendingAppeals)
  const sortedFaculties = useMemo(() => {
    if (!workflowData?.facultyProgress) return [];
    return [...workflowData.facultyProgress].sort((a, b) => {
      const pendingA = a.total - a.sent + a.pendingAppeals * 2;
      const pendingB = b.total - b.sent + b.pendingAppeals * 2;
      return pendingB - pendingA;
    });
  }, [workflowData?.facultyProgress]);


  // Segmented workflow status
  const workflowSegments = useMemo(() => {
    if (!totalStudents) return [];
    return [
      { label: 'Chưa nộp', count: summary.notSubmitted || 0, color: 'bg-[#9C9C9C]' },
      { label: 'Đang chấm', count: summary.reviewing || 0, color: 'bg-[#F59E0B]' },
      { label: 'Cần sửa', count: summary.returned || 0, color: 'bg-[#EF4444]' },
      { label: 'Hoàn tất chấm', count: summary.ready || 0, color: 'bg-[#0284C7]' },
      { label: 'CTSV đang tiếp nhận', count: Math.max(0, (summary.sent || 0) - (summary.published || 0)), color: 'bg-[#1D6FC2]' },
      { label: 'Ghi nhận không nộp', count: summary.recordedNotSubmitted || 0, color: 'bg-[#6B6B6B]' },
      { label: 'Đã công bố tạm', count: summary.published || 0, color: 'bg-[#10B981]' },
    ];
  }, [summary, totalStudents]);

  // Action Queue: Các việc ưu tiên toàn trường (tối đa 8 mục)
  const actionItems = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      subtitle?: string;
      to: string;
      icon: any;
      urgent?: boolean;
      badge?: React.ReactNode;
    }> = [];

    // 1. Khoa bị trả kết quả
    if ((summary.facultyReturned || 0) > 0) {
      items.push({
        id: 'faculty-returned',
        title: `${summary.facultyReturned} phiếu bị CTSV trả lại đang chờ Khoa xử lý`,
        subtitle: 'Kiểm tra lý do trả và theo dõi Khoa gửi lại phiên bản mới',
        to: `/admin/results?termId=${termId}&state=FACULTY_RETURNED`,
        icon: AlertTriangle,
        urgent: true,
        badge: <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEF2F2] text-[#DC2626]">Cần chú ý</span>,
      });
    }

    // 2. Phúc khảo chờ
    if ((summary.pendingAppeals || 0) > 0) {
      items.push({
        id: 'appeals-pending',
        title: `${summary.pendingAppeals} đơn phúc khảo chưa giải quyết`,
        subtitle: 'Phúc khảo phải được giải quyết trước khi chốt kỳ đánh giá',
        to: `/admin/results?termId=${termId}&state=APPEALS`,
        icon: MessageSquareWarning,
        urgent: true,
        badge: <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FFFBEB] text-[#D97706]">Tồn đọng</span>,
      });
    }

    // 3. Phiếu Khoa đã gửi chờ CTSV xem xét & công bố
    if ((summary.sent || 0) > 0) {
      items.push({
        id: 'sent-ready',
        title: `${summary.sent} phiếu đã được Khoa bàn giao, sẵn sàng công bố`,
        subtitle: 'Thẩm định bàn giao và chuẩn bị ban hành phiên bản công bố',
        to: `/admin/results?termId=${termId}&state=SENT`,
        icon: FileCheck,
        badge: <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#F0F6FC] text-[#1D6FC2]">Đã bàn giao</span>,
      });
    }

    // 4. Minh chứng chờ duyệt còn tồn ở các Khoa
    if ((summary.pendingEvidence || 0) > 0) {
      items.push({
        id: 'pending-evidence',
        title: `${summary.pendingEvidence} minh chứng đang chờ cán bộ Khoa thẩm định`,
        subtitle: 'Đốc thúc các Khoa hoàn tất xác minh minh chứng trước hạn',
        to: `/admin/results?termId=${termId}&state=REVIEWING`,
        icon: FileClock,
      });
    }

    // 5. Thêm các Khoa có tỷ lệ tồn cao
    sortedFaculties.slice(0, 4).forEach((f) => {
      const pending = f.total - f.sent;
      if (pending > 0 || f.pendingAppeals > 0) {
        items.push({
          id: `faculty-${f.id}`,
          title: `Khoa ${f.name}: Còn ${pending}/${f.total} phiếu chưa gửi CTSV`,
          subtitle: f.pendingAppeals > 0 ? `Có ${f.pendingAppeals} phúc khảo đang mở` : 'Đang trong tiến trình chấm điểm',
          to: `/admin/results?termId=${termId}&facultyId=${f.id}`,
          icon: Building2,
        });
      }
    });

    return items;
  }, [summary, termId, sortedFaculties]);

  return (
    <div className="space-y-6 pb-12 font-sans">
      <PageHeader
        title="Tổng quan toàn trường"
        badge={
          term && (
            <span className="px-2.5 py-1 rounded-[6px] text-xs font-semibold bg-[#F0F6FC] text-[#1D6FC2] border border-[#C2DBF2]">
              {term.name} {term.status === 'ACTIVE' ? '(Đang mở)' : term.status === 'CLOSED' ? '(Đã chốt)' : ''}
            </span>
          )
        }
        meta={
          workflowData?.updatedAt && (
            <span>
              Cập nhật gần nhất: {new Date(workflowData.updatedAt).toLocaleString('vi-VN')}
            </span>
          )
        }
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0A0A0A] bg-[#FFFFFF] hover:bg-[#FAFAFA] border border-[#E8E8EC] rounded-[6px] transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Làm mới
            </button>
            <Link
              to={`/admin/results?termId=${termId}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#1D6FC2] hover:bg-[#175A9E] rounded-[6px] btn-primary-lift"
            >
              Tiếp nhận & công bố →
            </Link>
          </div>
        }
      />

      <DataState
        loading={loading}
        loadingMessage="Đang tải dữ liệu điều hành toàn trường…"
        error={error}
        onRetry={() => setRefreshKey((k) => k + 1)}
        isEmpty={!termId}
        emptyTitle="Chưa có kỳ đánh giá được chọn"
        emptyDescription="Vui lòng thiết lập hoặc chọn một kỳ đánh giá để xem tổng quan điều hành."
        emptyAction={
          <Link
            to="/admin/terms"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1D6FC2] rounded-[6px]"
          >
            Quản lý kỳ đánh giá
          </Link>
        }
      >
        {/* 1. KHỐI TIẾN ĐỘ THỜI GIAN & ĐIỀU KIỆN CÔNG BỐ / CHỐT KỲ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Cột 1 & 2: Các mốc Deadline */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DeadlineCard
              label="Hạn sinh viên nộp phiếu"
              deadline={term?.submissionDeadline}
              statusText={
                term?.submissionDeadline && new Date() > new Date(term.submissionDeadline)
                  ? 'Đã hết hạn nộp'
                  : 'Đang mở nộp'
              }
              expired={Boolean(term?.submissionDeadline && new Date() > new Date(term.submissionDeadline))}
              note="Sau hạn này sinh viên không thể tạo hồ sơ mới, trừ trường hợp được Khoa trả phiếu để sửa."
            />
            <DeadlineCard
              label="Hạn tiếp nhận phúc khảo"
              deadline={term?.appealDeadline}
              statusText={
                term?.appealDeadline && new Date() > new Date(term.appealDeadline)
                  ? 'Đã hết hạn phúc khảo'
                  : 'Thời hạn mở'
              }
              expired={Boolean(term?.appealDeadline && new Date() > new Date(term.appealDeadline))}
              note="Chỉ được chốt kỳ đánh giá khi đã qua hạn phúc khảo và không còn đơn khiếu nại chờ."
            />
          </div>

          {/* Cột 3: Trạng thái điều kiện công bố / chốt kỳ */}
          <InsightPanel
            title="Điều kiện Công bố & Chốt kỳ"
            type={conditions?.canPublish && conditions?.canClose ? 'success' : conditions?.canPublish ? 'info' : 'warning'}
            className="flex flex-col justify-between"
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[#6B6B6B]">Công bố tạm:</span>
                <strong className={conditions?.canPublish ? 'text-[#10B981]' : 'text-[#D97706]'}>
                  {conditions?.canPublish ? 'Đủ điều kiện' : 'Chưa đủ điều kiện'}
                </strong>
              </div>
              {!conditions?.canPublish && conditions?.publishBlockers?.length ? (
                <p className="text-[11px] text-[#6B6B6B] leading-tight">
                  Lý do: {conditions.publishBlockers[0]}
                </p>
              ) : null}

              <div className="flex items-center justify-between pt-1 border-t border-[#E8E8EC]">
                <span className="text-[#6B6B6B]">Chốt toàn bộ kỳ:</span>
                <strong className={conditions?.canClose ? 'text-[#10B981]' : 'text-[#6B6B6B]'}>
                  {conditions?.canClose ? 'Đủ điều kiện' : 'Đang chờ điều kiện'}
                </strong>
              </div>
              {!conditions?.canClose && conditions?.closeBlockers?.length ? (
                <p className="text-[11px] text-[#6B6B6B] leading-tight">
                  Cần giải quyết: {conditions.closeBlockers[0]}
                </p>
              ) : null}
            </div>

            <div className="mt-3 pt-2 border-t border-[#E8E8EC] flex justify-end">
              <Link
                to={`/admin/results?termId=${termId}`}
                className="text-xs font-semibold text-[#1D6FC2] hover:text-[#175A9E] hover:underline inline-flex items-center gap-1"
              >
                Vào trang bàn giao & công bố <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </InsightPanel>
        </div>

        {/* 2. GRID 6 KPI CHỦ CHỐT TOÀN TRƯỜNG */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <StatCard
            label="Tổng sinh viên kỳ"
            value={totalStudents}
            subtitle="Danh sách snapshot"
            icon={Users}
            to={`/admin/results?termId=${termId}`}
          />
          <StatCard
            label="Chưa nộp phiếu"
            value={summary.notSubmitted || 0}
            subtitle="Chưa gửi phiếu tự chấm"
            icon={FileClock}
            to={`/admin/results?termId=${termId}&state=NOT_SUBMITTED`}
          />
          <StatCard
            label="Khoa đang chấm"
            value={summary.reviewing || 0}
            subtitle="Đang thẩm định"
            icon={Building2}
            to={`/admin/results?termId=${termId}&state=REVIEWING`}
          />
          <StatCard
            label="Đã gửi CTSV"
            value={summary.sent || 0}
            subtitle="Sẵn sàng công bố"
            icon={Send}
            highlight={Boolean(summary.sent)}
            to={`/admin/results?termId=${termId}&state=SENT`}
          />
          <StatCard
            label="Đã công bố tạm"
            value={summary.published || 0}
            subtitle="Phiên bản mới nhất"
            icon={FileCheck}
            to={`/admin/results?termId=${termId}&state=PUBLISHED`}
          />
          <StatCard
            label="Phúc khảo chờ"
            value={summary.pendingAppeals || 0}
            subtitle="Cần Khoa giải quyết"
            icon={MessageSquareWarning}
            trend={summary.pendingAppeals ? { text: 'Cần xử lý', type: 'warning' } : undefined}
            to={`/admin/results?termId=${termId}&state=APPEALS`}
          />
        </div>

        {/* 3. SEGMENTED WORKFLOW STATUS BAR */}
        <ProgressCard
          title="Tiến trình quy trình đánh giá toàn trường"
          subtitle="Tỷ lệ sinh viên theo từng giai đoạn xử lý trong kỳ"
          current={summary.sent || 0}
          total={totalStudents}
          unit="đã bàn giao"
          segments={workflowSegments}
        />

        {/* 4. HAI CỘT: TIẾN ĐỘ THEO KHOA & ACTION QUEUE ƯU TIÊN */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Cột trái (7 cols): Tiến độ theo Khoa (Sắp xếp tồn cao lên trước) */}
          <div className="lg:col-span-7 space-y-3">
            <SectionHeader
              title="Tiến độ nộp kết quả theo Khoa"
              description="Ưu tiên hiển thị các đơn vị có tỷ lệ tồn hoặc phúc khảo cao"
              count={sortedFaculties.length}
              viewAllLink={`/admin/results?termId=${termId}`}
              viewAllText="Xem bảng tiếp nhận"
            />

            <div className="rounded-[12px] border border-[#E8E8EC] bg-[#FFFFFF] divide-y divide-[#E8E8EC] overflow-hidden">
              {sortedFaculties.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#6B6B6B]">
                  Chưa có dữ liệu phân công Khoa cho kỳ này.
                </div>
              ) : (
                sortedFaculties.map((f) => {
                  const sentCount = f.sent || 0;
                  const total = f.total || 0;
                  const pct = total > 0 ? Math.round((sentCount / total) * 100) : 0;
                  const isCompleted = total > 0 && sentCount >= total;

                  return (
                    <div key={f.id} className="p-3.5 hover:bg-[#FAFAFA] transition-colors">
                      <div className="flex items-center justify-between text-xs sm:text-sm">
                        <Link
                          to={`/admin/results?termId=${termId}&facultyId=${f.id}`}
                          className="font-semibold text-[#0A0A0A] hover:text-[#1D6FC2] flex items-center gap-1.5"
                        >
                          <Building2 className="w-3.5 h-3.5 text-[#6B6B6B]" />
                          {f.name}
                        </Link>
                        <div className="flex items-center gap-3">
                          {f.pendingAppeals > 0 && (
                            <span className="text-[11px] font-semibold text-[#D97706] bg-[#FFFBEB] px-2 py-0.5 rounded-full border border-[#FDE68A]">
                              {f.pendingAppeals} phúc khảo
                            </span>
                          )}
                          <span className="font-bold text-[#0A0A0A]">
                            {sentCount}/{total} <span className="text-[#6B6B6B] font-normal">({pct}%)</span>
                          </span>
                        </div>
                      </div>

                      {/* Mini Progress Bar */}
                      <div className="w-full h-1.5 rounded-full bg-[#F4F4F6] mt-2 overflow-hidden flex">
                        <div
                          style={{ width: `${pct}%` }}
                          className={`h-full transition-all duration-300 ${
                            isCompleted ? 'bg-[#10B981]' : 'bg-[#1D6FC2]'
                          }`}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Cột phải (5 cols): Action Queue toàn trường */}
          <div className="lg:col-span-5 space-y-3">
            <SectionHeader
              title="Điểm nghẽn & Cần xử lý"
              description="Các mục cần CTSV giải quyết hoặc đôn đốc"
              count={actionItems.length}
            />

            <ActionQueue
              title="Danh sách ưu tiên điều hành"
              items={actionItems}
              emptyMessage="Toàn trường đang vận hành trơn tru, không có cảnh báo tồn đọng."
              viewAllLink={`/admin/results?termId=${termId}`}
              viewAllText="Mở bảng tiếp nhận"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[#E8E8EC] bg-white p-4 text-sm">
          <p>{reportData ? <><strong>{reportData.totalEvaluated}</strong> sinh viên có kết quả công bố · Điểm trung bình: <strong>{reportData.averageScore ?? '—'}</strong></> : 'Chưa tải được tóm tắt kết quả công bố.'}</p>
          <Link className="font-semibold text-[#1D6FC2] hover:underline" to={`/admin/reports?termId=${termId}`}>Xem báo cáo kết quả →</Link>
        </div>
      </DataState>
    </div>
  );
};
