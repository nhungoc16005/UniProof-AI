import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/apiClient';
import { Evidence } from '../../types';
import { Scale, CheckCircle2, Clock, AlertCircle, Plus, ChevronRight, X, AlertTriangle } from 'lucide-react';

export const Appeals: React.FC = () => {
  const { user, activeTerm } = useAuth();
  const [appeals, setAppeals] = useState<any[]>([]);
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Create Appeal Modal
  const [showModal, setShowModal] = useState(false);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState('');
  const [reason, setReason] = useState('');
  const [desiredScore, setDesiredScore] = useState<number>(5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [appealList, evdList] = await Promise.all([
        apiClient.getAppeals(),
        apiClient.getEvidences({ studentId: user.id, termId: activeTerm.id }),
      ]);
      setAppeals(appealList);
      setEvidences(evdList);
      if (evdList.length > 0 && !selectedEvidenceId) {
        setSelectedEvidenceId(evdList[0].id);
      }
    } catch (err) {
      console.error('Lỗi tải danh sách khiếu nại', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user?.id, activeTerm.id]);

  const handleCreateAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvidenceId) {
      setErrorMsg('Vui lòng chọn hồ sơ minh chứng cần khiếu nại');
      return;
    }
    if (!reason.trim()) {
      setErrorMsg('Vui lòng nhập nội dung giải trình khiếu nại');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');
      const created = await apiClient.createAppeal({
        evidenceId: selectedEvidenceId,
        reason: reason.trim(),
        desiredScore: Number(desiredScore),
      });
      setAppeals([created, ...appeals]);
      setShowModal(false);
      setReason('');
      alert('Đã gửi đơn khiếu nại thành công! Cán bộ Khoa sẽ thẩm định và phản hồi trong thời hạn quy chế.');
    } catch (err: any) {
      console.error('Lỗi gửi khiếu nại', err);
      setErrorMsg(err.response?.data?.message || 'Không thể gửi khiếu nại. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* 1. Header */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-[#1d6fc2] mb-1.5 border border-blue-200/50">
            <Scale className="w-3 h-3" />
            <span>Quy chế ĐRL · Biểu mẫu S07 · {activeTerm.name}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Khiếu nại Kết quả Điểm Rèn Luyện
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gửi đơn giải trình và đề nghị thẩm định lại minh chứng nếu kết quả chấm điểm của Cán bộ chưa thỏa đáng.
          </p>
        </div>

        <button
          onClick={() => {
            if (evidences.length === 0) {
              alert('Bạn chưa có hồ sơ minh chứng nào trong học kỳ này để khiếu nại.');
              return;
            }
            setShowModal(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1d6fc2] hover:bg-[#175ea5] text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo đơn khiếu nại mới</span>
        </button>
      </div>

      {/* 2. Appeals List */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Lịch sử đơn khiếu nại ({appeals.length})
          </span>
          <span className="text-[11px] text-slate-500">
            Thời hạn giải quyết: Tối đa 03 ngày làm việc kể từ ngày nộp đơn
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400">Đang tải dữ liệu khiếu nại...</div>
        ) : appeals.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <Scale className="w-8 h-8 text-slate-300 mx-auto" />
            <p>Bạn chưa gửi đơn khiếu nại nào trong học kỳ này.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {appeals.map((apl) => {
              const activityName = apl.evidence?.declaredActivityName || apl.activityName || 'Hồ sơ minh chứng';
              const isApproved = apl.status === 'RESOLVED_APPROVED' || apl.status === 'ACCEPTED';
              const isRejected = apl.status === 'RESOLVED_REJECTED';

              return (
                <div key={apl.id} className="p-5 hover:bg-slate-50/50 transition space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-900">{activityName}</span>
                      <span className="text-[10px] text-slate-400 font-mono">ID: {apl.id}</span>
                    </div>

                    <div>
                      {isApproved ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Đã chấp thuận (+{apl.adjustedScore || apl.desiredScore || 0} điểm)</span>
                        </span>
                      ) : isRejected ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                          <span>Bác bỏ khiếu nại</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span>Đang chờ Cán bộ Khoa thụ lý</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-1">
                    <strong className="text-slate-900 block font-bold">Nội dung giải trình của sinh viên:</strong>
                    <p className="text-slate-600 leading-relaxed">{apl.reason || apl.content}</p>
                    {apl.desiredScore && (
                      <div className="text-[11px] font-bold text-blue-700 pt-1">
                        Điểm đề nghị công nhận: {apl.desiredScore} điểm
                      </div>
                    )}
                  </div>

                  {apl.resolutionNote && (
                    <div className={`text-xs p-3.5 rounded-xl border space-y-1 ${
                      isApproved
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}>
                      <strong className="block font-bold">Kết luận và phản hồi của Cán bộ Khoa:</strong>
                      <p className="leading-relaxed">{apl.resolutionNote}</p>
                    </div>
                  )}

                  <div className="text-[10px] text-slate-400">
                    Ngày gửi: {new Date(apl.createdAt).toLocaleString('vi-VN')}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Modal Tạo đơn khiếu nại mới */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">Tạo đơn khiếu nại điểm rèn luyện (Mẫu S07)</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-bold">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateAppeal} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Chọn hồ sơ minh chứng cần khiếu nại
                </label>
                <select
                  value={selectedEvidenceId}
                  onChange={(e) => setSelectedEvidenceId(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#1d6fc2] font-medium"
                >
                  {evidences.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.declaredActivityName} ({e.evidenceType} · {e.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mức điểm đề xuất công nhận
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  step={0.5}
                  value={desiredScore}
                  onChange={(e) => setDesiredScore(Number(e.target.value))}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#1d6fc2]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Lý do giải trình và căn cứ minh chứng
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Nêu rõ lý do tại sao mức điểm được duyệt chưa chính xác hoặc giấy tờ chứng chỉ hợp lệ..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#1d6fc2]"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[#1d6fc2] hover:bg-[#175ea5] text-white font-bold text-xs rounded-xl shadow-sm transition"
                >
                  {isSubmitting ? 'Đang gửi...' : 'Gửi đơn khiếu nại'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
