import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/apiClient';
import { Criterion, Evidence } from '../../types';
import { calculateStudentConductScore } from '../../lib/ruleEngine';
import { Sparkles, Calendar, MapPin, ArrowRight, Award, CheckCircle } from 'lucide-react';

export const CriteriaView: React.FC = () => {
  const { user, activeTerm } = useAuth();
  const [activeTab, setActiveTab] = useState<'CRITERIA' | 'OPPORTUNITIES'>(() => {
    return new URLSearchParams(window.location.search).get('tab') === 'opportunities' ? 'OPPORTUNITIES' : 'CRITERIA';
  });
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  useEffect(() => {
    apiClient.getCriteria().then(setCriteria);
    if (user?.id) {
      apiClient.getEvidences({ studentId: user.id, termId: activeTerm.id }).then(setEvidences);
    }
  }, [user?.id, activeTerm.id]);

  // Calculate actual scores based on Rule Engine
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

  return (
    <div className="space-y-6 pb-12 font-sans">
      
      {/* 1. Header Toolbar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.05)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-[#1d6fc2] mb-2 border border-blue-100">
            <span>Trường Đại học Bách Khoa – Đại học Đà Nẵng</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Khung Tiêu chí & Quy tắc Tính điểm Rèn luyện
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Quy trình số hóa: AI phân tích minh chứng và áp dụng Rule Engine bậc thang, Cán bộ Khoa hậu kiểm và phê duyệt chính thức.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <Link
            to="/regulations/ask"
            className="flex-1 sm:flex-initial text-center px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-[#1d6fc2] font-bold text-xs rounded-xl border border-blue-200 transition"
          >
            Hỏi đáp AI về quy chế
          </Link>

          <Link
            to="/student/evidence/new"
            className="flex-1 sm:flex-initial text-center px-4 py-2.5 bg-[#1d6fc2] hover:bg-[#175ea5] active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition cursor-pointer"
          >
            Nộp minh chứng mới
          </Link>
        </div>
      </div>

      {/* Tab Switcher: Khung tiêu chí vs Cơ hội tích lũy */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('CRITERIA')}
          className={`py-3 px-4 text-xs font-bold border-b-2 transition ${
            activeTab === 'CRITERIA'
              ? 'border-[#1d6fc2] text-[#1d6fc2]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Khung 16 Tiêu chí đánh giá ĐRL
        </button>
        <button
          onClick={() => setActiveTab('OPPORTUNITIES')}
          className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'OPPORTUNITIES'
              ? 'border-[#1d6fc2] text-[#1d6fc2]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Cơ hội tích lũy & Gợi ý cải thiện điểm (S08)</span>
        </button>
      </div>

      {activeTab === 'CRITERIA' ? (
        <>
          {/* 2. Rule Engine Explanation Banner */}
          <div className="p-4 bg-gradient-to-r from-blue-50/90 via-sky-50/80 to-indigo-50/90 border border-blue-200/90 rounded-2xl shadow-xs space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#1d6fc2] animate-pulse" />
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Cơ chế tính điểm thông minh: Bậc thang (Tier) & Khống chế trần (Cap)
          </span>
        </div>
        <p className="text-xs text-slate-700 leading-relaxed">
          Điểm rèn luyện <strong>không được cộng dồn tuyến tính vô hạn</strong> theo số lượng giấy tờ nộp lên, mà được hệ thống <strong>Rule Engine</strong> tự động quy đổi theo các ngưỡng bậc thang quy định:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1 text-xs">
          <div className="p-2.5 bg-white/90 rounded-xl border border-blue-200/70">
            <span className="font-bold text-[#1d6fc2] block">Mục 9 & 10 (Văn thể mỹ / Tuyên truyền)</span>
            <span className="text-slate-600 text-[11px] block mt-0.5">
              1 lần = <strong>5.0đ</strong> · 2 lần = <strong>7.0đ</strong> · Từ 3 lần trở lên = <strong>10.0đ</strong> (Trần 10đ).
            </span>
          </div>
          <div className="p-2.5 bg-white/90 rounded-xl border border-blue-200/70">
            <span className="font-bold text-[#1d6fc2] block">Mục 12 (Phục vụ cộng đồng - HĐPVCĐ)</span>
            <span className="text-slate-600 text-[11px] block mt-0.5">
              1 HĐ (≥5đ) = <strong>5.0đ</strong> · 2 HĐ (≥10đ) = <strong>7.0đ</strong> · ≥3 HĐ (≥15đ) = <strong>10.0đ</strong> (Trần 10đ).
            </span>
          </div>
          <div className="p-2.5 bg-white/90 rounded-xl border border-blue-200/70">
            <span className="font-bold text-[#1d6fc2] block">Mục 4, 8, 13 (CLB / Kỹ năng / BTC)</span>
            <span className="text-slate-600 text-[11px] block mt-0.5">
              Có minh chứng hợp lệ = Đạt trần của mục (3.0đ hoặc 5.0đ, nộp thêm không tính trùng).
            </span>
          </div>
        </div>
      </div>

      {/* 3. Category Summary Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {categorySummaries.map((cat, idx) => {
          const roman = categories[idx].roman;

          return (
            <div
              key={cat.category}
              onClick={() => setSelectedCategory(selectedCategory === cat.category ? 'ALL' : cat.category)}
              className={`p-3.5 rounded-2xl border transition cursor-pointer ${
                selectedCategory === cat.category
                  ? 'bg-blue-50/80 border-[#1d6fc2] ring-1 ring-[#1d6fc2]'
                  : 'bg-white border-slate-200/90 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
                <span>KHUNG {roman}</span>
                <span className="text-[#1d6fc2] font-mono">
                  {cat.officialScore}/{cat.maxScore}đ
                </span>
              </div>
              <div className="font-bold text-xs text-slate-800 line-clamp-1" title={cat.name}>
                {cat.name}
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Filter and Search Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
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
            placeholder="Tìm theo nội dung tiêu chí hoặc quy định..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none transition font-medium"
          />
        </div>
      </div>

      {/* 5. Modern Digital Criteria Table (Không còn cột Tự đánh giá / Lớp đánh giá thủ công) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_4px_24px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs min-w-[980px] border-collapse">
            
            {/* Table Header */}
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-3 w-14 text-center border-r border-slate-200">
                  STT
                </th>
                <th className="py-3.5 px-4 min-w-[320px] border-r border-slate-200">
                  Nội dung tiêu chí rèn luyện
                </th>
                <th className="py-3.5 px-4 min-w-[280px] border-r border-slate-200">
                  Quy tắc bậc thang & Khống chế trần
                </th>
                <th className="py-3.5 px-3 w-24 text-center border-r border-slate-200">
                  Điểm tối đa
                </th>
                <th className="py-3.5 px-4 min-w-[150px] text-center border-r border-slate-200 bg-blue-50/70">
                  AI Đề xuất (Rule Engine)
                </th>
                <th className="py-3.5 px-4 min-w-[150px] text-center bg-emerald-50/70">
                  Cán bộ đã duyệt (Chính thức)
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody>
              {categories.map((cat, idx) => {
                const catCriteria = filteredCriteria.filter((c) => c.category === cat.key);
                if (catCriteria.length === 0 && selectedCategory !== 'ALL' && selectedCategory !== cat.key) {
                  return null;
                }

                const catSummary = categorySummaries[idx];

                return (
                  <React.Fragment key={cat.key}>
                    
                    {/* Category Master Header Row */}
                    <tr className="bg-[#fef9e7] border-y border-amber-200 font-bold text-slate-900 text-xs">
                      <td className="py-3 px-3 text-center border-r border-amber-200 font-black">
                        {cat.roman}
                      </td>
                      <td className="py-3 px-4 border-r border-amber-200" colSpan={2}>
                        {cat.name} <span className="font-normal text-slate-600">(Khung điểm đánh giá: Từ 0 đến {cat.max} điểm)</span>
                      </td>
                      <td className="py-3 px-3 text-center border-r border-amber-200 font-black text-amber-900">
                        {cat.max}
                      </td>
                      <td className="py-3 px-4 text-center border-r border-amber-200 font-black text-blue-900 bg-blue-100/50">
                        {catSummary.aiScore} / {cat.max} đ
                      </td>
                      <td className="py-3 px-4 text-center font-black text-emerald-900 bg-emerald-100/50">
                        {catSummary.officialScore} / {cat.max} đ
                      </td>
                    </tr>

                    {/* Criteria Rows */}
                    {catCriteria.map((c) => {
                      const prog = allCriteria.find((p) => p.code === c.code);
                      const aiScore = prog?.aiSuggestedScore ?? (c.maxScore ? Math.min(c.maxScore, 5) : 0);
                      const offScore = prog?.officialScore ?? 0;
                      const count = prog?.evidenceCount ?? 0;

                      return (
                        <tr key={c.id} className="hover:bg-slate-50/80 border-b border-slate-100 transition-colors">
                          
                          {/* Stt */}
                          <td className="py-4 px-3 text-center font-bold text-slate-700 border-r border-slate-100 align-top">
                            {c.code}
                          </td>

                          {/* Content */}
                          <td className="py-4 px-4 border-r border-slate-100 space-y-2 align-top">
                            <div className="font-bold text-slate-900 text-xs leading-snug">
                              {c.name}
                            </div>

                            {/* Sub-rules penalty/bonus detail */}
                            {c.subRules && c.subRules.length > 0 && (
                              <ul className="space-y-1 pl-1 text-[11px] text-slate-600 italic">
                                {c.subRules.map((rule, rIdx) => (
                                  <li key={rIdx} className="flex items-start gap-1.5">
                                    <span className="text-slate-400 shrink-0 mt-0.5">•</span>
                                    <span>{rule}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>

                          {/* Tier Description & Advice */}
                          <td className="py-4 px-4 border-r border-slate-100 space-y-1.5 align-top text-xs text-slate-700">
                            <div className="font-medium text-[11px] leading-relaxed text-slate-800">
                              {prog?.tierDescription || 'Áp dụng trần tối đa theo quy chế.'}
                            </div>
                            {prog?.nextTierAdvice && (
                              <div className="p-2 rounded-lg bg-blue-50/70 border border-blue-200/60 text-[10px] text-blue-900 font-semibold leading-relaxed">
                                💡 {prog.nextTierAdvice}
                              </div>
                            )}
                          </td>

                          {/* Max Score */}
                          <td className="py-4 px-3 text-center font-bold text-slate-800 border-r border-slate-100 align-top">
                            {c.maxScore} đ
                          </td>

                          {/* AI Suggested Score */}
                          <td className="py-4 px-4 text-center border-r border-slate-100 align-top bg-blue-50/30">
                            <span className="inline-block px-2.5 py-1 rounded-lg bg-blue-50 text-[#1d6fc2] font-black border border-blue-200 font-mono text-xs whitespace-nowrap">
                              +{aiScore.toFixed(1)} đ
                            </span>
                            {count > 0 && (
                              <span className="block text-[10px] text-slate-400 font-medium mt-1">
                                {count} minh chứng
                              </span>
                            )}
                          </td>

                          {/* Official Score by Officer */}
                          <td className="py-4 px-4 text-center align-top bg-emerald-50/30">
                            {offScore > 0 ? (
                              <span className="inline-block px-2.5 py-1 rounded-lg bg-emerald-100/80 text-emerald-800 font-black border border-emerald-300 font-mono text-xs whitespace-nowrap">
                                {offScore.toFixed(1)} đ
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs font-mono">—</span>
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
                <td className="py-4 px-3 text-center border-r border-slate-200">
                  ∑
                </td>
                <td className="py-4 px-4 border-r border-slate-200 uppercase tracking-wider text-sm font-black" colSpan={2}>
                  Tổng điểm rèn luyện (Thang 100 điểm)
                </td>
                <td className="py-4 px-3 text-center border-r border-slate-200 text-sm font-black text-slate-900">
                  100 đ
                </td>
                <td className="py-4 px-4 text-center border-r border-slate-200 text-sm font-black text-[#1d6fc2] bg-blue-100/60">
                  {totalAiScore.toFixed(1)} đ
                </td>
                <td className="py-4 px-4 text-center text-sm font-black text-emerald-800 bg-emerald-100/60">
                  {totalOfficialScore.toFixed(1)} đ
                </td>
              </tr>

            </tbody>
          </table>
        </div>
      </div>

        {/* 6. Action Bar */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-slate-900 block">
              Cần tích lũy thêm điểm cho học kỳ này?
            </span>
            <p className="text-xs text-slate-500">
              Hệ thống tự động rà soát các hoạt động ngoại khóa, tình nguyện và học thuật phù hợp với các tiêu chí bạn còn thiếu điểm.
            </p>
          </div>

          <button
            onClick={() => setActiveTab('OPPORTUNITIES')}
            className="px-4 py-2.5 bg-[#1d6fc2] hover:bg-[#175ea5] text-white font-bold text-xs rounded-xl shadow-sm transition whitespace-nowrap cursor-pointer"
          >
            Khám phá cơ hội tích lũy điểm →
          </button>
        </div>
      </>
    ) : (
      /* OPPORTUNITIES TAB VIEW (What Can I Claim) */
      <div className="space-y-6 animate-in fade-in duration-200">
        <div className="p-5 bg-gradient-to-r from-amber-50/80 via-sky-50/60 to-blue-50/80 border border-amber-200/80 rounded-2xl space-y-1.5 shadow-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Gợi ý cơ hội tích lũy & Nâng bậc điểm rèn luyện (S08)
            </h2>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Dựa trên số điểm hiện tại của bạn ({totalOfficialScore}đ), hệ thống tự động tính toán các khung điểm bạn còn khoảng trống để tối ưu hóa nỗ lực tham gia:
          </p>
        </div>

        <div className="space-y-5">
          {[
            {
              category: 'Khung III: Hoạt động Văn thể mỹ & Phong trào chính trị - xã hội',
              gap: 'Còn có thể tích lũy thêm tối đa 8.0 điểm',
              color: 'border-sky-200 bg-sky-50/40',
              recommendedActivities: [
                {
                  name: 'Hội thao Sinh viên Bách Khoa DUT Games 2026',
                  points: '+4.0 điểm',
                  date: '25/10/2026',
                  location: 'Nhà thi đấu Đa năng',
                  type: 'Nội bộ trường (I3)',
                },
                {
                  name: 'Cuộc thi Tiếng hát Sinh viên Khoa CNTT 2026',
                  points: '+3.0 điểm',
                  date: '02/11/2026',
                  location: 'Hội trường F',
                  type: 'Nội bộ trường (I3)',
                },
              ],
            },
            {
              category: 'Khung IV: Phẩm chất công dân & Phục vụ cộng đồng (HĐPVCĐ)',
              gap: 'Còn có thể tích lũy thêm tối đa 15.0 điểm',
              color: 'border-emerald-200 bg-emerald-50/40',
              recommendedActivities: [
                {
                  name: 'Ngày hội Chủ Nhật Đỏ — Hiến máu tình nguyện đợt 2',
                  points: '+5.0 điểm',
                  date: '15/11/2026',
                  location: 'Khu E Bách Khoa',
                  type: 'Nội bộ trường (I3)',
                },
                {
                  name: 'Chiến dịch Mùa hè xanh / Tình nguyện hỗ trợ Tân sinh viên',
                  points: '+5.0 điểm',
                  date: '01/12/2026',
                  location: 'Khuôn viên trường',
                  type: 'Đoàn Thanh niên',
                },
              ],
            },
          ].map((item, idx) => (
            <div key={idx} className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                <span className="font-bold text-xs text-slate-900 uppercase tracking-wider">{item.category}</span>
                <span className="text-xs font-bold text-[#1d6fc2] bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                  {item.gap}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {item.recommendedActivities.map((act, i) => (
                  <div key={i} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-blue-300 transition space-y-3 flex flex-col justify-between shadow-2xs">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-xs text-slate-900 leading-snug">{act.name}</h4>
                        <span className="shrink-0 text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                          {act.points}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-2">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {act.date}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {act.location}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400 font-medium">{act.type}</span>
                      <Link
                        to="/student/evidence/new"
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#1d6fc2] hover:text-[#175ea5]"
                      >
                        <span>Nộp minh chứng hoạt động này</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )}

  </div>
);
};
