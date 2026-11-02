import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/apiClient';
import { useStudentAssessmentAccess } from '../../hooks/useStudentAssessmentAccess';
import { StudentAssessmentNotice } from '../../components/StudentAssessmentNotice';
import { Evidence } from '../../types';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ScoreGauge } from '../../components/ui/ScoreGauge';
import {
  PageHeader,
  SectionHeader,
  StatCard,
  DeadlineCard,
  ActionQueue,
  InsightPanel,
} from '../../components/shared';
import {
  Printer,
  FileText,
  X,
  CheckCircle,
  ChevronRight,
  Award,
  Calendar,
  Clock,
  AlertCircle,
  RotateCcw,
  Send,
  Building2,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';

export const StudentDashboard: React.FC = () => {
  const { user, activeTerm } = useAuth();
  const access = useStudentAssessmentAccess(user?.id, activeTerm.id);
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [scoreSummary, setScoreSummary] = useState<any>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showScoreModal, setShowScoreModal] = useState(false);

  useEffect(() => {
    if (!user?.id || !activeTerm.id) return;
    let cancelled = false;
    setIsLoading(true);
    setLoadError('');
    Promise.all([
      apiClient.getEvidences({ studentId: user.id, termId: activeTerm.id }),
      apiClient.getConductDashboard(activeTerm.id),
    ])
      .then(([evidenceList, summary]) => {
        if (cancelled) return;
        setEvidences(evidenceList);
        setScoreSummary(summary);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError('Không tải được dữ liệu điểm và minh chứng từ máy chủ. Vui lòng thử lại.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, activeTerm.id]);

  const isSubmissionOpen = access.canEdit;

  // Điểm và phân bổ theo khung chỉ lấy từ Backend; FE không tự quyết định điểm.
  const isOfficialScore = scoreSummary?.officialScore !== null && scoreSummary?.officialScore !== undefined;
  const displayedScore = Number(scoreSummary?.officialScore ?? scoreSummary?.scoreInProgress ?? 0);
  const totalRubricCriteria = (scoreSummary?.categories || []).reduce(
    (total: number, category: any) => total + (category.criteria?.length || 0),
    0
  );
  const hasConfirmedScore =
    isOfficialScore ||
    (scoreSummary?.status === 'IN_PROGRESS' && Number(scoreSummary.pendingCriteriaCount) < totalRubricCriteria);

  const categorySummaries: { category: string; name: string; score: number; maxScore: number; hasScore: boolean }[] =
    (scoreSummary?.categories || []).map((category: any) => ({
      category: category.key,
      name: category.name,
      hasScore: isOfficialScore || category.criteria?.some((criterion: any) => criterion.assessment?.status === 'FINALIZED'),
      score:
        isOfficialScore || category.criteria?.some((criterion: any) => criterion.assessment?.status === 'FINALIZED')
          ? Number(category.score ?? 0)
          : 0,
      maxScore: Number(category.maxScore ?? 0),
    }));

  const approvedEvidences = useMemo(() => {
    return evidences.filter((e) => e.status === 'APPROVED');
  }, [evidences]);

  const pendingEvidences = useMemo(() => {
    return evidences.filter(
      (e) =>
        e.status === 'NEEDS_HUMAN_REVIEW' ||
        e.status === 'PLAUSIBLE' ||
        e.status === 'VERIFIED' ||
        e.status === 'PROCESSING'
    );
  }, [evidences]);

  const needsActionEvidences = useMemo(() => {
    return evidences.filter((e) => e.status === 'NEEDS_SUPPLEMENT');
  }, [evidences]);

  const rankInfo = useMemo(() => {
    return {
      currentRank:
        !scoreSummary?.classification || scoreSummary.classification === 'CHUA_XEP_LOAI'
          ? 'Chưa xếp loại'
          : scoreSummary.classification,
      currentRankColor: 'text-[#0A0A0A] bg-[#FAFAFA] border-[#E8E8EC]',
      pct: hasConfirmedScore ? Math.min(100, Math.max(0, displayedScore)) : 0,
    };
  }, [displayedScore, hasConfirmedScore, scoreSummary]);

  // Action Queue cho Sinh viên
  const studentActionItems = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      subtitle?: string;
      to: string;
      icon: any;
      urgent?: boolean;
      badge?: React.ReactNode;
    }> = [];

    // 1. Phiếu bị trả
    if (access.isReturned) {
      items.push({
        id: 'assessment-returned',
        title: 'Phiếu rèn luyện bị trả lại — cần chỉnh sửa và nộp lại',
        subtitle: access.assessment?.submission?.returnReason || 'Cán bộ Khoa đã gửi lại phiếu kèm yêu cầu chỉnh sửa',
        to: `/student/scores?termId=${activeTerm.id}`,
        icon: RotateCcw,
        urgent: true,
        badge: <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEF2F2] text-[#DC2626]">Cần sửa</span>,
      });
    }

    // 2. Minh chứng cần bổ sung
    needsActionEvidences.forEach((ev) => {
      const missing = ev.supplementRequests?.[0]?.missingItem;
      items.push({
        id: `ev-${ev.id}`,
        title: `Bổ sung minh chứng: ${ev.declaredActivityName}`,
        subtitle: missing || 'Cán bộ thẩm định yêu cầu cung cấp thêm tài liệu xác thực',
        to: `/student/evidence/${ev.id}/supplement`,
        icon: AlertCircle,
        urgent: true,
        badge: <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FFFBEB] text-[#D97706]">Bổ sung ngay</span>,
      });
    });

    return items;
  }, [access, needsActionEvidences, activeTerm.id]);

  // Xác định bước quy trình hiện tại
  const currentPipelineStep = useMemo(() => {
    if (isOfficialScore) return 5; // Công bố
    if (access.isReturned) return 1; // Sửa lại
    const subStatus = access.assessment?.submission?.status;
    if (!subStatus || subStatus === 'DRAFT') return 1; // Tự đánh giá
    if (subStatus === 'SUBMITTED') return 3; // Khoa thẩm định
    return 2;
  }, [access, isOfficialScore]);

  return (
    <div className="space-y-6 pb-12 font-sans">
      {loadError && (
        <div role="alert" className="rounded-[12px] border border-[#FECACA] bg-[#FEF2F2] p-4 text-xs text-[#DC2626]">
          {loadError}
        </div>
      )}

      {/* 1. HERO HEADER: Lời chào, thông tin sinh viên và nút hành động */}
      <div className="p-5 sm:p-6 rounded-[12px] border border-[#E8E8EC] bg-[#FFFFFF] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-xl">
          <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FAFAFA] text-[#6B6B6B] border border-[#E8E8EC]">
            <span>{activeTerm.name}</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold font-heading text-[#0A0A0A] tracking-tight">
            Xin chào, {user?.fullName || 'Sinh viên'}
          </h1>
          <p className="text-xs text-[#6B6B6B]">
            Mã sinh viên: <strong className="text-[#0A0A0A] font-semibold">{user?.studentCode || 'Chưa cập nhật'}</strong> · {user?.faculty?.name || (user?.class as any)?.faculty?.name || 'Chưa cập nhật'} · Lớp {(user?.class as any)?.code || (user?.class as any)?.name || 'Chưa cập nhật'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Main Action Button - Matches exact UX test requirement */}
          {access.isReturned && access.canEdit ? (
            <Link
              to={`/student/scores?termId=${activeTerm.id}`}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-semibold text-xs rounded-[6px] btn-primary-lift"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Sửa & Nộp lại</span>
            </Link>
          ) : (
            <Link
              to="/student/scores"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#1D6FC2] hover:bg-[#175A9E] text-white font-semibold text-xs rounded-[6px] btn-primary-lift"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{access.canEdit ? 'Chấm điểm & nộp minh chứng' : 'Xem phiếu rèn luyện'}</span>
            </Link>
          )}

          <button
            onClick={() => setShowScoreModal(true)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#FFFFFF] hover:bg-[#FAFAFA] text-[#0A0A0A] font-medium text-xs rounded-[6px] border border-[#E8E8EC] transition"
          >
            <Printer className="w-3.5 h-3.5 text-[#6B6B6B]" />
            <span>Bảng điểm & In</span>
          </button>
        </div>
      </div>

      {/* 2. NOTICE QUYỀN ĐÁNH GIÁ (Bị trả / Hết hạn / Khóa sổ) */}
      <StudentAssessmentNotice access={access} showEditLink termId={activeTerm.id} />

      {/* 3. GRID 4 KPI CÁ NHÂN & HẠN CHÓT */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <DeadlineCard
          label={access.isReturned ? 'Hạn nộp lại phiếu' : 'Hạn nộp tự đánh giá'}
          deadline={access.editDeadline}
          statusText={isSubmissionOpen ? 'Đang mở nộp' : 'Đã khóa nộp'}
          expired={!isSubmissionOpen}
          note="Nộp đầy đủ điểm tự đánh giá và hồ sơ minh chứng theo 16 tiêu chí."
        />

        <StatCard
          label="Minh chứng đã duyệt"
          value={approvedEvidences.length}
          subtitle={
            isOfficialScore
              ? `Điểm chính thức: ${displayedScore} đ`
              : hasConfirmedScore
              ? `Tạm tính: ${displayedScore} đ`
              : 'Chưa có điểm chốt'
          }
          icon={CheckCircle}
          to="/student/evidence"
        />

        <StatCard
          label="Minh chứng chờ duyệt"
          value={pendingEvidences.length}
          subtitle="Cán bộ Khoa đang xem xét"
          icon={Clock}
          to="/student/evidence"
        />

        <StatCard
          label="Hồ sơ cần bổ sung"
          value={needsActionEvidences.length}
          subtitle={needsActionEvidences.length > 0 ? 'Bấm để bổ sung ngay' : 'Không có yêu cầu'}
          icon={AlertCircle}
          highlight={needsActionEvidences.length > 0}
          trend={needsActionEvidences.length > 0 ? { text: 'Yêu cầu bổ sung', type: 'warning' } : undefined}
          to="/student/evidence"
        />
      </div>

      {/* 4. PIPELINE QUY TRÌNH 6 BƯỚC */}
      <div className="p-4 rounded-[12px] border border-[#E8E8EC] bg-[#FFFFFF] space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#E8E8EC]">
          <h3 className="text-xs sm:text-sm font-bold font-heading text-[#0A0A0A]">
            Quy trình đánh giá điểm rèn luyện
          </h3>
          <span className="text-xs text-[#6B6B6B]">
            {isOfficialScore
              ? 'Đã công bố chính thức'
              : access.isReturned
              ? 'Đang cần bạn sửa lại'
              : isSubmissionOpen
              ? 'Đang trong hạn tự chấm'
              : 'Khoa đang xử lý'}
          </span>
        </div>

        {/* 6 Step Progress Track */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { step: 1, label: '1. Tự đánh giá', desc: 'Chấm điểm & gắn minh chứng' },
            { step: 2, label: '2. Nộp phiếu', desc: 'Gửi toàn bộ phiếu rèn luyện' },
            { step: 3, label: '3. Khoa thẩm định', desc: 'Xác minh & chốt tiêu chí' },
            { step: 4, label: '4. Bàn giao CTSV', desc: 'Khoa nộp kết quả về trường' },
            { step: 5, label: '5. Công bố tạm', desc: 'Xem điểm & xếp loại' },
            { step: 6, label: '6. Phúc khảo & Chốt', desc: 'Khiếu nại nếu có sai sót' },
          ].map((s) => {
            const isDone = s.step < currentPipelineStep;
            const isCurrent = s.step === currentPipelineStep;

            return (
              <div
                key={s.step}
                className={`p-2.5 rounded-[8px] border text-xs transition-colors ${
                  isCurrent
                    ? 'bg-[#F0F6FC] border-[#C2DBF2] text-[#1D6FC2]'
                    : isDone
                    ? 'bg-[#FAFAFA] border-[#E8E8EC] text-[#0A0A0A]'
                    : 'bg-[#FAFAFA] border-[#E8E8EC] text-[#9C9C9C]'
                }`}
              >
                <div className="font-semibold flex items-center justify-between">
                  <span>{s.label}</span>
                  {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />}
                </div>
                <div className="text-[11px] text-[#6B6B6B] mt-0.5 truncate">
                  {s.desc}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. ACTION QUEUE NẾU CÓ VIỆC CẦN LÀM */}
      {studentActionItems.length > 0 && (
        <ActionQueue
          title="Việc cần sinh viên xử lý ngay"
          items={studentActionItems}
          emptyMessage="Không có việc cần xử lý."
        />
      )}

      {/* 6. MAIN CONTENT: GAUGE VÀ TIẾN ĐỘ 5 KHUNG TIÊU CHÍ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Radial Score Gauge & Rank (5 cols) */}
        <div className="lg:col-span-5 p-5 sm:p-6 rounded-[12px] border border-[#E8E8EC] bg-[#FFFFFF] flex flex-col items-center justify-center">
          <ScoreGauge
            score={displayedScore}
            classification={rankInfo.currentRank}
            maxScore={100}
            isOfficial={isOfficialScore}
            hasScore={hasConfirmedScore}
          />

          <div className="w-full grid grid-cols-2 gap-3 mt-6 pt-5 border-t border-[#E8E8EC] text-center">
            <div className="p-3 rounded-[8px] bg-[#FAFAFA] border border-[#E8E8EC]">
              <span className="text-[10px] text-[#6B6B6B] font-bold uppercase block tracking-wider">
                {isOfficialScore ? 'Điểm chính thức' : 'Điểm đang tính'}
              </span>
              <span className="text-lg sm:text-xl font-bold font-heading text-[#0A0A0A] mt-0.5 block">
                {isOfficialScore
                  ? `${displayedScore} đ`
                  : hasConfirmedScore
                  ? `${displayedScore} đ · tạm tính`
                  : 'Chưa có kết quả'}
              </span>
            </div>

            <div className="p-3 rounded-[8px] bg-[#F0F6FC] border border-[#C2DBF2]">
              <span className="text-[10px] text-[#1D6FC2] font-bold uppercase block tracking-wider">
                Minh chứng gửi
              </span>
              <span className="text-lg sm:text-xl font-bold font-heading text-[#1D6FC2] mt-0.5 block">
                {evidences.length} hồ sơ
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Breakdown by 5 Criteria (7 cols) */}
        <div className="lg:col-span-7 p-5 sm:p-6 rounded-[12px] border border-[#E8E8EC] bg-[#FFFFFF] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E8E8EC]">
            <span className="text-xs font-bold font-heading text-[#0A0A0A] uppercase tracking-wider">
              Tiến độ theo 5 khung tiêu chí
            </span>
            <Link
              to="/student/scores"
              className="text-xs text-[#1D6FC2] hover:text-[#175A9E] hover:underline font-semibold"
            >
              Mở phiếu chấm điểm →
            </Link>
          </div>

          <div className="space-y-4">
            {categorySummaries.map((c) => {
              const pct = Math.round((c.score / c.maxScore) * 100);
              const isCapped = isOfficialScore && c.score >= c.maxScore;
              return (
                <div key={c.category} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-[#0A0A0A]">{c.name}</span>
                      {isCapped && (
                        <span className="px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
                          ĐẠT TRẦN
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[#6B6B6B]">
                      <strong className={`font-bold ${isCapped ? 'text-[#92400E]' : 'text-[#0A0A0A]'}`}>
                        {c.hasScore ? c.score : '—'}
                      </strong>{' '}
                      / {c.maxScore} đ
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#F4F4F6] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isCapped ? 'bg-[#F59E0B]' : 'bg-[#1D6FC2]'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                    />
                  </div>
                  {isCapped && (
                    <p className="text-[10px] text-[#92400E]">
                      Khung này đã đạt trần quy định ({c.maxScore}đ). Minh chứng nộp thêm ở khung này sẽ không cộng dồn thêm.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-[#E8E8EC] flex items-center justify-between text-xs">
            <span className="text-[#6B6B6B]">Trạng thái xếp loại:</span>
            <span className="font-bold text-[#0A0A0A]">
              {isOfficialScore ? rankInfo.currentRank : 'Chờ công bố chính thức'}
            </span>
          </div>
        </div>
      </div>

      {/* 7. RECENT EVIDENCES SECTION */}
      <div className="rounded-[12px] border border-[#E8E8EC] bg-[#FFFFFF] overflow-hidden">
        <div className="p-4 px-6 border-b border-[#E8E8EC] bg-[#FAFAFA] flex items-center justify-between">
          <span className="text-xs font-bold font-heading text-[#0A0A0A] uppercase tracking-wider">
            Minh chứng gần đây
          </span>
          <Link
            to="/student/evidence"
            className="text-xs text-[#1D6FC2] hover:text-[#175A9E] hover:underline font-semibold"
          >
            Xem toàn bộ ({evidences.length}) →
          </Link>
        </div>

        <div className="divide-y divide-[#E8E8EC]">
          {isLoading ? (
            <div className="p-8 text-center text-[#6B6B6B] text-xs">Đang tải danh sách hồ sơ…</div>
          ) : evidences.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-xs font-semibold text-[#0A0A0A]">Chưa có minh chứng nào được đính kèm</p>
              <p className="text-xs text-[#6B6B6B]">
                Hãy mở phiếu chấm điểm rèn luyện để đính kèm giấy chứng nhận hoặc xác nhận tham gia.
              </p>
              <div className="pt-2">
                <Link
                  to="/student/scores"
                  className="inline-block px-4 py-2 bg-[#1D6FC2] hover:bg-[#175A9E] text-white font-semibold text-xs rounded-[6px] btn-primary-lift"
                >
                  Mở phiếu chấm điểm
                </Link>
              </div>
            </div>
          ) : (
            evidences.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className="p-3.5 px-6 hover:bg-[#FAFAFA] transition flex items-center justify-between gap-4 text-xs"
              >
                <div className="space-y-0.5 min-w-0">
                  <Link
                    to={`/student/evidence/${item.id}`}
                    className="font-semibold text-[#0A0A0A] hover:text-[#1D6FC2] block transition truncate"
                  >
                    {item.declaredActivityName}
                  </Link>
                  <span className="text-[11px] text-[#6B6B6B]">
                    {item.evidenceType} · Nộp ngày {new Date(item.submittedAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge status={item.status} />
                  <Link
                    to={`/student/evidence/${item.id}`}
                    className="px-2.5 py-1 text-[#1D6FC2] hover:bg-[#E1EDF9] rounded-[6px] border border-[#C2DBF2] transition font-semibold text-xs whitespace-nowrap"
                  >
                    Chi tiết
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 8. SCORE REPORT MODAL (Transcript Preview) */}
      {showScoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A0A0A]/40 backdrop-blur-xs">
          <div className="bg-[#FFFFFF] rounded-[12px] border border-[#E8E8EC] shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#FAFAFA] border-b border-[#E8E8EC] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src="/dut-logo.png"
                  alt="DUT Logo"
                  className="w-9 h-9 object-contain shrink-0"
                />
                <div>
                  <h3 className="text-sm font-bold font-heading text-[#0A0A0A]">
                    Bảng điểm rèn luyện sinh viên
                  </h3>
                  <p className="text-xs text-[#6B6B6B]">
                    Trường Đại học Bách Khoa – ĐH Đà Nẵng · {activeTerm.name}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1D6FC2] hover:bg-[#175A9E] text-white font-semibold text-xs rounded-[6px]"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>In / Xuất PDF</span>
                </button>
                <button
                  onClick={() => setShowScoreModal(false)}
                  className="p-1.5 text-[#6B6B6B] hover:text-[#0A0A0A] hover:bg-[#F4F4F6] rounded-[6px] transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Student info card */}
              <div className="bg-[#FAFAFA] border border-[#E8E8EC] rounded-[8px] p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[#6B6B6B] block">Họ và tên</span>
                  <span className="text-[#0A0A0A] font-bold text-xs">{user?.fullName}</span>
                </div>
                <div>
                  <span className="text-[#6B6B6B] block">Mã số sinh viên</span>
                  <span className="text-[#0A0A0A] font-semibold text-xs">{user?.studentCode || 'Chưa cập nhật'}</span>
                </div>
                <div>
                  <span className="text-[#6B6B6B] block">Lớp / Khoa</span>
                  <span className="text-[#0A0A0A] font-semibold text-xs">
                    {(user?.class as any)?.code || 'Chưa cập nhật'} · {user?.faculty?.name || 'Chưa cập nhật'}
                  </span>
                </div>
                <div className="sm:text-right">
                  <span className="text-[#6B6B6B] block">
                    {isOfficialScore ? 'Điểm chính thức' : 'Điểm tạm tính'}
                  </span>
                  <span
                    className={`${
                      isOfficialScore ? 'text-[#10B981]' : 'text-[#0A0A0A]'
                    } font-bold text-sm`}
                  >
                    {hasConfirmedScore ? `${displayedScore} / 100` : 'Chưa có điểm'}{' '}
                    ({isOfficialScore ? rankInfo.currentRank : 'Chưa xếp loại'})
                  </span>
                </div>
              </div>

              {/* 5 categories breakdown */}
              <div className="space-y-3">
                <span className="font-bold font-heading text-[#0A0A0A] uppercase text-xs tracking-wider block">
                  Chi tiết 5 khung tiêu chí đánh giá
                </span>
                {categorySummaries.map((cat, idx) => (
                  <div key={idx} className="border border-[#E8E8EC] rounded-[8px] p-3.5 bg-white space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#0A0A0A]">{cat.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#0A0A0A]">
                          {cat.hasScore ? `${cat.score} / ${cat.maxScore} đ` : `— / ${cat.maxScore} đ`}
                        </span>
                        {isOfficialScore && cat.score >= cat.maxScore && (
                          <span className="text-[10px] bg-[#ECFDF5] text-[#065F46] font-semibold px-2 py-0.5 rounded-[4px] border border-[#A7F3D0]">
                            Đạt trần
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="w-full h-2 bg-[#F4F4F6] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#1D6FC2] rounded-full"
                        style={{ width: `${Math.min(100, (cat.score / cat.maxScore) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-[#F0F6FC] border border-[#C2DBF2] rounded-[8px] flex items-center justify-between text-xs">
                <span className="text-[#12457A]">
                  Xem bảng điểm đầy đủ và chi tiết từng tiêu chí?
                </span>
                <Link
                  to="/student/scores"
                  onClick={() => setShowScoreModal(false)}
                  className="font-bold text-[#1D6FC2] hover:text-[#175A9E] hover:underline flex items-center gap-1"
                >
                  <span>Mở phiếu rèn luyện</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-[#FAFAFA] border-t border-[#E8E8EC] flex justify-end">
              <button
                onClick={() => setShowScoreModal(false)}
                className="px-4 py-2 bg-white hover:bg-[#FAFAFA] text-[#0A0A0A] font-semibold text-xs rounded-[6px] border border-[#E8E8EC] transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
