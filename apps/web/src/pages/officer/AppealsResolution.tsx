import React, { useState, useEffect } from 'react';
import { apiClient } from '../../lib/apiClient';
import { Appeal } from '../../types';
import { CheckCircle2, XCircle, Clock, AlertCircle, Search, Filter } from 'lucide-react';

export const AppealsResolution: React.FC = () => {
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'ACCEPTED' | 'REJECTED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedAppeal, setSelectedAppeal] = useState<Appeal | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [newScore, setNewScore] = useState<number>(4.0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadAppeals = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.getAppeals();
      setAppeals(data);
    } catch (err) {
      console.error('Không thể tải danh sách khiếu nại:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAppeals();
  }, []);

  const handleOpenModal = (apl: Appeal) => {
    setSelectedAppeal(apl);
    setNewScore(apl.requestedScore ?? 5.0);
    setDecisionNote('');
  };

  const handleResolve = async (action: 'ACCEPTED' | 'REJECTED') => {
    if (!selectedAppeal) return;
    if (!decisionNote.trim()) {
      alert('Vui lòng nhập lý do giải quyết khiếu nại!');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.resolveAppeal(selectedAppeal.id, {
        status: action,
        resolutionNote: decisionNote.trim(),
        adjustedScore: action === 'ACCEPTED' ? Number(newScore) : undefined,
      });

      alert(`Đã hoàn tất xử lý khiếu nại: ${action === 'ACCEPTED' ? 'Chấp thuận và cập nhật điểm' : 'Bác bỏ khiếu nại'}`);
      setSelectedAppeal(null);
      setDecisionNote('');
      await loadAppeals();
    } catch (err: any) {
      console.error('Lỗi khi giải quyết khiếu nại:', err);
      alert(err.response?.data?.message || 'Có lỗi xảy ra khi xử lý khiếu nại. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingCount = appeals.filter((a) => a.status === 'PENDING').length;
  const acceptedCount = appeals.filter((a) => a.status === 'ACCEPTED').length;
  const rejectedCount = appeals.filter((a) => a.status === 'REJECTED').length;

  const filteredAppeals = appeals.filter((a) => {
    if (filterStatus !== 'ALL' && a.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = a.student?.fullName?.toLowerCase().includes(q);
      const matchCode = a.student?.studentCode?.toLowerCase().includes(q);
      const matchAct = (a as any).evidence?.declaredActivityName?.toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchAct) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Xử lý khiếu nại điểm sinh viên</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Xem xét giải trình của sinh viên sau khi công bố kết quả rèn luyện và quyết định cập nhật điểm hoặc bảo lưu kết quả.
          </p>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div
          onClick={() => setFilterStatus('ALL')}
          className={`p-4 rounded-xl border cursor-pointer transition ${
            filterStatus === 'ALL' ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-200' : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Tổng đơn khiếu nại</div>
          <div className="text-2xl font-black text-slate-900">{appeals.length}</div>
          <span className="text-[10px] text-slate-500 font-medium">Toàn khoa trong kỳ</span>
        </div>

        <div
          onClick={() => setFilterStatus('PENDING')}
          className={`p-4 rounded-xl border cursor-pointer transition ${
            filterStatus === 'PENDING' ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-200' : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-amber-700 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Chờ giải quyết</span>
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          </div>
          <div className="text-2xl font-black text-amber-700">{pendingCount}</div>
          <span className="text-[10px] text-amber-600 font-medium">Cần cán bộ phản hồi</span>
        </div>

        <div
          onClick={() => setFilterStatus('ACCEPTED')}
          className={`p-4 rounded-xl border cursor-pointer transition ${
            filterStatus === 'ACCEPTED' ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-200' : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 mb-1">Đã chấp thuận</div>
          <div className="text-2xl font-black text-emerald-700">{acceptedCount}</div>
          <span className="text-[10px] text-emerald-600 font-medium">Đã cập nhật lại điểm</span>
        </div>

        <div
          onClick={() => setFilterStatus('REJECTED')}
          className={`p-4 rounded-xl border cursor-pointer transition ${
            filterStatus === 'REJECTED' ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-200' : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="text-[11px] font-bold uppercase tracking-wider text-rose-700 mb-1">Đã bác bỏ</div>
          <div className="text-2xl font-black text-rose-700">{rejectedCount}</div>
          <span className="text-[10px] text-rose-600 font-medium">Giữ nguyên kết quả cũ</span>
        </div>
      </div>

      {/* 2. Filter & Search Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          <button
            onClick={() => setFilterStatus('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              filterStatus === 'ALL' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Tất cả ({appeals.length})
          </button>
          <button
            onClick={() => setFilterStatus('PENDING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              filterStatus === 'PENDING' ? 'bg-amber-600 text-white' : 'text-amber-700 hover:bg-amber-50'
            }`}
          >
            Chờ xử lý ({pendingCount})
          </button>
          <button
            onClick={() => setFilterStatus('ACCEPTED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              filterStatus === 'ACCEPTED' ? 'bg-emerald-600 text-white' : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            Đã chấp thuận ({acceptedCount})
          </button>
          <button
            onClick={() => setFilterStatus('REJECTED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              filterStatus === 'REJECTED' ? 'bg-rose-600 text-white' : 'text-rose-700 hover:bg-rose-50'
            }`}
          >
            Đã bác bỏ ({rejectedCount})
          </button>
        </div>

        <div className="w-full sm:w-72 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Tìm theo MSSV, tên SV, hoạt động..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* 3. Appeals Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[760px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Sinh viên</th>
                <th className="py-3 px-4">Hoạt động khiếu nại</th>
                <th className="py-3 px-4">Nội dung giải trình</th>
                <th className="py-3 px-4 whitespace-nowrap">Điểm yêu cầu</th>
                <th className="py-3 px-4 whitespace-nowrap">Trạng thái</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Đang tải danh sách khiếu nại từ hệ thống...
                  </td>
                </tr>
              ) : filteredAppeals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Không có đơn khiếu nại nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filteredAppeals.map((apl) => {
                  const studentName = apl.student?.fullName || 'Sinh viên';
                  const studentCode = apl.student?.studentCode || 'N/A';
                  const activityName = (apl as any).evidence?.declaredActivityName || 'Hồ sơ minh chứng ĐRL';

                  return (
                    <tr key={apl.id} className="hover:bg-blue-50/20 transition">
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 block">{studentName}</span>
                        <span className="text-[11px] text-slate-500 font-mono">{studentCode}</span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {activityName}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 max-w-sm" title={apl.content}>
                        <p className="line-clamp-2 leading-relaxed">{apl.content}</p>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-blue-700 whitespace-nowrap">
                        {apl.requestedScore !== undefined ? `+${apl.requestedScore.toFixed(1)} đ` : '—'}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {apl.status === 'PENDING' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3" />
                            <span>Chờ xử lý</span>
                          </span>
                        ) : apl.status === 'ACCEPTED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Đã chấp thuận</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                            <XCircle className="w-3 h-3" />
                            <span>Đã bác bỏ</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {apl.status === 'PENDING' ? (
                          <button
                            onClick={() => handleOpenModal(apl)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm shadow-blue-500/20 transition text-xs"
                          >
                            Giải quyết
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenModal(apl)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition text-xs"
                          >
                            Xem chi tiết
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Xử lý Khiếu nại */}
      {selectedAppeal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">
                {selectedAppeal.status === 'PENDING' ? 'Xử lý đơn khiếu nại' : 'Chi tiết kết quả khiếu nại'}
              </h3>
              <button
                onClick={() => setSelectedAppeal(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1.5 border border-slate-200">
              <div>
                Sinh viên: <strong className="text-slate-900">{selectedAppeal.student?.fullName || 'Sinh viên'}</strong> ({selectedAppeal.student?.studentCode || 'N/A'})
              </div>
              <div>
                Hoạt động: <strong className="text-slate-900">{(selectedAppeal as any).evidence?.declaredActivityName || 'Hồ sơ minh chứng'}</strong>
              </div>
              <div>
                Điểm sinh viên đề xuất: <strong className="text-blue-700">+{selectedAppeal.requestedScore ?? 0} đ</strong>
              </div>
              <div className="pt-1 text-slate-700 leading-relaxed">
                Giải trình của SV: <em className="text-slate-900">"{selectedAppeal.content}"</em>
              </div>
            </div>

            {selectedAppeal.status === 'PENDING' ? (
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-700">Điểm sau khi giải quyết (nếu chấp thuận):</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="20"
                    value={newScore}
                    onChange={(e) => setNewScore(parseFloat(e.target.value) || 0)}
                    className="w-24 p-1.5 border border-slate-200 rounded-lg font-bold text-center text-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Kết luận & Căn cứ giải quyết (Gửi cho sinh viên):
                  </label>
                  <textarea
                    rows={3}
                    value={decisionNote}
                    onChange={(e) => setDecisionNote(e.target.value)}
                    placeholder="Ghi rõ lý do chấp thuận hoặc căn cứ quy chế bác khiếu nại..."
                    className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-xs"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleResolve('REJECTED')}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold rounded-lg text-xs transition"
                  >
                    Bác khiếu nại
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleResolve('ACCEPTED')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-lg text-xs transition"
                  >
                    Chấp thuận & Cập nhật điểm
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 space-y-1">
                  <div className="font-semibold text-blue-900">
                    Kết luận của Cán bộ: {selectedAppeal.status === 'ACCEPTED' ? 'Đã chấp thuận' : 'Đã bác bỏ'}
                  </div>
                  {selectedAppeal.adjustedScore !== undefined && (
                    <div className="text-emerald-700 font-bold">
                      Điểm được duyệt cập nhật: +{selectedAppeal.adjustedScore} đ
                    </div>
                  )}
                  <div className="text-slate-600">
                    Ghi chú: {selectedAppeal.resolutionNote || 'Không có ghi chú thêm.'}
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedAppeal(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
