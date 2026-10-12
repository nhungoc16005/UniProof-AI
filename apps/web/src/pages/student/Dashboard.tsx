import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/apiClient';
import { Evidence } from '../../types';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ScoreGauge } from '../../components/ui/ScoreGauge';
import { Printer, FileText, X, CheckCircle, ChevronRight, Award } from 'lucide-react';

import { calculateStudentConductScore } from '../../lib/ruleEngine';

export const StudentDashboard: React.FC = () => {
  const { user, activeTerm } = useAuth();
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showScoreModal, setShowScoreModal] = useState(false);

  useEffect(() => {
    if (user?.id) {
      apiClient.getEvidences({ studentId: user.id, termId: activeTerm.id }).then((data) => {
        setEvidences(data);
        setIsLoading(false);
      });
    }
  }, [user?.id, activeTerm.id]);

  // Rule Engine Calculations (Bậc thang & khống chế trần từng khung)
  const { categorySummaries, totalAiScore, totalOfficialScore } = useMemo(() => {
    return calculateStudentConductScore(evidences);
  }, [evidences]);

  const officialScore = totalOfficialScore;
  const pendingScore = Math.max(0, +(totalAiScore - totalOfficialScore).toFixed(1));

  const needsActionEvidences = useMemo(() => {
    return evidences.filter((e) => e.status === 'NEEDS_SUPPLEMENT');
  }, [evidences]);

  // Milestone Rank Calculation
  const rankInfo = useMemo(() => {
    const s = officialScore;
    if (s >= 90) {
      return {
        currentRank: 'Xuất sắc',
        currentRankColor: 'text-purple-600 bg-purple-50 border-purple-200',
        nextRank: null,
        pointsNeeded: 0,
        pct: 100,
      };
    }
    if (s >= 80) {
      return {
        currentRank: 'Tốt',
        currentRankColor: 'text-blue-600 bg-blue-50 border-blue-200',
        nextRank: 'Xuất sắc',
        nextScore: 90,
        pointsNeeded: +(90 - s).toFixed(1),
        pct: 80 + ((s - 80) / 10) * 20,
      };
    }
    if (s >= 65) {
      return {
        currentRank: 'Khá',
        currentRankColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        nextRank: 'Tốt',
        nextScore: 80,
        pointsNeeded: +(80 - s).toFixed(1),
        pct: 65 + ((s - 65) / 15) * 15,
      };
    }
    if (s >= 50) {
      return {
        currentRank: 'Trung bình',
        currentRankColor: 'text-amber-700 bg-amber-50 border-amber-200',
        nextRank: 'Khá',
        nextScore: 65,
        pointsNeeded: +(65 - s).toFixed(1),
        pct: 50 + ((s - 50) / 15) * 15,
      };
    }
    return {
      currentRank: 'Yếu / Kém',
      currentRankColor: 'text-rose-700 bg-rose-50 border-rose-200',
      nextRank: 'Trung bình',
      nextScore: 50,
      pointsNeeded: +(50 - s).toFixed(1),
      pct: (s / 50) * 50,
    };
  }, [officialScore]);

  return (
    <div className="space-y-6 pb-12">
      
      {/* 1. Hero Banner with Soft Gradient & Layered Shadow */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.05)] flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 max-w-xl z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100/90 text-slate-700 border border-slate-200/60">
            <span>{activeTerm.name}</span>
            <span className="text-slate-300">·</span>
            <span className="text-emerald-700 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Đang mở đợt nhận minh chứng
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
            Xin chào, {user?.fullName || 'Sinh viên'}
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            Mã sinh viên: <strong className="text-slate-800 font-bold">{user?.studentCode || '102210001'}</strong> · Khoa Công nghệ Thông tin · Lớp 21TCLC_DT1
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto z-10">
          <Link
            to="/student/evidence/new"
            className="flex-1 sm:flex-initial text-center px-4 py-2.5 bg-[#1d6fc2] hover:bg-[#175ea5] active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition cursor-pointer"
          >
            Nộp minh chứng mới
          </Link>

          <button
            onClick={() => setShowScoreModal(true)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-white hover:bg-slate-50 active:scale-[0.99] text-slate-700 font-bold text-xs rounded-xl border border-slate-200 shadow-sm transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Bảng điểm & In</span>
          </button>
        </div>
      </div>

      {/* 2. Priority Notice (Hồ sơ cần bổ sung) */}
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

      {/* 3. Milestone Tracker Card (Thanh mốc xếp loại điểm rèn luyện) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.05)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
              Lộ trình xếp loại rèn luyện
            </span>
            <span className="text-[11px] text-slate-500">
              Quy chế Đánh giá Kết quả Rèn luyện Sinh viên theo khung 100 điểm
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Xếp loại hiện tại:</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold border ${rankInfo.currentRankColor}`}>
              {rankInfo.currentRank} ({officialScore} đ)
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

          {/* Milestone points */}
          <div className="relative w-full flex justify-between text-[11px] mt-2 text-slate-400 font-semibold">
            <div className="text-left">
              <span className="block font-bold text-slate-700">0</span>
              <span className="text-[10px]">Kém</span>
            </div>
            <div className="text-center">
              <span className="block font-bold text-slate-700">50</span>
              <span className="text-[10px]">Trung bình</span>
            </div>
            <div className="text-center">
              <span className="block font-bold text-slate-700">65</span>
              <span className="text-[10px]">Khá</span>
            </div>
            <div className="text-center">
              <span className="block font-bold text-slate-700">80</span>
              <span className="text-[10px]">Tốt</span>
            </div>
            <div className="text-right">
              <span className="block font-bold text-[#1d6fc2]">90</span>
              <span className="text-[10px] text-[#1d6fc2] font-bold">Xuất sắc</span>
            </div>
          </div>
        </div>

        {/* Motivational Callout */}
        <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <p className="text-blue-900 leading-relaxed">
            {rankInfo.nextRank ? (
              <>
                Bạn hiện đang đạt mức <strong className="font-bold">{rankInfo.currentRank}</strong> ({officialScore} điểm). 
                Chỉ cần tích lũy thêm <strong className="font-bold text-[#1d6fc2] underline">{rankInfo.pointsNeeded} điểm</strong> nữa 
                để chính thức thăng hạng lên danh hiệu <strong className="font-bold text-[#1d6fc2]">{rankInfo.nextRank} ({rankInfo.nextScore} điểm)</strong>!
              </>
            ) : (
              <>
                Chúc mừng bạn đã xuất sắc đạt ngưỡng điểm tối đa của danh hiệu <strong className="font-bold text-purple-700">Xuất sắc (≥ 90 điểm)</strong> trong học kỳ này!
              </>
            )}
          </p>

          {rankInfo.nextRank && (
            <Link
              to="/student/what-can-i-claim"
              className="px-3 py-1.5 bg-[#1d6fc2] hover:bg-[#175ea5] text-white font-bold rounded-lg shrink-0 transition shadow-xs text-center"
            >
              Xem hoạt động tích điểm ngay
            </Link>
          )}
        </div>
      </div>

      {/* 4. Main Grid: Score Gauge + Progress Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Radial Score Gauge & Rank (Col 5) */}
        <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.05)] flex flex-col items-center justify-center">
          <ScoreGauge
            score={officialScore}
            pendingScore={pendingScore}
            maxScore={100}
            targetRank="Xuất sắc"
            targetScore={90}
          />

          <div className="w-full grid grid-cols-2 gap-3 mt-6 pt-5 border-t border-slate-100 text-center">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">
                Điểm chính thức
              </span>
              <span className="text-xl font-black text-slate-900 mt-0.5 block">
                {officialScore} đ
              </span>
            </div>

            <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200/70">
              <span className="text-[10px] text-[#1d6fc2] font-bold uppercase block tracking-wider">
                Đang chờ duyệt
              </span>
              <span className="text-xl font-black text-blue-900 mt-0.5 block">
                +{pendingScore} đ
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
            <Link to="/student/criteria" className="text-xs text-[#1d6fc2] hover:underline font-semibold">
              Chi tiết khung điểm
            </Link>
          </div>

          <div className="space-y-4">
            {categorySummaries.map((c) => {
              const pct = Math.round((c.officialScore / c.maxScore) * 100);
              return (
                <div key={c.category} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">
                      {c.name}
                    </span>
                    <span className="font-mono text-slate-500">
                      <strong className="text-slate-900 font-bold">{c.officialScore}</strong> / {c.maxScore} đ
                      {c.aiScore > c.officialScore && (
                        <span className="text-[#1d6fc2] ml-1.5 text-[11px] font-semibold">
                          (Dự kiến AI: {c.aiScore}đ)
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#1d6fc2] rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Mục tiêu đạt loại Xuất sắc (≥ 90 điểm):</span>
            <span className="font-bold text-slate-900">
              {officialScore >= 90 ? 'Đã đạt' : `Còn thiếu ${(90 - officialScore).toFixed(1)} điểm`}
            </span>
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
                  to="/student/evidence/new"
                  className="inline-block px-4 py-2 bg-[#1d6fc2] hover:bg-[#175ea5] text-white font-bold text-xs rounded-xl shadow-sm transition"
                >
                  Nộp minh chứng ngay
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
                  className="w-10 h-10 object-contain rounded-xl p-0.5 bg-white border border-slate-200 shadow-xs shrink-0"
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
                  <span className="text-slate-900 font-semibold text-xs">{user?.studentCode || '102210001'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Lớp sinh hoạt / Khoa</span>
                  <span className="text-slate-900 font-semibold text-xs">21TCLC_DT1 · CNTT</span>
                </div>
                <div className="sm:text-right">
                  <span className="text-slate-400 block font-medium">Tổng điểm chính thức</span>
                  <span className="text-emerald-700 font-black text-sm">
                    {officialScore} / 100 ({rankInfo.currentRank})
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
                          {cat.officialScore} / {cat.maxScore} đ
                        </span>
                        {cat.officialScore >= cat.maxScore && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded">
                            Đạt trần
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#1d6fc2] rounded-full"
                        style={{ width: `${Math.min(100, (cat.officialScore / cat.maxScore) * 100)}%` }}
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
