import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/apiClient';
import { Evidence } from '../../types';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ScoreGauge } from '../../components/ui/ScoreGauge';
import { 
  Award, 
  UploadCloud, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle, 
  ArrowRight, 
  Calendar,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Target,
  Trophy,
  Flame
} from 'lucide-react';

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

  // Tính toán điểm chính thức và điểm đang chờ duyệt
  const officialScore = evidences
    .filter((e) => e.status === 'APPROVED')
    .reduce((sum, e) => {
      const revScore = e.reviews?.[0]?.finalScore || 0;
      return sum + revScore;
    }, 65); // baseline điểm rèn luyện nền tảng

  const pendingScore = evidences
    .filter((e) => e.status !== 'APPROVED' && e.status !== 'REJECTED' && e.status !== 'WITHDRAWN')
    .reduce((sum, e) => {
      const aiScore = e.aiSuggestions?.[0]?.suggestedScore || 0;
      return sum + aiScore;
    }, 0);

  // Việc cần làm
  const needsActionEvidences = evidences.filter((e) => e.status === 'NEEDS_SUPPLEMENT');

  return (
    <div className="space-y-6">
      
      {/* 1. Header Banner with Subtle Gradient & Glassmorphism */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-sky-800 via-indigo-900 to-slate-900 text-white p-6 shadow-md">
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-sky-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-48 h-48 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-white/10 backdrop-blur-md text-sky-200 border border-white/15">
              <Calendar className="w-3.5 h-3.5" />
              <span>{activeTerm.name}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-1" />
              <span className="text-emerald-300">Đang mở nộp</span>
            </div>

            <h1 className="text-2xl font-black tracking-tight mt-2">
              Xin chào, {user?.fullName || 'Sinh viên'}! 👋
            </h1>
            <p className="text-xs text-sky-200/90 max-w-xl">
              Chào mừng bạn đến với cổng quản trị điểm rèn luyện. Hãy tiếp tục tích lũy minh chứng để hoàn thành mục tiêu rèn luyện kỳ này.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/student/evidence/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all duration-200 transform hover:-translate-y-0.5"
            >
              <UploadCloud className="w-4 h-4" />
              <span>+ Nộp minh chứng mới</span>
            </Link>

            <Link
              to="/student/what-can-i-claim"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white font-semibold text-xs rounded-xl border border-white/20 transition"
            >
              <Sparkles className="w-4 h-4 text-sky-300" />
              <span>Gợi ý claim điểm</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Score Summary: Radial Gauge & Vibrant Progress Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Radial Score Gauge (4 cols) */}
        <div className="lg:col-span-5 flex flex-col">
          <ScoreGauge
            score={officialScore}
            maxScore={100}
            pendingScore={pendingScore}
            className="flex-1"
          />
        </div>

        {/* Criteria Progress (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between card-hover-lift">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-600" />
                Tiến độ tích lũy 5 Khung Tiêu chí
              </span>
              <Link to="/student/criteria" className="text-xs font-semibold text-sky-600 hover:underline flex items-center gap-0.5">
                <span>Xem quy chế trần</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-4">
              
              {/* Khung I */}
              <div>
                <div className="flex justify-between items-center text-xs font-semibold mb-1.5">
                  <span className="text-slate-800">Khung I: Ý thức học tập (C01)</span>
                  <span className="font-bold text-sky-700">18 / 20 đ</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5">
                  <div className="h-full bg-gradient-to-r from-sky-500 to-indigo-600 rounded-full transition-all duration-700" style={{ width: '90%' }} />
                </div>
              </div>

              {/* Khung II */}
              <div>
                <div className="flex justify-between items-center text-xs font-semibold mb-1.5">
                  <span className="text-slate-800 flex items-center gap-1.5">
                    <span>Khung II: Ý thức chấp hành pháp luật & nội quy (C02)</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                      Đạt trần 🏆
                    </span>
                  </span>
                  <span className="font-bold text-emerald-700">25 / 25 đ</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-700" style={{ width: '100%' }} />
                </div>
              </div>

              {/* Khung III */}
              <div>
                <div className="flex justify-between items-center text-xs font-semibold mb-1.5">
                  <span className="text-slate-800">Khung III: Hoạt động Văn thể mỹ & Tình nguyện (C03)</span>
                  <span className="font-bold text-amber-700">12 / 20 đ (còn thiếu 8đ)</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5">
                  <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-700" style={{ width: '60%' }} />
                </div>
              </div>

              {/* Khung IV */}
              <div>
                <div className="flex justify-between items-center text-xs font-semibold mb-1.5">
                  <span className="text-slate-800">Khung IV: Phẩm chất công dân & Cộng đồng (C04)</span>
                  <span className="font-bold text-sky-700">10 / 25 đ</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5">
                  <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-700" style={{ width: '40%' }} />
                </div>
              </div>

            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>* Điểm được cộng dồn sau khi Cán bộ phê duyệt chính thức.</span>
            <Link to="/student/scores" className="text-sky-600 font-bold hover:underline">
              Truy vết "Vì sao được điểm?" →
            </Link>
          </div>
        </div>

      </div>

      {/* 3. Action Alert: Việc cần làm & Evidence Gap Checklist */}
      {needsActionEvidences.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50/70 border border-amber-300/80 rounded-2xl p-5 shadow-sm space-y-3 card-hover-lift">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-black text-amber-900 text-xs uppercase tracking-wider">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Việc cần làm ngay: {needsActionEvidences.length} hồ sơ cần bổ sung giấy tờ</span>
            </div>
            <span className="text-[11px] font-bold text-amber-800 bg-amber-200/60 px-2.5 py-0.5 rounded-full">
              Hạn chót: 15/10/2026
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {needsActionEvidences.map((evd) => (
              <div
                key={evd.id}
                className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm flex flex-col justify-between gap-3"
              >
                <div>
                  <h4 className="text-xs font-bold text-slate-900">{evd.declaredActivityName}</h4>
                  <p className="text-[11px] text-amber-900 font-medium mt-1 bg-amber-50 p-2 rounded-lg border border-amber-200/60">
                    "{evd.supplementRequests?.[0]?.missingItem || 'Cần bổ sung thẻ đeo hoặc email xác nhận từ đơn vị tổ chức.'}"
                  </p>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-slate-400">Yêu cầu từ Cán bộ Khoa</span>
                  <Link
                    to={`/student/evidence/${evd.id}`}
                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg shadow-sm transition"
                  >
                    Bổ sung ngay →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Hồ sơ minh chứng gần đây */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4 card-hover-lift">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Hồ sơ minh chứng đã nộp ({evidences.length})
            </span>
          </div>
          <Link to="/student/evidence" className="text-xs font-bold text-sky-600 hover:underline flex items-center gap-1">
            <span>Quản lý toàn bộ danh sách</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="divide-y divide-slate-100">
          {evidences.map((item) => (
            <div key={item.id} className="py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/70 rounded-xl px-3 transition">
              <div className="space-y-1">
                <Link to={`/student/evidence/${item.id}`} className="text-xs font-bold text-slate-900 hover:text-sky-600 transition block">
                  {item.declaredActivityName}
                </Link>
                <div className="flex items-center gap-3 text-[11px] text-slate-500">
                  <span>Ngày nộp: {new Date(item.submittedAt).toLocaleDateString('vi-VN')}</span>
                  <span>·</span>
                  <span className="font-medium text-slate-600">{item.evidenceType}</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <StatusBadge status={item.status} />
                <Link
                  to={`/student/evidence/${item.id}`}
                  className="px-3 py-1 text-xs font-bold text-sky-700 hover:bg-sky-50 rounded-lg border border-sky-200 transition"
                >
                  Xem chi tiết
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
