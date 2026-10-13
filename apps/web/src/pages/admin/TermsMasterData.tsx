import React, { useState, useEffect } from 'react';
import { Term, Faculty, Class } from '../../types';
import { apiClient } from '../../lib/apiClient';
import {
  Plus,
  Lock,
  Unlock,
  Building,
  GraduationCap,
  X,
  Calendar,
  Edit2,
  ShieldAlert,
} from 'lucide-react';

export const TermsMasterData: React.FC = () => {
  const [terms, setTerms] = useState<Term[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'TERMS' | 'FACULTIES' | 'CLASSES'>('TERMS');

  // Load master data
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

  const loadFacultiesAndClasses = async () => {
    try {
      const [facList, classList] = await Promise.all([
        apiClient.getFaculties(),
        apiClient.getClasses(),
      ]);
      setFaculties(facList);
      setClasses(classList);
    } catch (err) {
      console.error('Lỗi tải dữ liệu Khoa và Lớp', err);
    }
  };

  useEffect(() => {
    loadTerms();
    loadFacultiesAndClasses();
  }, []);

  // Format ngày tháng sạch sẽ
  const formatDate = (isoString?: string) => {
    if (!isoString) return '—';
    const d = new Date(isoString);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Xác định trạng thái tự động theo thời gian thực
  const getStatusBadge = (term: Term) => {
    if (term.status === 'CLOSED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600">
          <Lock className="w-3 h-3 text-slate-400" />
          <span>Đã chốt sổ</span>
        </span>
      );
    }

    const now = new Date();
    const startDate = term.startDate ? new Date(term.startDate) : null;
    const subDeadline = term.submissionDeadline ? new Date(term.submissionDeadline) : null;
    const revDeadline = term.reviewDeadline ? new Date(term.reviewDeadline) : null;
    const appDeadline = term.appealDeadline ? new Date(term.appealDeadline) : null;

    if (startDate && now < startDate) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          <span>Sắp diễn ra</span>
        </span>
      );
    }

    if (subDeadline && now <= subDeadline) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>Đang mở nộp</span>
        </span>
      );
    }

    if (revDeadline && now <= revDeadline) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          <span>Đang chấm duyệt</span>
        </span>
      );
    }

    if (appDeadline && now <= appDeadline) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-50 text-indigo-700">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          <span>Khiếu nại</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-700">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
        <span>Hết hạn - Chờ chốt</span>
      </span>
    );
  };

  // Modal Tạo kỳ mới
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formSubmissionDeadline, setFormSubmissionDeadline] = useState('');
  const [formReviewDeadline, setFormReviewDeadline] = useState('');
  const [formAppealDeadline, setFormAppealDeadline] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initDefaultDates = () => {
    const today = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    const start = new Date(today);
    const sub = new Date(today);
    sub.setDate(sub.getDate() + 30);
    const rev = new Date(sub);
    rev.setDate(rev.getDate() + 15);
    const app = new Date(rev);
    app.setDate(app.getDate() + 10);

    setFormStartDate(toYMD(start));
    setFormSubmissionDeadline(toYMD(sub));
    setFormReviewDeadline(toYMD(rev));
    setFormAppealDeadline(toYMD(app));
  };

  const handleOpenCreateModal = () => {
    setFormName('');
    setFormCode('');
    initDefaultDates();
    setShowCreateModal(true);
  };

  const handleCreateTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formCode.trim()) {
      alert('Vui lòng nhập tên và mã kỳ');
      return;
    }
    try {
      setIsSubmitting(true);
      await apiClient.createTerm({
        name: formName.trim(),
        code: formCode.trim().toUpperCase(),
        startDate: new Date(formStartDate).toISOString(),
        endDate: new Date(formAppealDeadline).toISOString(),
        submissionDeadline: new Date(formSubmissionDeadline).toISOString(),
        reviewDeadline: new Date(formReviewDeadline).toISOString(),
        appealDeadline: new Date(formAppealDeadline).toISOString(),
        status: 'ACTIVE',
      });
      setShowCreateModal(false);
      await loadTerms();
    } catch (err: any) {
      console.error('Lỗi tạo kỳ', err);
      alert(err.response?.data?.message || 'Không thể tạo kỳ đánh giá.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Modal Sửa hạn
  const [editingTerm, setEditingTerm] = useState<Term | null>(null);
  const [editSubmissionDeadline, setEditSubmissionDeadline] = useState('');
  const [editReviewDeadline, setEditReviewDeadline] = useState('');
  const [editAppealDeadline, setEditAppealDeadline] = useState('');
  const [isUpdatingDeadline, setIsUpdatingDeadline] = useState(false);

  const handleOpenEditModal = (t: Term) => {
    setEditingTerm(t);
    const toYMD = (iso?: string) => {
      if (!iso) return '';
      const d = new Date(iso);
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };
    setEditSubmissionDeadline(toYMD(t.submissionDeadline));
    setEditReviewDeadline(toYMD(t.reviewDeadline));
    setEditAppealDeadline(toYMD(t.appealDeadline));
  };

  const handleSaveDeadlines = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTerm) return;
    try {
      setIsUpdatingDeadline(true);
      await apiClient.updateTerm(editingTerm.id, {
        submissionDeadline: editSubmissionDeadline ? new Date(editSubmissionDeadline).toISOString() : undefined,
        reviewDeadline: editReviewDeadline ? new Date(editReviewDeadline).toISOString() : undefined,
        appealDeadline: editAppealDeadline ? new Date(editAppealDeadline).toISOString() : undefined,
      });
      setEditingTerm(null);
      await loadTerms();
    } catch (err: any) {
      console.error('Lỗi gia hạn kỳ', err);
      alert(err.response?.data?.message || 'Không thể cập nhật mốc thời gian.');
    } finally {
      setIsUpdatingDeadline(false);
    }
  };

  // Modal Chốt sổ
  const [closingTerm, setClosingTerm] = useState<Term | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  const handleConfirmClose = async () => {
    if (!closingTerm) return;
    try {
      setIsClosing(true);
      await apiClient.closeTerm(closingTerm.id);
      setClosingTerm(null);
      await loadTerms();
    } catch (err: any) {
      console.error('Lỗi chốt sổ kỳ', err);
      alert(err.response?.data?.message || 'Không thể chốt sổ kỳ đánh giá.');
    } finally {
      setIsClosing(false);
    }
  };

  // Modal Mở lại kỳ
  const [reopeningTerm, setReopeningTerm] = useState<Term | null>(null);
  const [reopenReason, setReopenReason] = useState('Mở lại kỳ đánh giá theo quyết định hội đồng');
  const [isReopening, setIsReopening] = useState(false);

  const handleConfirmReopen = async () => {
    if (!reopeningTerm || !reopenReason.trim()) return;
    try {
      setIsReopening(true);
      await apiClient.reopenTerm(reopeningTerm.id, reopenReason.trim());
      setReopeningTerm(null);
      await loadTerms();
    } catch (err: any) {
      console.error('Lỗi mở lại kỳ', err);
      alert(err.response?.data?.message || 'Không thể mở lại kỳ đánh giá.');
    } finally {
      setIsReopening(false);
    }
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Kỳ Đánh Giá & Dữ Liệu Nền</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản trị thời hạn nộp hồ sơ, chấm điểm và chốt sổ điểm rèn luyện toàn trường.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg transition shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Tạo kỳ mới</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-slate-200 text-xs">
        <button
          onClick={() => setActiveTab('TERMS')}
          className={`pb-2.5 font-semibold transition border-b-2 -mb-px ${
            activeTab === 'TERMS'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Kỳ đánh giá ({terms.length})
        </button>
        <button
          onClick={() => setActiveTab('FACULTIES')}
          className={`pb-2.5 font-semibold transition border-b-2 -mb-px ${
            activeTab === 'FACULTIES'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Khoa / Viện ({faculties.length})
        </button>
        <button
          onClick={() => setActiveTab('CLASSES')}
          className={`pb-2.5 font-semibold transition border-b-2 -mb-px ${
            activeTab === 'CLASSES'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Lớp sinh hoạt ({classes.length})
        </button>
      </div>

      {/* Content TERMS */}
      {activeTab === 'TERMS' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-400">Đang tải dữ liệu...</div>
          ) : terms.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">Chưa có kỳ đánh giá nào.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Tên kỳ học</th>
                    <th className="py-3 px-4">Hạn nộp (SV)</th>
                    <th className="py-3 px-4">Hạn duyệt (CB)</th>
                    <th className="py-3 px-4">Hạn khiếu nại</th>
                    <th className="py-3 px-4">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {terms.map((t) => {
                    const isClosed = t.status === 'CLOSED';
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/60 transition">
                        {/* Tên kỳ */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{t.name}</div>
                          <div className="text-[11px] font-mono text-slate-400 mt-0.5">{t.code}</div>
                        </td>

                        {/* Hạn nộp */}
                        <td className="py-3 px-4 text-slate-600">
                          {formatDate(t.submissionDeadline)}
                        </td>

                        {/* Hạn duyệt */}
                        <td className="py-3 px-4 text-slate-600">
                          {formatDate(t.reviewDeadline)}
                        </td>

                        {/* Hạn khiếu nại */}
                        <td className="py-3 px-4 text-slate-600">
                          {formatDate(t.appealDeadline)}
                        </td>

                        {/* Trạng thái */}
                        <td className="py-3 px-4">
                          {getStatusBadge(t)}
                        </td>

                        {/* Thao tác */}
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-3">
                            <button
                              onClick={() => handleOpenEditModal(t)}
                              className="text-slate-600 hover:text-blue-600 font-medium text-[11px] transition inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Sửa hạn</span>
                            </button>

                            {isClosed ? (
                              <button
                                onClick={() => {
                                  setReopeningTerm(t);
                                  setReopenReason('Mở lại kỳ đánh giá theo quyết định hội đồng');
                                }}
                                className="text-blue-600 hover:text-blue-800 font-medium text-[11px] transition inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Unlock className="w-3 h-3" />
                                <span>Mở lại</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => setClosingTerm(t)}
                                className="text-rose-600 hover:text-rose-800 font-medium text-[11px] transition inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Lock className="w-3 h-3" />
                                <span>Chốt sổ</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Content FACULTIES */}
      {activeTab === 'FACULTIES' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {faculties.map((f) => {
              const classCount = classes.filter((c) => c.facultyId === f.id).length;
              return (
                <div key={f.id} className="p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-lg space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                      {f.code}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {classCount} lớp
                    </span>
                  </div>
                  <div className="font-medium text-xs text-slate-800 pt-1">
                    {f.name}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Content CLASSES */}
      {activeTab === 'CLASSES' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
            {classes.map((c) => (
              <div key={c.id} className="p-2.5 bg-slate-50/70 border border-slate-200/80 rounded-lg text-center">
                <span className="font-mono font-bold text-xs text-slate-800 block">
                  {c.code}
                </span>
                <span className="text-[10px] text-slate-500 block truncate mt-0.5">
                  {c.cohort || c.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Tạo kỳ mới */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900 text-sm">Tạo Kỳ Đánh Giá Mới</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTerm} className="py-3.5 space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Tên kỳ học *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Học kỳ 2 (2026-2027)"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Mã kỳ (Code) *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: 2026_2"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  className="w-full px-3 py-1.5 font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Ngày bắt đầu</label>
                  <input
                    type="date"
                    required
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Hạn nộp (SV)</label>
                  <input
                    type="date"
                    required
                    value={formSubmissionDeadline}
                    onChange={(e) => setFormSubmissionDeadline(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Hạn duyệt (CB)</label>
                  <input
                    type="date"
                    required
                    value={formReviewDeadline}
                    onChange={(e) => setFormReviewDeadline(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Hạn khiếu nại</label>
                  <input
                    type="date"
                    required
                    value={formAppealDeadline}
                    onChange={(e) => setFormAppealDeadline(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-xs"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 font-medium rounded-lg hover:bg-slate-50 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
                >
                  {isSubmitting ? 'Đang tạo...' : 'Tạo kỳ học'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Sửa hạn */}
      {editingTerm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Điều Chỉnh Hạn Chót</h3>
                <span className="text-[11px] text-slate-500">{editingTerm.name}</span>
              </div>
              <button
                onClick={() => setEditingTerm(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDeadlines} className="py-3.5 space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Hạn nộp của SV</label>
                <input
                  type="date"
                  value={editSubmissionDeadline}
                  onChange={(e) => setEditSubmissionDeadline(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Hạn duyệt Cán bộ</label>
                <input
                  type="date"
                  value={editReviewDeadline}
                  onChange={(e) => setEditReviewDeadline(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Hạn khiếu nại</label>
                <input
                  type="date"
                  value={editAppealDeadline}
                  onChange={(e) => setEditAppealDeadline(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingTerm(null)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 font-medium rounded-lg hover:bg-slate-50 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingDeadline}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
                >
                  {isUpdatingDeadline ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Chốt sổ */}
      {closingTerm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl border border-slate-100 space-y-3.5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-rose-50 text-rose-600 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Chốt Sổ Kỳ Đánh Giá?</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Toàn bộ điểm rèn luyện của <strong>{closingTerm.name}</strong> sẽ được đóng băng chính thức để bàn giao sang Phòng Đào tạo.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setClosingTerm(null)}
                disabled={isClosing}
                className="px-3 py-1.5 border border-slate-200 text-slate-600 font-medium rounded-lg hover:bg-slate-50 transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmClose}
                disabled={isClosing}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg transition"
              >
                {isClosing ? 'Đang chốt...' : 'Xác nhận Chốt sổ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Mở lại kỳ */}
      {reopeningTerm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl border border-slate-100 space-y-3.5">
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Kích Hoạt Lại Kỳ Học</h3>
              <p className="text-xs text-slate-500 mt-0.5">{reopeningTerm.name}</p>
            </div>

            <div className="text-xs space-y-1.5">
              <label className="block font-medium text-slate-700">Lý do mở lại (Ghi vào Audit Log) *</label>
              <textarea
                rows={2}
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="Nhập lý do..."
                className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setReopeningTerm(null)}
                disabled={isReopening}
                className="px-3 py-1.5 border border-slate-200 text-slate-600 font-medium rounded-lg hover:bg-slate-50 transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmReopen}
                disabled={isReopening || !reopenReason.trim()}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition disabled:opacity-50"
              >
                {isReopening ? 'Đang mở...' : 'Kích hoạt lại'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
