import React, { useState, useEffect } from 'react';
import { Term } from '../../types';
import { apiClient } from '../../lib/apiClient';
import { Plus, Lock, AlertTriangle, Building, X, Calendar } from 'lucide-react';

export const TermsMasterData: React.FC = () => {
  const [terms, setTerms] = useState<Term[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'TERMS' | 'FACULTIES' | 'CLASSES'>('TERMS');

  const loadTerms = async () => {
    try {
      setIsLoading(true);
      const data = await apiClient.getTerms();
      setTerms(data);
    } catch (err) {
      console.error('Lỗi tải danh sách học kỳ', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTerms();
  }, []);

  // Modal Tạo kỳ mới
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formSubmissionDeadline, setFormSubmissionDeadline] = useState('');
  const [formReviewDeadline, setFormReviewDeadline] = useState('');
  const [formAppealDeadline, setFormAppealDeadline] = useState('');
  const [formStatus, setFormStatus] = useState<'UPCOMING' | 'ACTIVE' | 'REVIEWING' | 'CLOSED'>('UPCOMING');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formCode) {
      alert('Vui lòng nhập tên và mã kỳ');
      return;
    }
    try {
      setIsSubmitting(true);
      await apiClient.createTerm({
        name: formName.trim(),
        code: formCode.trim().toUpperCase(),
        startDate: formStartDate || new Date().toISOString(),
        endDate: formEndDate || new Date(Date.now() + 120 * 86400000).toISOString(),
        submissionDeadline: formSubmissionDeadline || new Date(Date.now() + 30 * 86400000).toISOString(),
        reviewDeadline: formReviewDeadline || new Date(Date.now() + 45 * 86400000).toISOString(),
        appealDeadline: formAppealDeadline || new Date(Date.now() + 60 * 86400000).toISOString(),
        status: formStatus,
      });
      setShowCreateModal(false);
      await loadTerms();
      alert('Đã tạo kỳ đánh giá mới thành công!');
    } catch (err: any) {
      console.error('Lỗi tạo kỳ', err);
      alert(err.response?.data?.message || 'Không thể tạo kỳ đánh giá.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: any) => {
    try {
      if (newStatus === 'CLOSED') {
        if (!window.confirm('CẢNH BÁO: Khi chốt kỳ (CLOSED), sinh viên không thể nộp thêm minh chứng và điểm sẽ được đóng băng. Bạn có chắc chắn?')) {
          return;
        }
        await apiClient.closeTerm(id);
      } else {
        await apiClient.updateTerm(id, { status: newStatus });
      }
      await loadTerms();
    } catch (err) {
      console.error('Lỗi đổi trạng thái học kỳ', err);
      alert('Không thể cập nhật trạng thái học kỳ.');
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'UPCOMING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>Sắp diễn ra (UPCOMING)</span>
          </span>
        );
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Mở nộp minh chứng (ACTIVE)</span>
          </span>
        );
      case 'REVIEWING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span>Đang chấm & khiếu nại (REVIEWING)</span>
          </span>
        );
      case 'CLOSED':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <Lock className="w-3 h-3 text-slate-500" />
            <span>Đã chốt sổ (CLOSED)</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Dữ liệu nền & Kỳ đánh giá (A03)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cấu hình vòng đời 4 bước: Chuẩn bị $\rightarrow$ Mở nộp $\rightarrow$ Chấm & Khiếu nại $\rightarrow$ Chốt sổ điểm chính thức.
          </p>
        </div>

        <button
          onClick={() => {
            setFormName('');
            setFormCode('');
            setShowCreateModal(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-xl shadow-sm transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo kỳ đánh giá mới</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('TERMS')}
          className={`py-2 px-4 text-xs font-bold border-b-2 transition ${
            activeTab === 'TERMS'
              ? 'border-sky-600 text-sky-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Kỳ đánh giá học kỳ
        </button>
        <button
          onClick={() => setActiveTab('FACULTIES')}
          className={`py-2 px-4 text-xs font-bold border-b-2 transition ${
            activeTab === 'FACULTIES'
              ? 'border-sky-600 text-sky-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Danh mục Khoa / Viện
        </button>
        <button
          onClick={() => setActiveTab('CLASSES')}
          className={`py-2 px-4 text-xs font-bold border-b-2 transition ${
            activeTab === 'CLASSES'
              ? 'border-sky-600 text-sky-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Danh mục Lớp sinh hoạt
        </button>
      </div>

      {activeTab === 'TERMS' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-xs text-amber-900 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block mb-0.5">Vòng đời Kỳ học ĐRL chuẩn ĐHBK:</strong>
              1. <strong>UPCOMING</strong>: Đang chuẩn bị, chưa cho sinh viên nộp · 2. <strong>ACTIVE</strong>: Sinh viên đang nộp minh chứng · 3. <strong>REVIEWING</strong>: Hết hạn SV nộp, Cán bộ đang chấm duyệt & hội đồng giải quyết khiếu nại · 4. <strong>CLOSED</strong>: Khóa toàn bộ dữ liệu, đóng băng điểm chính thức.
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="text-center py-10 text-xs text-slate-400">Đang tải danh sách học kỳ...</div>
            ) : terms.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400">Chưa có học kỳ nào.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Tên kỳ đánh giá</th>
                      <th className="py-3 px-4">Mã kỳ</th>
                      <th className="py-3 px-4">Hạn nộp của SV</th>
                      <th className="py-3 px-4">Hạn duyệt Cán bộ</th>
                      <th className="py-3 px-4">Hạn khiếu nại</th>
                      <th className="py-3 px-4">Trạng thái</th>
                      <th className="py-3 px-4 text-right">Chuyển vòng đời</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {terms.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-4 font-bold text-slate-900">{t.name}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">{t.code}</td>
                        <td className="py-3.5 px-4 text-slate-600 font-medium">
                          {t.submissionDeadline ? new Date(t.submissionDeadline).toLocaleDateString('vi-VN') : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-medium">
                          {t.reviewDeadline ? new Date(t.reviewDeadline).toLocaleDateString('vi-VN') : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-medium">
                          {t.appealDeadline ? new Date(t.appealDeadline).toLocaleDateString('vi-VN') : '—'}
                        </td>
                        <td className="py-3.5 px-4">
                          {renderStatusBadge(t.status)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <select
                            value={t.status}
                            onChange={(e) => handleUpdateStatus(t.id, e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 font-bold text-[11px] bg-white text-slate-800 shadow-2xs focus:outline-none focus:border-sky-500 cursor-pointer"
                          >
                            <option value="UPCOMING">Sắp diễn ra (UPCOMING)</option>
                            <option value="ACTIVE">Mở nộp SV (ACTIVE)</option>
                            <option value="REVIEWING">Chấm & khiếu nại (REVIEWING)</option>
                            <option value="CLOSED">Chốt sổ (CLOSED)</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}


      {activeTab === 'FACULTIES' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm text-xs space-y-3">
          <span className="font-bold text-slate-800 text-sm">Danh sách các Khoa thuộc Trường</span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {['Khoa Công nghệ Thông tin (CNTT)', 'Khoa Điện - Điện tử (DDT)', 'Khoa Cơ khí (CK)', 'Khoa Xây dựng (XD)', 'Khoa Hóa (H)'].map((f, i) => (
              <div key={i} className="p-3 bg-slate-50 border rounded-lg font-medium text-slate-800 flex items-center gap-2">
                <Building className="w-4 h-4 text-sky-600" />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'CLASSES' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm text-xs space-y-3">
          <span className="font-bold text-slate-800 text-sm">Danh sách Lớp sinh hoạt mẫu</span>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
            {['21TCLC_DT1', '21TCLC_DT2', '22T_DT1', '22T_DT2', '23T_DT1'].map((c, i) => (
              <div key={i} className="p-3 bg-slate-50 border rounded-lg font-mono font-bold text-slate-800">
                {c}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Tạo kỳ đánh giá mới */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-sky-600" />
                <h3 className="font-bold text-slate-800 text-sm">Tạo Kỳ Đánh Giá ĐRL Mới</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTerm} className="py-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên kỳ học *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Học kỳ 2 (2026-2027)"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-sky-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mã kỳ (Code) *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: 2026_2"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-mono border border-slate-200 rounded-xl focus:outline-none focus:border-sky-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Trạng thái khởi tạo</label>
                  <select
                    value={formStatus}
                    onChange={(e: any) => setFormStatus(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-sky-600"
                  >
                    <option value="UPCOMING">Sắp diễn ra (UPCOMING)</option>
                    <option value="ACTIVE">Mở nộp SV ngay (ACTIVE)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Hạn nộp minh chứng (SV)</label>
                  <input
                    type="date"
                    value={formSubmissionDeadline}
                    onChange={(e) => setFormSubmissionDeadline(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-sky-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Hạn duyệt (Cán bộ)</label>
                  <input
                    type="date"
                    value={formReviewDeadline}
                    onChange={(e) => setFormReviewDeadline(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-sky-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Hạn chót khiếu nại</label>
                <input
                  type="date"
                  value={formAppealDeadline}
                  onChange={(e) => setFormAppealDeadline(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-sky-600"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
                >
                  {isSubmitting ? 'Đang tạo...' : 'Tạo kỳ đánh giá'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
