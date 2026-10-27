import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/apiClient';
import { Evidence } from '../../types';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ScoreGauge } from '../../components/ui/ScoreGauge';
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
  Sparkles,
} from 'lucide-react';


export const StudentDashboard: React.FC = () => {
  const { user, activeTerm } = useAuth();
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [scoreSummary, setScoreSummary] = useState<any>(null);
  const [assessmentSubmission, setAssessmentSubmission] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showScoreModal, setShowScoreModal] = useState(false);

  useEffect(() => {
    if (!user?.id || !activeTerm.id) return;
    setIsLoading(true);
    setLoadError('');
    Promise.all([
      apiClient.getEvidences({ studentId: user.id, termId: activeTerm.id }),
      apiClient.getConductDashboard(activeTerm.id),
      apiClient.getMyAssessments(activeTerm.id),
    ]).then(([evidenceList, summary, rubric]) => {
      setEvidences(evidenceList);
      setScoreSummary(summary);
      setAssessmentSubmission(rubric.submission);
    }).catch(() => {
      setLoadError('Không tải được dữ liệu điểm và minh chứng từ máy chủ. Vui lòng thử lại.');
    }).finally(() => setIsLoading(false));
  }, [user?.id, activeTerm.id]);

  // Kiểm tra thời hạn nộp điểm rèn luyện
  const isSubmissionOpen = useMemo(() => {
    if (!activeTerm) return false;
    if (activeTerm.status !== 'ACTIVE') return false;
    if (activeTerm.submissionDeadline) {
      return new Date() <= new Date(activeTerm.submissionDeadline);
    }
    return true;
  }, [activeTerm]);

  const formattedDeadline = useMemo(() => {
    if (!activeTerm?.submissionDeadline) return 'Chưa công bố';
    try {
      return new Date(activeTerm.submissionDeadline).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return activeTerm.submissionDeadline;
    }
  }, [activeTerm]);

  // Điểm và phân bổ theo khung chỉ lấy từ Backend; FE không tự quyết định điểm.
  const isOfficialScore = scoreSummary?.officialScore !== null && scoreSummary?.officialScore !== undefined;
  const displayedScore = Number(scoreSummary?.officialScore ?? scoreSummary?.scoreInProgress ?? 0);
  const totalRubricCriteria = (scoreSummary?.categories || []).reduce((total: number, category: any) => total + (category.criteria?.length || 0), 0);
  const hasConfirmedScore = isOfficialScore || (scoreSummary?.status === 'IN_PROGRESS' && Number(scoreSummary.pendingCriteriaCount) < totalRubricCriteria);
  const categorySummaries: { category: string; name: string; score: number; maxScore: number; hasScore: boolean }[] = (scoreSummary?.categories || []).map((category: any) => ({
    category: category.key,
    name: category.name,
    hasScore: isOfficialScore || category.criteria?.some((criterion: any) => criterion.assessment?.status === 'FINALIZED'),
    score: isOfficialScore || category.criteria?.some((criterion: any) => criterion.assessment?.status === 'FINALIZED') ? Number(category.score ?? 0) : 0,
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
      currentRank: !scoreSummary?.classification || scoreSummary.classification === 'CHUA_XEP_LOAI' ? 'Chưa xếp loại' : scoreSummary.classification,
      currentRankColor: 'text-slate-700 bg-slate-50 border-slate-200',
      pct: hasConfirmedScore ? Math.min(100, Math.max(0, displayedScore)) : 0,
    };
  }, [displayedScore, hasConfirmedScore, isOfficialScore, scoreSummary]);

  return (
      <div className="space-y-6 pb-12 font-sans">
      {loadError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{loadError}</div>}
      {/* 1. Hero Banner: Thông tin động & Lối tắt nhanh */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.05)] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 max-w-xl z-10">
          <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100/90 text-slate-700 border border-slate-200/60">
            <span>{activeTerm.name}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
            Xin chào, {user?.fullName || 'Sinh viên'}
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            Mã sinh viên: <strong className="text-slate-800 font-bold">{user?.studentCode || 'Chưa cập nhật'}</strong> · {user?.faculty?.name || (user?.class as any)?.faculty?.name || 'Chưa cập nhật'} · Lớp {(user?.class as any)?.code || (user?.class as any)?.name || 'Chưa cập nhật'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto z-10">
          <Link
            to="/student/scores"
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#1d6fc2] hover:bg-[#175ea5] active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Chấm điểm & nộp minh chứng</span>
          </Link>

          <button
            onClick={() => setShowScoreModal(true)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-white hover:bg-slate-50 active:scale-[0.99] text-slate-700 font-bold text-xs rounded-xl border border-slate-200 shadow-xs transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Bảng điểm & In</span>
          </button>
        </div>
      </div>

      {assessmentSubmission && (
        <div className={`rounded-xl border p-4 text-sm ${assessmentSubmission.status === 'RETURNED' ? 'border-orange-200 bg-orange-50 text-orange-900' : assessmentSubmission.status === 'SUBMITTED' ? 'border-blue-200 bg-blue-50 text-blue-900' : 'border-slate-200 bg-white text-slate-700'}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <strong>{assessmentSubmission.status === 'SUBMITTED' ? 'Phiếu đang chờ cán bộ xử lý' : assessmentSubmission.status === 'RETURNED' ? 'Phiếu cần chỉnh sửa' : 'Phiếu tự đánh giá'}</strong>
              {assessmentSubmission.status === 'RETURNED' && assessmentSubmission.returnReason && <p className="mt-1">Lý do: {assessmentSubmission.returnReason}</p>}
              {assessmentSubmission.status === 'SUBMITTED' && assessmentSubmission.submittedAt && <p className="mt-1">Đã nộp {new Date(assessmentSubmission.submittedAt).toLocaleString('vi-VN')}</p>}
            </div>
            {assessmentSubmission.status === 'RETURNED' && <Link to="/student/scores" className="rounded-lg bg-orange-700 px-3 py-2 text-xs font-bold text-white">Chỉnh sửa phiếu</Link>}
          </div>
        </div>
      )}

      {/* 2. Thống Kê Nhanh Hồ Sơ & Hạn Chót (Quick Status Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Hạn chót */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Hạn chót nộp hồ sơ</span>
            <Calendar className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-lg font-black text-slate-900 font-mono">
            {formattedDeadline}
          </div>
          <p className="text-[11px] text-slate-500 truncate flex items-center gap-1.5">
            {isSubmissionOpen ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0" />
                <span>Đang trong thời hạn nộp</span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block shrink-0" />
                <span>Đã kết thúc nhận hồ sơ</span>
              </>
            )}
          </p>
        </div>

        {/* Card 2: Đã duyệt */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Đã phê duyệt</span>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg font-black text-emerald-700 font-mono">
            {approvedEvidences.length} <span className="text-xs font-normal text-slate-400">hồ sơ</span>
          </div>
          <p className="text-[11px] text-slate-500">
            {isOfficialScore ? <>Điểm chính thức: <strong className="text-emerald-700 font-bold">{displayedScore} điểm</strong></> : hasConfirmedScore ? <>Tổng điểm tiêu chí đã chốt tạm thời: <strong className="text-slate-700 font-bold">{displayedScore} điểm · chưa chốt</strong></> : 'Chưa có điểm tiêu chí được xác nhận'}
          </p>
        </div>

        {/* Card 3: Chờ duyệt */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-[#1d6fc2]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Đang chờ duyệt</span>
            <Clock className="w-4 h-4 text-[#1d6fc2]" />
          </div>
          <div className="text-lg font-black text-blue-900 font-mono">
            {pendingEvidences.length} <span className="text-xs font-normal text-slate-400">hồ sơ</span>
          </div>
            <p className="text-[11px] text-slate-500">Điểm chỉ được cập nhật sau quyết định chính thức.</p>
        </div>

        {/* Card 4: Cần bổ sung */}
        <div
          className={`bg-white border rounded-2xl p-4 shadow-xs space-y-1 ${
            needsActionEvidences.length > 0 ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200/90'
          }`}
        >
          <div className="flex items-center justify-between text-amber-600">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Cần bổ sung</span>
            <AlertCircle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-lg font-black text-amber-800 font-mono">
            {needsActionEvidences.length} <span className="text-xs font-normal text-slate-400">hồ sơ</span>
          </div>
          <p className="text-[11px] text-slate-500 truncate">
            {needsActionEvidences.length > 0 ? (
              <Link to="/student/evidence" className="text-amber-800 font-bold underline">
                Bổ sung hồ sơ ngay
              </Link>
            ) : (
              'Không có yêu cầu bổ sung'
            )}
          </p>
        </div>
      </div>

      {/* 3. Priority Notice (Hồ sơ cần bổ sung chi tiết) */}
      {needsActionEvidences.length > 0 && (
        <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-bold text-amber-900 uppercase tracking-wider block">
              Hồ sơ cần bạn bổ sung minh chứng ({needsActionEvidences.length})
            </span>
            <p className="text-xs text-amber-800 leading-relaxed">
              Cán bộ thẩm định đã yêu cầu bổ sung thông tin hoặc ảnh gốc rõ hơn trước khi kỳ đánh giá đóng.
            </p>
          </div>
          <Link
            to={`/student/evidence/${needsActionEvidences[0].id}/supplement`}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-sm transition shrink-0"
          >
            Bổ sung hồ sơ ngay
          </Link>
        </div>
      )}

      {/* 4. Milestone Tracker Card (Thanh mốc xếp loại điểm rèn luyện) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.05)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
              Lộ trình xếp loại rèn luyện
            </span>
            <span className="text-[11px] text-slate-500">
              Điểm và xếp loại được cung cấp bởi hệ thống.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Xếp loại hiện tại:</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold border ${rankInfo.currentRankColor}`}>
              {isOfficialScore ? `${rankInfo.currentRank} (${displayedScore} đ)` : 'Chưa có kết quả chính thức'}
            </span>
          </div>
        </div>

        {/* Visual Progress Track with Milestones */}
        <div className="pt-4 pb-2 px-2">
          {/* Milestone markers */}
          <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-[#1d6fc2] rounded-full transition-all duration-500 relative"
              style={{ width: `${Math.min(100, Math.max(0, rankInfo.pct))}%` }}
            />
          </div>

          <p className="mt-2 text-right text-xs text-slate-500">{hasConfirmedScore ? `${displayedScore} / 100 điểm${isOfficialScore ? '' : ' · tổng tạm tính, chưa phải điểm chính thức'}` : 'Chưa có điểm tiêu chí được xác nhận'}</p>
        </div>

        {/* Motivational Callout */}
        <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <p className="text-blue-900 leading-relaxed">
            Xếp loại hiện tại: <strong className="font-bold">{rankInfo.currentRank}</strong>. Thông tin được lấy từ Backend.
          </p>

          <Link
            to="/student/scores"
            className="px-3.5 py-1.5 bg-[#1d6fc2] hover:bg-[#175ea5] text-white font-bold rounded-lg shrink-0 transition shadow-xs text-center inline-flex items-center gap-1.5"
          >
            <span>Chấm điểm & nộp minh chứng</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* 4. Main Grid: Score Gauge + Progress Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Radial Score Gauge & Rank (Col 5) */}
        <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.05)] flex flex-col items-center justify-center">
          <ScoreGauge
            score={displayedScore}
            classification={rankInfo.currentRank}
            maxScore={100}
            isOfficial={isOfficialScore}
            hasScore={hasConfirmedScore}
          />

          <div className="w-full grid grid-cols-2 gap-3 mt-6 pt-5 border-t border-slate-100 text-center">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">
                {isOfficialScore ? 'Điểm chính thức' : 'Điểm đang tính'}
              </span>
              <span className="text-xl font-black text-slate-900 mt-0.5 block">
                {isOfficialScore ? `${displayedScore} đ` : hasConfirmedScore ? `${displayedScore} đ · tạm tính` : 'Chưa có dữ liệu điểm'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200/70">
              <span className="text-[10px] text-[#1d6fc2] font-bold uppercase block tracking-wider">
                Đang chờ duyệt
              </span>
              <span className="text-xl font-black text-blue-900 mt-0.5 block">
                {pendingEvidences.length} hồ sơ
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Breakdown by Criteria (Col 7) */}
        <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.05)] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Tiến độ theo 5 khung tiêu chí
            </span>
            <Link to="/student/scores" className="text-xs text-[#1d6fc2] hover:underline font-semibold">
              Xem bảng điểm
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
                      <span className="font-semibold text-slate-800">
                        {c.name}
                      </span>
                      {isCapped && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                          ĐÃ ĐẠT TRẦN
                        </span>
                      )}
                    </div>
                <span className="font-mono text-slate-500">
                      <strong className={`font-bold ${isCapped ? 'text-amber-800' : 'text-slate-900'}`}>{c.hasScore ? c.score : '—'}</strong> / {c.maxScore} đ
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${isCapped ? 'bg-amber-500' : 'bg-[#1d6fc2]'}`}
                      style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                    />
                  </div>
                  {isCapped && (
                    <p className="text-[10px] text-amber-700 italic">
                      Khung này đã đạt điểm tối đa quy định ({c.maxScore}đ). Minh chứng nộp thêm ở khung này sẽ không cộng dồn vào tổng điểm.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Xếp loại hiện tại</span>
            <span className="font-bold text-slate-900">{rankInfo.currentRank}</span>
          </div>
        </div>

      </div>

      {/* 5. Recent Evidences Section */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_4px_24px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="p-4 px-6 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Minh chứng gần đây
          </span>
          <Link to="/student/evidence" className="text-xs text-[#1d6fc2] hover:underline font-semibold">
            Xem toàn bộ ({evidences.length})
          </Link>
        </div>

        <div className="divide-y divide-slate-100">
          {isLoading ? (
            <div className="p-8 text-center text-slate-400 text-xs">Đang tải dữ liệu hồ sơ...</div>
          ) : evidences.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <p className="text-xs font-bold text-slate-700">Chưa có minh chứng nào được nộp</p>
              <p className="text-[11px] text-slate-400">Hãy nộp giấy chứng nhận, giấy khen hoặc xác nhận hoạt động để tích lũy điểm.</p>
              <div className="pt-2">
                <Link
                  to="/student/scores"
                  className="inline-block px-4 py-2 bg-[#1d6fc2] hover:bg-[#175ea5] text-white font-bold text-xs rounded-xl shadow-sm transition"
                >
                  Mở phiếu chấm điểm & nộp minh chứng
                </Link>
              </div>
            </div>
          ) : (
            evidences.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className="p-4 px-6 hover:bg-blue-50/25 transition duration-150 flex items-center justify-between gap-4 text-xs"
              >
                <div className="space-y-0.5">
                  <Link
                    to={`/student/evidence/${item.id}`}
                    className="font-bold text-slate-900 hover:text-[#1d6fc2] block transition leading-snug"
                  >
                    {item.declaredActivityName}
                  </Link>
                  <span className="text-[11px] text-slate-400">
                    {item.evidenceType} · Nộp ngày {new Date(item.submittedAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <StatusBadge status={item.status} />
                  <Link
                    to={`/student/evidence/${item.id}`}
                    className="px-3 py-1.5 text-[#1d6fc2] hover:bg-blue-50 rounded-lg border border-blue-200 transition font-semibold text-xs whitespace-nowrap"
                  >
                    Chi tiết
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 6. Score Report Modal Preview (S09 Integrated) */}
      {showScoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src="/dut-logo.png"
                  alt="DUT Logo"
                  className="w-10 h-10 object-contain shrink-0"
                />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Bảng điểm rèn luyện & Truy vết (S09)</h3>
                  <p className="text-[11px] text-slate-500">Trường Đại học Bách Khoa – ĐH Đà Nẵng · {activeTerm.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1d6fc2] hover:bg-[#175ea5] text-white font-semibold text-xs rounded-lg shadow-sm transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>In / Xuất PDF</span>
                </button>
                <button
                  onClick={() => setShowScoreModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Student info card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                <div>
                  <span className="text-slate-400 block font-medium">Họ và tên sinh viên</span>
                  <span className="text-slate-900 font-bold text-xs">{user?.fullName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Mã số sinh viên (MSSV)</span>
                  <span className="text-slate-900 font-semibold text-xs">{user?.studentCode || 'Chưa cập nhật'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Lớp sinh hoạt / Khoa</span>
                  <span className="text-slate-900 font-semibold text-xs">{(user?.class as any)?.code || 'Chưa cập nhật'} · {user?.faculty?.name || 'Chưa cập nhật'}</span>
                </div>
                <div className="sm:text-right">
                  <span className="text-slate-400 block font-medium">{isOfficialScore ? 'Tổng điểm chính thức' : 'Tổng điểm tạm tính'}</span>
                  <span className={`${isOfficialScore ? 'text-emerald-700' : 'text-slate-700'} font-black text-sm`}>
                    {hasConfirmedScore ? `${displayedScore} / 100` : 'Chưa có điểm'} ({isOfficialScore ? rankInfo.currentRank : 'Chưa xếp loại'})
                  </span>
                </div>
              </div>

              {/* 5 categories breakdown */}
              <div className="space-y-3">
                <span className="font-bold text-slate-900 uppercase text-[11px] tracking-wider block">
                  Chi tiết 5 khung đánh giá ĐRL
                </span>
                {categorySummaries.map((cat, idx) => (
                  <div key={idx} className="border border-slate-200 rounded-xl p-3.5 bg-white space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">{cat.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">
                          {cat.hasScore ? `${cat.score} / ${cat.maxScore} đ` : `— / ${cat.maxScore} đ`}
                        </span>
                        {isOfficialScore && cat.score >= cat.maxScore && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded">
                            Đạt trần
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#1d6fc2] rounded-full"
                        style={{ width: `${Math.min(100, (cat.score / cat.maxScore) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs">
                <span className="text-blue-900">
                  Cần xem toàn trang hoặc lịch sử kỳ trước?
                </span>
                <Link
                  to="/student/scores"
                  onClick={() => setShowScoreModal(false)}
                  className="font-bold text-[#1d6fc2] hover:underline flex items-center gap-1"
                >
                  <span>Mở trang Bảng điểm đầy đủ</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowScoreModal(false)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition"
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
