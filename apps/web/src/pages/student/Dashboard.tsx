import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/apiClient';
import { Evidence } from '../../types';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ScoreGauge } from '../../components/ui/ScoreGauge';

export const StudentDashboard: React.FC = () => {
  const { user, activeTerm } = useAuth();
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      apiClient.getEvidences({ studentId: user.id, termId: activeTerm.id }).then((data) => {
        setEvidences(data);
        setIsLoading(false);
      });
    }
  }, [user?.id, activeTerm.id]);

  // Calculations
  const officialScore = evidences
    .filter((e) => e.status === 'APPROVED')
    .reduce((sum, e) => {
      const revScore = e.reviews?.[0]?.finalScore || 0;
      return sum + revScore;
    }, 65); // baseline

  const pendingScore = evidences
    .filter((e) => e.status !== 'APPROVED' && e.status !== 'REJECTED' && e.status !== 'WITHDRAWN')
    .reduce((sum, e) => {
      const aiScore = e.aiSuggestions?.[0]?.suggestedScore || 0;
      return sum + aiScore;
    }, 0);

  const needsActionEvidences = evidences.filter((e) => e.status === 'NEEDS_SUPPLEMENT');

  return (
    <div className="space-y-6 pb-12">
      
      {/* 1. Clean Enterprise Hero Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1.5 max-w-xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            <span>{activeTerm.name}</span>
            <span className="text-slate-400">·</span>
            <span className="text-emerald-700 font-bold">Đang mở đợt đánh giá</span>
          </div>

          <h1 className="text-2xl font-extrabold text-slate-950 tracking-tight">
            Xin chào, {user?.fullName || 'Sinh viên'}
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            Mã số sinh viên: <strong className="text-slate-800">{user?.studentCode || '102210001'}</strong> · Khoa Công nghệ Thông tin · Lớp 21TCLC_DT1
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <Link
            to="/student/evidence/new"
            className="flex-1 sm:flex-initial text-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm shadow-blue-500/20 transition"
          >
            Nộp minh chứng mới
          </Link>

          <Link
            to="/student/what-can-i-claim"
            className="flex-1 sm:flex-initial text-center px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 shadow-sm transition"
          >
            Gợi ý tích lũy điểm
          </Link>
        </div>
      </div>

      {/* 2. Priority Notice (Cần bổ sung) */}
      {needsActionEvidences.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-amber-950 uppercase tracking-wider block">
              Hồ sơ cần bạn phản hồi ({needsActionEvidences.length})
            </span>
            <p className="text-xs text-amber-900">
              Có hồ sơ cán bộ yêu cầu bổ sung thông tin trước ngày 25/10/2026.
            </p>
          </div>
          <Link
            to={`/student/evidence/${needsActionEvidences[0].id}/supplement`}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg shadow-sm transition shrink-0"
          >
            Bổ sung hồ sơ ngay
          </Link>
        </div>
      )}

      {/* 3. Main Grid: Score Gauge + Progress Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Radial Score Gauge & Rank (Col 5) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center">
          <ScoreGauge
            score={officialScore}
            pendingScore={pendingScore}
            maxScore={100}
            targetRank="Xuất sắc"
            targetScore={90}
          />

          <div className="w-full grid grid-cols-2 gap-3 mt-6 pt-5 border-t border-slate-100 text-center">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">
                Điểm chính thức
              </span>
              <span className="text-xl font-black text-slate-900 mt-0.5 block">
                {officialScore} đ
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200">
              <span className="text-[10px] text-blue-700 font-bold uppercase block tracking-wider">
                Đang chờ xét duyệt
              </span>
              <span className="text-xl font-black text-blue-900 mt-0.5 block">
                +{pendingScore} đ
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Breakdown by Criteria (Col 7) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Tiến độ theo 5 khung tiêu chí
            </span>
            <Link to="/student/criteria" className="text-xs text-blue-600 hover:underline font-semibold">
              Chi tiết quy chế
            </Link>
          </div>

          <div className="space-y-3.5">
            {[
              { id: 'C01', name: 'Ý thức và kết quả học tập', current: 18, max: 20, pct: 90 },
              { id: 'C02', name: 'Ý thức chấp hành nội quy, quy chế', current: 22, max: 25, pct: 88 },
              { id: 'C03', name: 'Ý thức tham gia hoạt động chính trị - xã hội', current: 15, max: 20, pct: 75 },
              { id: 'C04', name: 'Phẩm chất công dân và quan hệ cộng đồng', current: 20, max: 25, pct: 80 },
              { id: 'C05', name: 'Ý thức tham gia phụ trách lớp, đoàn thể', current: 8, max: 10, pct: 80 },
            ].map((c) => (
              <div key={c.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">
                    {c.id} · {c.name}
                  </span>
                  <span className="font-mono text-slate-500">
                    <strong className="text-slate-900">{c.current}</strong> / {c.max} đ
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-300"
                    style={{ width: `${c.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Mục tiêu đạt loại Xuất sắc (≥ 90 điểm):</span>
            <span className="font-bold text-slate-900">Còn thiếu {(90 - officialScore).toFixed(1)} điểm</span>
          </div>
        </div>

      </div>

      {/* 4. Recent Evidences Section */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 px-6 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Minh chứng gần đây
          </span>
          <Link to="/student/evidence" className="text-xs text-blue-600 hover:underline font-semibold">
            Xem toàn bộ ({evidences.length})
          </Link>
        </div>

        <div className="divide-y divide-slate-100">
          {evidences.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Chưa có minh chứng nào được nộp trong kỳ này.
            </div>
          ) : (
            evidences.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className="p-4 px-6 hover:bg-slate-50/70 transition flex items-center justify-between gap-4 text-xs"
              >
                <div className="space-y-0.5">
                  <Link
                    to={`/student/evidence/${item.id}`}
                    className="font-bold text-slate-900 hover:text-blue-600 block transition"
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
                    className="px-2.5 py-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50/70 rounded-lg transition font-medium text-xs"
                  >
                    Xem chi tiết
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
};
