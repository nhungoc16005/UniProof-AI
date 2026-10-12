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
  Sparkles,
  Award,
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
      {/* 1. Header Toolbar với Term Status Badge tích hợp sang trọng */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-[#1d6fc2] border border-blue-100">
              Trường ĐH Bách Khoa – ĐHĐN
            </span>
            {isSubmissionOpen ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Đang mở nhận hồ sơ (Hạn: {formattedDeadline})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                Đã đóng đợt nộp (Hạn chót: {formattedDeadline}) · Đang xét duyệt
              </span>
            )}
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Phiếu Tự Đánh Giá & 16 Tiêu Chí Điểm Rèn Luyện
          </h1>

          <p className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
            <span>Học kỳ: <strong className="text-slate-800 font-bold">{activeTerm.name}</strong></span>
            <span>•</span>
            <span>
              {isSubmissionOpen
                ? 'Bạn được phép khai báo, xem chi tiết, sửa hoặc xóa minh chứng chưa phê duyệt.'
                : 'Minh chứng đã được chốt để Cán bộ Khoa và Hội đồng tiến hành xét duyệt.'}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
          <Link
            to="/regulations/ask"
            className="flex-1 sm:flex-initial text-center px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition"
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
            <div className="flex-1 sm:flex-initial text-center px-3.5 py-2.5 bg-slate-100 text-slate-500 font-bold text-xs rounded-xl border border-slate-200 flex items-center justify-center gap-1.5 cursor-not-allowed">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>Đã khóa nộp hồ sơ</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Thống Kê Điểm Rèn Luyện (Cards phong cách Dashboard hiện đại) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: AI / Tự đánh giá */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:shadow-sm transition space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              Điểm tự khai báo / AI đề xuất
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#1d6fc2] flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-[#1d6fc2] font-mono tracking-tight">
              {totalAiScore.toFixed(1)}
            </span>
            <span className="text-xs text-slate-400 font-bold">/ 100 điểm</span>
          </div>
          <div className="space-y-1">
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-[#1d6fc2] h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, totalAiScore))}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400 font-medium pt-0.5">
              Quy đổi theo quy chế bậc thang Rule Engine
            </p>
          </div>
        </div>

        {/* Card 2: Điểm duyệt chính thức */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:shadow-sm transition space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              Điểm Cán bộ duyệt chính thức
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-emerald-700 font-mono tracking-tight">
              {totalOfficialScore.toFixed(1)}
            </span>
            <span className="text-xs text-slate-400 font-bold">/ 100 điểm</span>
          </div>
          <div className="space-y-1">
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-600 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, totalOfficialScore))}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400 font-medium pt-0.5">
              Điểm số chính thức có giá trị pháp lý học kỳ
            </p>
          </div>
        </div>

        {/* Card 3: Xếp loại tạm tính */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:shadow-sm transition space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              Xếp loại rèn luyện kết quả
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center gap-2.5 pt-0.5">
            <span className={`px-3.5 py-1.5 rounded-xl text-base font-black border ${currentRating.color}`}>
              {currentRating.label}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              (Thang điểm ĐHBK)
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium pt-1.5">
            ≥90: Xuất sắc · ≥80: Tốt · ≥65: Khá · ≥50: TB
          </p>
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
