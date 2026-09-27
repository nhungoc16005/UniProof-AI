import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/apiClient';
import { Evidence } from '../../types';
import { 
  Inbox, 
  CheckCircle, 
  AlertTriangle, 
  Scale, 
  ArrowRight, 
  Calendar, 
  Users, 
  BarChart3,
  Clock,
  Sparkles,
  Zap,
  Play,
  TrendingUp,
  ShieldCheck,
  CheckCheck
} from 'lucide-react';

export const OfficerDashboard: React.FC = () => {
  const { user, activeTerm } = useAuth();
  const navigate = useNavigate();
  const [evidences, setEvidences] = useState<Evidence[]>([]);

  useEffect(() => {
    apiClient.getEvidences({ termId: activeTerm.id }).then(setEvidences);
  }, [activeTerm.id]);

  const pendingCount = evidences.filter((e) => e.status === 'NEEDS_HUMAN_REVIEW' || e.status === 'PROCESSING').length;
  const fastTrackCount = evidences.filter((e) => {
    const lvl = e.verificationResults?.[0]?.verificationLevel || 3;
    return (lvl === 1 || lvl === 2) && e.status !== 'APPROVED';
  }).length;
  const supplementCount = evidences.filter((e) => e.status === 'NEEDS_SUPPLEMENT').length;
  const approvedCount = evidences.filter((e) => e.status === 'APPROVED').length;
  const totalCount = evidences.length;
  const completionRate = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0;

  // First pending evidence for quick start
  const firstPending = evidences.find((e) => e.status === 'NEEDS_HUMAN_REVIEW' || e.status === 'VERIFIED');

  return (
    <div className="space-y-6 pb-12">
      
      {/* 1. Header Cockpit Hero Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 max-w-xl z-10">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800 font-bold">
              OFFICER CONTROL COCKPIT · O01
            </span>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-sky-400" />
              <span>Kỳ: <strong>{activeTerm.name}</strong></span>
            </span>
          </div>

          <h1 className="text-2xl font-black tracking-tight text-white">
            Trung tâm Điều hành & Thẩm định — {user.fullName}
          </h1>

          <p className="text-xs text-slate-400">
            Phụ trách thẩm định: <strong className="text-slate-200">Khoa Công nghệ Thông tin</strong> · Tiến độ kỳ: <strong className="text-emerald-400">{completionRate}% đã hoàn tất</strong>
          </p>
        </div>

        {/* Rapid Action Buttons */}
        <div className="flex items-center gap-3 z-10 w-full sm:w-auto">
          {firstPending && (
            <button
              onClick={() => navigate(`/officer/review/${firstPending.id}`)}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg transition"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Tiếp tục duyệt hồ sơ kế tiếp</span>
            </button>
          )}

          <Link
            to="/officer/queue"
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition"
          >
            <Inbox className="w-4 h-4 text-sky-400" />
            <span>Mở Hàng đợi (O02)</span>
          </Link>
        </div>

        {/* Background glow overlay */}
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-sky-500/10 to-transparent pointer-events-none" />
      </div>

      {/* 2. Cockpit KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Cần duyệt ngay (L3-L5)</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-amber-600">{pendingCount}</div>
          <p className="text-[11px] text-slate-500">Hồ sơ chỉ có giấy chứng nhận ảnh</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
              <Zap className="w-4 h-4" />
              <span>Fast-Track Sẵn sàng</span>
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-600">{fastTrackCount}</div>
          <p className="text-[11px] text-emerald-700 font-medium">Khớp cơ sở dữ liệu (L1/L2)</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Chờ sinh viên bổ sung</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-indigo-600">{supplementCount}</div>
          <p className="text-[11px] text-slate-500">Đã gửi yêu cầu kèm hạn chót</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Đã chốt điểm kỳ này</span>
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <CheckCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-teal-700">{approvedCount}</div>
          <p className="text-[11px] text-teal-700 font-medium">{completionRate}% khối lượng hoàn thành</p>
        </div>

      </div>

      {/* 3. Main Grid: Priority Cases & Control Modules */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: High Priority Queue Preview (Col 8) */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Hồ sơ ưu tiên xử lý trong ngày
              </span>
            </div>
            <Link 
              to="/officer/queue" 
              className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1"
            >
              <span>Xem tất cả ({evidences.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {evidences.slice(0, 4).map((item) => {
              const verifLvl = item.verificationResults?.[0]?.verificationLevel || 3;
              const isFastTrack = (verifLvl === 1 || verifLvl === 2) && item.status !== 'APPROVED';

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-sky-300 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isFastTrack && (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          <span>Fast-track</span>
                        </span>
                      )}
                      <span className="font-bold text-xs text-slate-900">{item.declaredActivityName}</span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span>Sinh viên: <strong className="text-slate-800">{item.student?.fullName || 'Nguyễn Văn An'}</strong></span>
                      <span>·</span>
                      <span className="font-mono">{item.student?.studentCode || '102210001'}</span>
                      <span>·</span>
                      <span>Nộp: {new Date(item.submittedAt).toLocaleDateString('vi-VN')}</span>
                    </div>
                  </div>

                  <Link
                    to={`/officer/review/${item.id}`}
                    className="shrink-0 px-4 py-2 bg-slate-900 hover:bg-sky-600 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5"
                  >
                    <span>Mở Split-View</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Rapid Access Modules (Col 4) */}
        <div className="lg:col-span-4 space-y-4">
          
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block pb-2 border-b border-slate-100">
              Phân hệ chức năng nghiệp vụ
            </span>

            <div className="space-y-2 text-xs">
              <Link
                to="/officer/activities"
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-sky-50 hover:text-sky-800 hover:border-sky-300 transition font-semibold text-slate-700"
              >
                <span>Quản lý hoạt động nội bộ & Điểm danh (O06)</span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </Link>
              <Link
                to="/officer/appeals"
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-purple-50 hover:text-purple-800 hover:border-purple-300 transition font-semibold text-slate-700"
              >
                <span>Xử lý khiếu nại điểm sinh viên (O07)</span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </Link>
              <Link
                to="/officer/students"
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition font-semibold text-slate-700"
              >
                <span>Tra cứu bảng điểm sinh viên (O09)</span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </Link>
              <Link
                to="/officer/reports"
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition font-semibold text-slate-700"
              >
                <span>Báo cáo thống kê & Xuất Excel (O10)</span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </Link>
            </div>
          </div>

          {/* Quick RAG Assistant Shortcut */}
          <div className="p-4 bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl shadow-md space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-sky-400">
              <Sparkles className="w-4 h-4" />
              <span>Trợ lý RAG Quy chế ĐRL</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Cần tra cứu nhanh khung điểm hoặc quy định trần tiêu chí? Hãy hỏi trực tiếp AI RAG Assistant.
            </p>
            <Link
              to="/regulations/ask"
              className="inline-flex items-center gap-1.5 text-xs text-sky-300 font-bold hover:underline pt-1"
            >
              <span>Hỏi đáp quy chế ngay</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

        </div>

      </div>

    </div>
  );
};
