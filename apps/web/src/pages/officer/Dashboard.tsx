import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/apiClient';
import { Evidence } from '../../types';

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
      
      {/* 1. Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1.5 max-w-xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
            <span>Kỳ {activeTerm.name}</span>
            <span className="text-slate-300">·</span>
            <span className="text-blue-700 font-bold">{completionRate}% đã hoàn tất</span>
          </div>

          <h1 className="text-2xl font-extrabold text-slate-950 tracking-tight">
            Trung tâm Điều hành & Thẩm định
          </h1>

          <p className="text-xs text-slate-500 leading-relaxed">
            Cán bộ: <strong className="text-slate-800">{user.fullName}</strong> · Khoa Công nghệ Thông tin
          </p>
        </div>

        {/* Rapid Action Buttons */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {firstPending && (
            <button
              onClick={() => navigate(`/officer/review/${firstPending.id}`)}
              className="flex-1 sm:flex-initial px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm shadow-blue-500/20 transition"
            >
              Tiếp tục duyệt hồ sơ kế tiếp
            </button>
          )}

          <Link
            to="/officer/queue"
            className="flex-1 sm:flex-initial px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 shadow-sm transition text-center"
          >
            Hàng đợi xét duyệt
          </Link>
        </div>
      </div>

      {/* 2. Cockpit KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Cần duyệt ngay (L3–L5)</span>
          </div>
          <div className="text-3xl font-black text-amber-600">{pendingCount}</div>
          <p className="text-[11px] text-slate-500">Hồ sơ chỉ có giấy chứng nhận ảnh</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-xs font-bold uppercase tracking-wider">Fast-Track Sẵn sàng</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="text-3xl font-black text-emerald-600">{fastTrackCount}</div>
          <p className="text-[11px] text-emerald-700 font-medium">Khớp cơ sở dữ liệu (L1/L2)</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700">Chờ sinh viên bổ sung</span>
          </div>
          <div className="text-3xl font-black text-blue-600">{supplementCount}</div>
          <p className="text-[11px] text-slate-500">Đã gửi yêu cầu kèm hạn chót</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-700">Đã chốt điểm kỳ này</span>
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
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Hồ sơ ưu tiên xử lý trong ngày
              </span>
            </div>
            <Link 
              to="/officer/queue" 
              className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
            >
              Xem tất cả ({evidences.length})
            </Link>
          </div>

          <div className="space-y-3">
            {evidences.slice(0, 4).map((item) => {
              const verifLvl = item.verificationResults?.[0]?.verificationLevel || 3;
              const isFastTrack = (verifLvl === 1 || verifLvl === 2) && item.status !== 'APPROVED';

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-blue-50/30 hover:border-blue-200 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isFastTrack && (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          Fast-track
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
                    className="shrink-0 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm shadow-blue-500/20 transition"
                  >
                    Xem xét duyệt
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
              Phân hệ nghiệp vụ
            </span>

            <div className="space-y-2 text-xs">
              <Link
                to="/officer/queue"
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-blue-50/60 hover:text-blue-700 hover:border-blue-300 transition font-semibold text-slate-700"
              >
                <span>Hàng đợi thẩm định hồ sơ minh chứng</span>
                <span className="text-slate-400 font-mono text-[11px]">→</span>
              </Link>
              <Link
                to="/officer/students"
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-blue-50/60 hover:text-blue-700 hover:border-blue-300 transition font-semibold text-slate-700"
              >
                <span>Quản lý điểm rèn luyện theo Lớp & Xuất Excel</span>
                <span className="text-slate-400 font-mono text-[11px]">→</span>
              </Link>
              <Link
                to="/officer/appeals"
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-blue-50/60 hover:text-blue-700 hover:border-blue-300 transition font-semibold text-slate-700"
              >
                <span>Xử lý khiếu nại điểm sinh viên</span>
                <span className="text-slate-400 font-mono text-[11px]">→</span>
              </Link>
              <Link
                to="/officer/activities"
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-blue-50/60 hover:text-blue-700 hover:border-blue-300 transition font-semibold text-slate-700"
              >
                <span>Quản lý hoạt động nội bộ & Điểm danh</span>
                <span className="text-slate-400 font-mono text-[11px]">→</span>
              </Link>
            </div>
          </div>

          {/* Quick RAG Assistant Shortcut */}
          <div className="p-5 bg-gradient-to-br from-blue-900 to-slate-900 text-white rounded-2xl shadow-md space-y-2">
            <span className="text-xs font-bold text-blue-300 uppercase tracking-wider block">
              Trợ lý RAG Quy chế ĐRL
            </span>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Cần tra cứu nhanh khung điểm hoặc quy định trần tiêu chí? Hãy hỏi trực tiếp AI RAG Assistant.
            </p>
            <Link
              to="/regulations/ask"
              className="inline-block text-xs text-blue-200 font-bold hover:underline pt-1"
            >
              Hỏi đáp quy chế ngay →
            </Link>
          </div>

        </div>

      </div>

    </div>
  );
};
