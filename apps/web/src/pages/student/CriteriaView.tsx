import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/apiClient';
import { Criterion, Evidence } from '../../types';
import { calculateStudentConductScore } from '../../lib/ruleEngine';
import {
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  Edit2,
  Trash2,
  Plus,
  Lock,
  Unlock,
  FileText,
  X,
  ExternalLink,
  Info,
} from 'lucide-react';

export const CriteriaView: React.FC = () => {
  const { user, activeTerm } = useAuth();
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [loading, setLoading] = useState(false);

  // Modal State
  const [viewingEvidence, setViewingEvidence] = useState<Evidence | null>(null);
  const [editingEvidence, setEditingEvidence] = useState<Evidence | null>(null);
  const [editForm, setEditForm] = useState({
    declaredActivityName: '',
    participationDate: '',
    declaredRole: 'PARTICIPANT',
  });
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchEvidences = async () => {
    if (user?.id) {
      const evds = await apiClient.getEvidences({ studentId: user.id, termId: activeTerm.id });
      setEvidences(evds);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiClient.getCriteria(),
      user?.id ? apiClient.getEvidences({ studentId: user.id, termId: activeTerm.id }) : Promise.resolve([]),
    ])
      .then(([critList, evdList]) => {
        setCriteria(critList);
        setEvidences(evdList);
      })
      .finally(() => setLoading(false));
  }, [user?.id, activeTerm.id]);

  // Kiểm tra thời hạn nộp điểm rèn luyện của học kỳ
  const isSubmissionOpen = useMemo(() => {
    if (!activeTerm) return false;
    if (activeTerm.status !== 'ACTIVE') return false;
    if (activeTerm.submissionDeadline) {
      const deadline = new Date(activeTerm.submissionDeadline);
      if (new Date() > deadline) return false;
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

  // Tính điểm theo Rule Engine bậc thang
  const { allCriteria, categorySummaries, totalAiScore, totalOfficialScore } = useMemo(() => {
    return calculateStudentConductScore(evidences);
  }, [evidences]);

  const categories = [
    { key: 'KHUNG_I', roman: 'I', name: 'Ý thức tham gia học tập', max: 20 },
    { key: 'KHUNG_II', roman: 'II', name: 'Ý thức chấp hành nội quy, quy chế, quy định', max: 25 },
    { key: 'KHUNG_III', roman: 'III', name: 'Ý thức tham gia các hoạt động chính trị, xã hội, phong trào', max: 20 },
    { key: 'KHUNG_IV', roman: 'IV', name: 'Ý thức công dân trong quan hệ cộng đồng', max: 25 },
    { key: 'KHUNG_V', roman: 'V', name: 'Ý thức và kết quả khi tham gia công tác cán bộ lớp, đoàn thể', max: 10 },
  ];

  const filteredCriteria = useMemo(() => {
    return criteria.filter((c) => {
      if (selectedCategory !== 'ALL' && c.category !== selectedCategory) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesSub = c.subRules?.some((s) => s.toLowerCase().includes(q));
        if (!matchesName && !matchesSub) return false;
      }
      return true;
    });
  }, [criteria, selectedCategory, searchQuery]);

  // Lọc các minh chứng thuộc về từng tiêu chí
  const getEvidencesForCriterion = (c: Criterion) => {
    return evidences.filter((e) => {
      if (e.criterionId === c.id || e.criterion?.id === c.id || e.criterion?.code === c.code) return true;
      if (e.aiSuggestions?.some((s) => s.criterionId === c.id || s.criterion?.code === c.code)) return true;
      if (e.reviews?.some((r) => r.criterionId === c.id || r.criterion?.code === c.code)) return true;
      return false;
    });
  };

  // Xóa minh chứng
  const handleDeleteEvidence = async (e: Evidence) => {
    if (!isSubmissionOpen) {
      alert('Đã hết thời hạn nộp/chỉnh sửa minh chứng rèn luyện của học kỳ này.');
      return;
    }
    if (e.status === 'APPROVED') {
      alert('Minh chứng đã được Cán bộ phê duyệt chính thức, không thể xóa.');
      return;
    }
    const confirmed = window.confirm(
      `Bạn có chắc chắn muốn xóa hồ sơ minh chứng "${e.declaredActivityName || 'này'}" không?`
    );
    if (!confirmed) return;

    try {
      await apiClient.deleteEvidence(e.id);
      alert('Đã xóa minh chứng thành công!');
      fetchEvidences();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Xóa minh chứng thất bại';
      alert(`Lỗi: ${Array.isArray(msg) ? msg.join('\n') : msg}`);
    }
  };

  // Mở modal sửa
  const handleOpenEdit = (e: Evidence) => {
    if (!isSubmissionOpen) {
      alert('Đã hết thời hạn chỉnh sửa minh chứng rèn luyện.');
      return;
    }
    if (e.status === 'APPROVED') {
      alert('Minh chứng đã được duyệt điểm chính thức, không thể sửa.');
      return;
    }
    setEditingEvidence(e);
    setEditForm({
      declaredActivityName: e.declaredActivityName || '',
      participationDate: e.participationDate ? e.participationDate.substring(0, 10) : '',
      declaredRole: e.declaredRole || 'PARTICIPANT',
    });
  };

  // Lưu sửa minh chứng
  const handleSaveEdit = async () => {
    if (!editingEvidence) return;
    setIsUpdating(true);
    try {
      await apiClient.updateEvidence(editingEvidence.id, editForm);
      alert('Cập nhật hồ sơ minh chứng thành công!');
      setEditingEvidence(null);
      fetchEvidences();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Cập nhật thất bại';
      alert(`Lỗi: ${Array.isArray(msg) ? msg.join('\n') : msg}`);
    } finally {
      setIsUpdating(false);
    }
  };

  // Xếp loại rèn luyện
  const getRating = (score: number) => {
    if (score >= 90) return { label: 'Xuất sắc', color: 'text-purple-700 bg-purple-50 border-purple-200' };
    if (score >= 80) return { label: 'Tốt', color: 'text-blue-700 bg-blue-50 border-blue-200' };
    if (score >= 65) return { label: 'Khá', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    if (score >= 50) return { label: 'Trung bình', color: 'text-amber-700 bg-amber-50 border-amber-200' };
    return { label: 'Yếu', color: 'text-rose-700 bg-rose-50 border-rose-200' };
  };

  const currentRating = getRating(totalOfficialScore > 0 ? totalOfficialScore : totalAiScore);

  return (
    <div className="space-y-6 pb-16 font-sans">
      {/* 1. Header Toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-[#1d6fc2] mb-2 border border-blue-100">
            <span>Trường Đại học Bách Khoa – Đại học Đà Nẵng</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Phiếu Tự Đánh Giá & 16 Tiêu Chí Điểm Rèn Luyện
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Kỳ đánh giá: <strong className="text-slate-800">{activeTerm.name}</strong> · Bạn có thể tự khai báo, xem chi tiết, sửa hoặc xóa minh chứng trong thời hạn quy định.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <Link
            to="/regulations/ask"
            className="flex-1 sm:flex-initial text-center px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-[#1d6fc2] font-bold text-xs rounded-xl border border-blue-200 transition"
          >
            Hỏi đáp AI Quy chế
          </Link>

          {isSubmissionOpen ? (
            <Link
              to="/student/evidence/new"
              className="flex-1 sm:flex-initial text-center px-4 py-2.5 bg-[#1d6fc2] hover:bg-[#175ea5] active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition cursor-pointer"
            >
              + Nộp minh chứng mới
            </Link>
          ) : (
            <div className="flex-1 sm:flex-initial text-center px-4 py-2.5 bg-slate-100 text-slate-400 font-bold text-xs rounded-xl border border-slate-200 cursor-not-allowed">
              🔒 Đã hết hạn nộp
            </div>
          )}
        </div>
      </div>

      {/* 2. Banner Trạng Thái Thời Hạn Đợt Đánh Giá */}
      <div
        className={`p-4.5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs ${
          isSubmissionOpen
            ? 'bg-gradient-to-r from-emerald-50/80 via-teal-50/50 to-blue-50/80 border-emerald-200/90 text-emerald-950'
            : 'bg-gradient-to-r from-amber-50/90 via-orange-50/60 to-slate-50/90 border-amber-300 text-amber-950'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isSubmissionOpen ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
            }`}
          >
            {isSubmissionOpen ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm">
                {isSubmissionOpen
                  ? 'GIAI ĐOẠN ĐANG MỞ: TỰ ĐÁNH GIÁ & NỘP MINH CHỨNG'
                  : 'GIAI ĐOẠN ĐÃ ĐÓNG: HỆ THỐNG ĐANG XÉT DUYỆT'}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${
                  isSubmissionOpen ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'
                }`}
              >
                {activeTerm.status}
              </span>
            </div>
            <p className="text-xs opacity-90 mt-0.5">
              {isSubmissionOpen
                ? `Hạn chót tự khai báo và điều chỉnh hồ sơ: ${formattedDeadline}. Bạn được phép thêm, sửa hoặc xóa minh chứng chưa phê duyệt.`
                : `Hạn nộp hồ sơ đã kết thúc (${formattedDeadline}). Bảng điểm và minh chứng đã được khóa để Cán bộ Khoa và Hội đồng đánh giá.`}
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span className="text-[11px] block font-semibold opacity-75">Hạn chót nộp hồ sơ</span>
          <span className="text-sm font-black font-mono">{formattedDeadline}</span>
        </div>
      </div>

      {/* 3. Thống Kê Tổng Điểm Rèn Luyện */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Điểm tự khai báo / AI đề xuất
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#1d6fc2] font-mono">
              {totalAiScore.toFixed(1)}
            </span>
            <span className="text-xs text-slate-400 font-semibold">/ 100 điểm</span>
          </div>
          <p className="text-[11px] text-slate-500">Áp dụng bậc thang Rule Engine</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Điểm Cán bộ đã duyệt chính thức
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700 font-mono">
              {totalOfficialScore.toFixed(1)}
            </span>
            <span className="text-xs text-slate-400 font-semibold">/ 100 điểm</span>
          </div>
          <p className="text-[11px] text-slate-500">Điểm số có giá trị pháp lý học kỳ</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Xếp loại rèn luyện tạm tính
          </span>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-3 py-1 rounded-xl text-sm font-black border ${currentRating.color}`}>
              {currentRating.label}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">Quy chế ĐRL Trường ĐH Bách Khoa</p>
        </div>
      </div>

      {/* 4. Bộ Lọc 5 Khung & Ô Tìm Kiếm */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              selectedCategory === 'ALL'
                ? 'bg-[#1d6fc2] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Tất cả 5 khung
          </button>
          {categories.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setSelectedCategory(cat.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                selectedCategory === cat.key
                  ? 'bg-[#1d6fc2] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Khung {cat.roman} ({cat.max}đ)
            </button>
          ))}
        </div>

        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="Tìm theo nội dung tiêu chí..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none transition font-medium"
          />
        </div>
      </div>

      {/* 5. Bảng 16 Tiêu Chí & Danh Sách Minh Chứng Gắn Trực Tiếp */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs min-w-[1000px] border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-3 w-14 text-center border-r border-slate-200">Mục</th>
                <th className="py-3.5 px-4 min-w-[360px] border-r border-slate-200">
                  Nội dung tiêu chí & Minh chứng đã nộp
                </th>
                <th className="py-3.5 px-3 w-24 text-center border-r border-slate-200">Trần điểm</th>
                <th className="py-3.5 px-4 w-32 text-center border-r border-slate-200 bg-blue-50/70">
                  AI Đề xuất
                </th>
                <th className="py-3.5 px-4 w-32 text-center border-r border-slate-200 bg-emerald-50/70">
                  Cán bộ duyệt
                </th>
                <th className="py-3.5 px-3 w-40 text-center">Thao tác nộp</th>
              </tr>
            </thead>

            <tbody>
              {categories.map((cat, idx) => {
                const catCriteria = filteredCriteria.filter((c) => c.category === cat.key);
                if (catCriteria.length === 0 && selectedCategory !== 'ALL' && selectedCategory !== cat.key) {
                  return null;
                }
                const catSummary = categorySummaries[idx];

                return (
                  <React.Fragment key={cat.key}>
                    {/* Master Category Row */}
                    <tr className="bg-[#fef9e7] border-y border-amber-200 font-bold text-slate-900 text-xs">
                      <td className="py-3 px-3 text-center border-r border-amber-200 font-black">
                        {cat.roman}
                      </td>
                      <td className="py-3 px-4 border-r border-amber-200" colSpan={1}>
                        {cat.name} <span className="font-normal text-slate-600">(Khung đánh giá: 0 đến {cat.max} điểm)</span>
                      </td>
                      <td className="py-3 px-3 text-center border-r border-amber-200 font-black text-amber-900">
                        {cat.max}đ
                      </td>
                      <td className="py-3 px-4 text-center border-r border-amber-200 font-black text-blue-900 bg-blue-100/50">
                        {catSummary.aiScore} / {cat.max}đ
                      </td>
                      <td className="py-3 px-4 text-center border-r border-amber-200 font-black text-emerald-900 bg-emerald-100/50">
                        {catSummary.officialScore} / {cat.max}đ
                      </td>
                      <td className="py-3 px-3 text-center text-slate-400 font-normal text-[11px]">
                        Theo quy chế
                      </td>
                    </tr>

                    {/* Criteria Item Rows */}
                    {catCriteria.map((c) => {
                      const prog = allCriteria.find((p) => p.code === c.code);
                      const aiScore = prog?.aiSuggestedScore ?? (c.maxScore ? Math.min(c.maxScore, 5) : 0);
                      const offScore = prog?.officialScore ?? 0;
                      const criterionEvidences = getEvidencesForCriterion(c);

                      return (
                        <tr key={c.id} className="hover:bg-slate-50/70 border-b border-slate-100 transition-colors">
                          {/* Code */}
                          <td className="py-4 px-3 text-center font-bold text-slate-700 border-r border-slate-100 align-top">
                            {c.code}
                          </td>

                          {/* Name & Evidence List */}
                          <td className="py-4 px-4 border-r border-slate-100 space-y-3 align-top">
                            <div>
                              <div className="font-bold text-slate-900 text-xs leading-snug">
                                {c.name}
                              </div>
                              {c.subRules && c.subRules.length > 0 && (
                                <ul className="mt-1 space-y-0.5 text-[11px] text-slate-500 italic">
                                  {c.subRules.map((rule, rIdx) => (
                                    <li key={rIdx} className="flex items-start gap-1">
                                      <span className="text-slate-400 shrink-0">•</span>
                                      <span>{rule}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>

                            {/* Evidence Box */}
                            <div className="pt-2 border-t border-slate-100 space-y-2">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                Minh chứng đã gắn ({criterionEvidences.length}):
                              </span>

                              {criterionEvidences.length === 0 ? (
                                <div className="text-[11px] text-slate-400 italic bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                                  Chưa nộp minh chứng nào cho mục này.
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  {criterionEvidences.map((evd) => {
                                    const isApproved = evd.status === 'APPROVED';
                                    const canModify = isSubmissionOpen && !isApproved;

                                    return (
                                      <div
                                        key={evd.id}
                                        className="bg-slate-50/90 border border-slate-200/90 rounded-xl p-2.5 flex items-center justify-between gap-2 hover:bg-white transition"
                                      >
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-bold text-slate-900 text-xs truncate">
                                              {evd.declaredActivityName || 'Minh chứng không tên'}
                                            </span>
                                            {evd.status === 'APPROVED' && (
                                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                                Đã duyệt
                                              </span>
                                            )}
                                            {evd.status === 'NEEDS_HUMAN_REVIEW' && (
                                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                                Chờ duyệt
                                              </span>
                                            )}
                                            {evd.status === 'DRAFT' && (
                                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                                                Bản nháp
                                              </span>
                                            )}
                                            {evd.status === 'REJECTED' && (
                                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                                                Từ chối
                                              </span>
                                            )}
                                            {evd.status === 'NEEDS_SUPPLEMENT' && (
                                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800">
                                                Cần bổ sung
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                                            <span>
                                              Ngày:{' '}
                                              {evd.participationDate
                                                ? new Date(evd.participationDate).toLocaleDateString('vi-VN')
                                                : '—'}
                                            </span>
                                            <span>·</span>
                                            <span>Vai trò: {evd.declaredRole || 'Tham gia'}</span>
                                            {evd.files && evd.files.length > 0 && (
                                              <>
                                                <span>·</span>
                                                <span className="text-[#1d6fc2] font-semibold">
                                                  {evd.files.length} tệp đính kèm
                                                </span>
                                              </>
                                            )}
                                          </div>
                                        </div>

                                        {/* Action Buttons for this evidence */}
                                        <div className="flex items-center gap-1 shrink-0">
                                          <button
                                            type="button"
                                            onClick={() => setViewingEvidence(evd)}
                                            title="Xem chi tiết minh chứng"
                                            className="p-1.5 text-slate-600 hover:text-[#1d6fc2] hover:bg-blue-50 rounded-lg transition"
                                          >
                                            <Eye className="w-3.5 h-3.5" />
                                          </button>

                                          {canModify && (
                                            <>
                                              <button
                                                type="button"
                                                onClick={() => handleOpenEdit(evd)}
                                                title="Sửa thông tin minh chứng"
                                                className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                                              >
                                                <Edit2 className="w-3.5 h-3.5" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleDeleteEvidence(evd)}
                                                title="Xóa minh chứng này"
                                                className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </>
                                          )}

                                          {!canModify && (
                                            <span
                                              title={isApproved ? 'Đã duyệt chính thức' : 'Đã hết hạn sửa xóa'}
                                              className="p-1.5 text-slate-400"
                                            >
                                              <Lock className="w-3.5 h-3.5" />
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Max Score */}
                          <td className="py-4 px-3 text-center font-bold text-slate-800 border-r border-slate-100 align-top">
                            {c.maxScore}đ
                          </td>

                          {/* AI Score */}
                          <td className="py-4 px-4 text-center border-r border-slate-100 align-top bg-blue-50/20">
                            <span className="inline-block px-2 py-0.5 rounded-lg bg-blue-50 text-[#1d6fc2] font-black border border-blue-200 font-mono text-xs">
                              +{aiScore.toFixed(1)}đ
                            </span>
                          </td>

                          {/* Official Score */}
                          <td className="py-4 px-4 text-center border-r border-slate-100 align-top bg-emerald-50/20">
                            {offScore > 0 ? (
                              <span className="inline-block px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 font-black border border-emerald-300 font-mono text-xs">
                                {offScore.toFixed(1)}đ
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs font-mono">—</span>
                            )}
                          </td>

                          {/* Submit Action */}
                          <td className="py-4 px-3 text-center align-top">
                            {isSubmissionOpen ? (
                              <Link
                                to={`/student/evidence/new?criterionId=${c.id}&criterionCode=${c.code}`}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#1d6fc2] hover:text-[#175ea5] font-bold text-xs rounded-xl border border-blue-200 transition whitespace-nowrap"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Khai báo</span>
                              </Link>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-400 font-semibold text-[11px] rounded-lg cursor-not-allowed">
                                <Lock className="w-3 h-3" />
                                <span>Đã khóa</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}

              {/* Total Footer Row */}
              <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-xs text-slate-900">
                <td className="py-4 px-3 text-center border-r border-slate-200">∑</td>
                <td className="py-4 px-4 border-r border-slate-200 uppercase tracking-wider text-sm font-black">
                  Tổng điểm rèn luyện (Thang 100 điểm)
                </td>
                <td className="py-4 px-3 text-center border-r border-slate-200 text-sm font-black text-slate-900">
                  100đ
                </td>
                <td className="py-4 px-4 text-center border-r border-slate-200 text-sm font-black text-[#1d6fc2] bg-blue-100/60">
                  {totalAiScore.toFixed(1)}đ
                </td>
                <td className="py-4 px-4 text-center border-r border-slate-200 text-sm font-black text-emerald-800 bg-emerald-100/60">
                  {totalOfficialScore.toFixed(1)}đ
                </td>
                <td className="py-4 px-3 text-center text-xs font-bold text-slate-500">
                  {currentRating.label}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: XEM CHI TIẾT MINH CHỨNG */}
      {viewingEvidence && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#1d6fc2]" />
                <h3 className="font-extrabold text-slate-900 text-sm">Chi tiết hồ sơ minh chứng</h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingEvidence(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px] font-medium">Tên hoạt động</span>
                <span className="font-bold text-slate-900 text-sm">
                  {viewingEvidence.declaredActivityName || 'Chưa đặt tên'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 block text-[11px] font-medium">Ngày tham gia</span>
                  <span className="font-semibold text-slate-800">
                    {viewingEvidence.participationDate
                      ? new Date(viewingEvidence.participationDate).toLocaleDateString('vi-VN')
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px] font-medium">Vai trò khai báo</span>
                  <span className="font-semibold text-slate-800">
                    {viewingEvidence.declaredRole || 'Tham gia'}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px] font-medium">Trạng thái xét duyệt</span>
                <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-800">
                  {viewingEvidence.status}
                </span>
              </div>

              {viewingEvidence.aiSuggestions && viewingEvidence.aiSuggestions.length > 0 && (
                <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200 space-y-1">
                  <span className="font-bold text-[#1d6fc2] block">AI Gợi ý quy đổi:</span>
                  <p className="text-slate-700 text-[11px]">
                    {viewingEvidence.aiSuggestions[0].reasoning}
                  </p>
                  <span className="text-xs font-black text-blue-900 block">
                    Đề xuất: +{viewingEvidence.aiSuggestions[0].suggestedScore} điểm
                  </span>
                </div>
              )}

              {/* Tệp đính kèm */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="text-slate-400 block text-[11px] font-medium">Tệp ảnh minh chứng</span>
                {viewingEvidence.files && viewingEvidence.files.length > 0 ? (
                  <div className="space-y-2">
                    {viewingEvidence.files.map((f, i) => (
                      <div key={i} className="border border-slate-200 rounded-xl overflow-hidden">
                        <img
                          src={f.fileUrl}
                          alt="Minh chứng"
                          className="w-full max-h-64 object-contain bg-slate-900/5"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-400 italic">Không có tệp tải lên</span>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingEvidence(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: SỬA THÔNG TIN MINH CHỨNG */}
      {editingEvidence && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-amber-600" />
                <h3 className="font-extrabold text-slate-900 text-sm">Chỉnh sửa thông tin minh chứng</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingEvidence(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700 block font-bold mb-1">Tên hoạt động / Minh chứng *</label>
                <input
                  type="text"
                  value={editForm.declaredActivityName}
                  onChange={(e) => setEditForm({ ...editForm, declaredActivityName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 block font-bold mb-1">Ngày tham gia</label>
                  <input
                    type="date"
                    value={editForm.participationDate}
                    onChange={(e) => setEditForm({ ...editForm, participationDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>

                <div>
                  <label className="text-slate-700 block font-bold mb-1">Vai trò tham gia</label>
                  <select
                    value={editForm.declaredRole}
                    onChange={(e) => setEditForm({ ...editForm, declaredRole: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    <option value="PARTICIPANT">Tham gia chính</option>
                    <option value="BAN_TO_CHUC">Ban tổ chức</option>
                    <option value="CO_VU">Cổ vũ / Hỗ trợ</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingEvidence(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isUpdating}
                className="px-4 py-2 bg-[#1d6fc2] hover:bg-[#175ea5] text-white font-bold text-xs rounded-xl transition shadow-xs disabled:opacity-50"
              >
                {isUpdating ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
