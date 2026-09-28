import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../lib/apiClient';
import { Criterion } from '../../types';

export const CriteriaView: React.FC = () => {
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [viewMode, setViewMode] = useState<'TABLE' | 'ACCORDION'>('TABLE');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  useEffect(() => {
    apiClient.getCriteria().then(setCriteria);
  }, []);

  const categories = [
    { key: 'KHUNG_I', roman: 'I', name: 'Ý thức tham gia học tập', max: 20 },
    { key: 'KHUNG_II', roman: 'II', name: 'Ý thức chấp hành nội quy, quy chế, quy định', max: 25 },
    { key: 'KHUNG_III', roman: 'III', name: 'Ý thức tham gia các hoạt động chính trị, xã hội, phong trào', max: 20 },
    { key: 'KHUNG_IV', roman: 'IV', name: 'Ý thức công dân trong quan hệ cộng đồng', max: 25 },
    { key: 'KHUNG_V', roman: 'V', name: 'Ý thức và kết quả khi tham gia công tác cán bộ lớp, đoàn thể', max: 10 },
  ];

  // Calculations
  const totalMax = 100;
  const totalSelfScore = useMemo(() => {
    return criteria.reduce((sum, c) => sum + (c.selfScore || 0), 0);
  }, [criteria]);

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
            Nội dung Tiêu chí Chấm điểm Rèn luyện
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Quy định khung đánh giá kết quả rèn luyện sinh viên theo 5 khung tiêu chí (Thang điểm 100).
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <Link
            to="/regulations/ask"
            className="flex-1 sm:flex-initial text-center px-4 py-2 bg-blue-50 hover:bg-blue-100 text-[#1d6fc2] font-bold text-xs rounded-xl border border-blue-200 transition"
          >
            Hỏi đáp AI về quy chế
          </Link>

          <Link
            to="/student/evidence/new"
            className="flex-1 sm:flex-initial text-center px-4 py-2 bg-[#1d6fc2] hover:bg-[#175ea5] text-white font-bold text-xs rounded-xl shadow-sm transition"
          >
            Nộp minh chứng
          </Link>
        </div>
      </div>

      {/* 2. Overview Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {categories.map((cat) => {
          const catCriteria = criteria.filter((c) => c.category === cat.key);
          const catSelf = catCriteria.reduce((sum, c) => sum + (c.selfScore || 0), 0);

          return (
            <div
              key={cat.key}
              onClick={() => setSelectedCategory(selectedCategory === cat.key ? 'ALL' : cat.key)}
              className={`p-3.5 rounded-2xl border transition cursor-pointer ${
                selectedCategory === cat.key
                  ? 'bg-blue-50/80 border-[#1d6fc2] ring-1 ring-[#1d6fc2]'
                  : 'bg-white border-slate-200/90 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
                <span>KHUNG {cat.roman}</span>
                <span className="text-[#1d6fc2] font-mono">{catSelf}/{cat.max}đ</span>
              </div>
              <div className="font-bold text-xs text-slate-800 line-clamp-1" title={cat.name}>
                {cat.name}
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Filter Bar & View Mode Toggle */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        
        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
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
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                selectedCategory === cat.key
                  ? 'bg-[#1d6fc2] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Khung {cat.roman} ({cat.max}đ)
            </button>
          ))}
        </div>

        {/* Search */}
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

      {/* 4. Official Evaluation Form Table (Đúng chuẩn mẫu Bách Khoa ĐN) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_4px_24px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs min-w-[980px] border-collapse">
            
            {/* Table Header (Mô phỏng phiếu đánh giá chính thức) */}
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3 w-14 text-center border-r border-slate-200" rowSpan={2}>
                  STT
                </th>
                <th className="py-3 px-4 border-r border-slate-200" rowSpan={2}>
                  Nội dung tiêu chí chấm điểm rèn luyện
                </th>
                <th className="py-3 px-3 w-20 text-center border-r border-slate-200" rowSpan={2}>
                  Điểm tối đa
                </th>
                <th className="py-2 px-3 text-center border-r border-slate-200 bg-amber-50/60" colSpan={2}>
                  Tự đánh giá
                </th>
                <th className="py-2 px-3 text-center bg-blue-50/60" colSpan={2}>
                  Lớp đánh giá
                </th>
              </tr>
              <tr className="bg-slate-100/50 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                <th className="py-1.5 px-3 w-16 text-center border-r border-slate-200 bg-amber-50/40">Điểm</th>
                <th className="py-1.5 px-3 w-32 border-r border-slate-200 bg-amber-50/40">Ghi chú</th>
                <th className="py-1.5 px-3 w-16 text-center border-r border-slate-200 bg-blue-50/40">Điểm</th>
                <th className="py-1.5 px-3 w-32 bg-blue-50/40">Ghi chú</th>
              </tr>
            </thead>

            {/* Table Body grouped by Category */}
            <tbody>
              {categories.map((cat) => {
                const catCriteria = filteredCriteria.filter((c) => c.category === cat.key);
                if (catCriteria.length === 0 && selectedCategory !== 'ALL' && selectedCategory !== cat.key) {
                  return null;
                }
                const catSelf = criteria
                  .filter((c) => c.category === cat.key)
                  .reduce((sum, c) => sum + (c.selfScore || 0), 0);

                return (
                  <React.Fragment key={cat.key}>
                    
                    {/* Category Master Header Row (Màu vàng nhạt đặc trưng như ảnh) */}
                    <tr className="bg-[#fef9e7] border-y border-amber-200 font-bold text-slate-900 text-xs">
                      <td className="py-3 px-3 text-center border-r border-amber-200/80 font-black">
                        {cat.roman}
                      </td>
                      <td className="py-3 px-4 border-r border-amber-200/80">
                        {cat.name} <span className="font-normal text-slate-600">(Khung điểm đánh giá: Từ 0 đến {cat.max} điểm)</span>
                      </td>
                      <td className="py-3 px-3 text-center border-r border-amber-200/80 font-black text-amber-900">
                        {cat.max}
                      </td>
                      <td className="py-3 px-3 text-center border-r border-amber-200/80 font-black text-amber-900 bg-amber-100/60">
                        {catSelf}
                      </td>
                      <td className="py-3 px-3 border-r border-amber-200/80 text-slate-400 font-normal">
                        —
                      </td>
                      <td className="py-3 px-3 text-center border-r border-amber-200/80 text-slate-400">
                        —
                      </td>
                      <td className="py-3 px-3 text-slate-400 font-normal">
                        —
                      </td>
                    </tr>

                    {/* Criteria Sub-rows */}
                    {catCriteria.map((c) => {
                      return (
                        <tr key={c.id} className="hover:bg-slate-50/80 border-b border-slate-100 transition-colors">
                          
                          {/* Stt */}
                          <td className="py-3.5 px-3 text-center font-bold text-slate-700 border-r border-slate-100 align-top">
                            {c.code}
                          </td>

                          {/* Content & Sub-rules */}
                          <td className="py-3.5 px-4 border-r border-slate-100 space-y-2 align-top">
                            <div className="font-bold text-slate-900 text-xs leading-snug">
                              {c.name}
                            </div>

                            {/* Sub-rules list */}
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

                          {/* Max Score */}
                          <td className="py-3.5 px-3 text-center font-bold text-slate-800 border-r border-slate-100 align-top">
                            {c.maxScore}
                          </td>

                          {/* Self Score (Màu cam đào như ảnh gốc) */}
                          <td className="py-3.5 px-3 text-center font-black border-r border-slate-100 align-top bg-orange-50/60 text-orange-950">
                            <span className="inline-block px-2 py-0.5 rounded bg-orange-200/70 border border-orange-300 font-mono text-xs">
                              {c.selfScore ?? 0}
                            </span>
                          </td>

                          {/* Self Notes */}
                          <td className="py-3.5 px-3 border-r border-slate-100 text-[11px] text-slate-400 align-top">
                            {c.notes || '—'}
                          </td>

                          {/* Class Score */}
                          <td className="py-3.5 px-3 text-center border-r border-slate-100 text-slate-400 align-top">
                            {c.classScore !== undefined ? c.classScore : '—'}
                          </td>

                          {/* Class Notes */}
                          <td className="py-3.5 px-3 text-[11px] text-slate-400 align-top">
                            —
                          </td>

                        </tr>
                      );
                    })}

                  </React.Fragment>
                );
              })}

              {/* Total Footer Row (Điểm tổng) */}
              <tr className="bg-slate-100/90 border-t-2 border-slate-300 font-black text-xs text-slate-900">
                <td className="py-4 px-3 text-center border-r border-slate-200">
                  ∑
                </td>
                <td className="py-4 px-4 border-r border-slate-200 uppercase tracking-wider text-sm font-black">
                  Điểm tổng cộng (Thang điểm 100)
                </td>
                <td className="py-4 px-3 text-center border-r border-slate-200 text-sm font-black text-[#1d6fc2]">
                  {totalMax}
                </td>
                <td className="py-4 px-3 text-center border-r border-slate-200 text-sm font-black text-orange-900 bg-orange-100">
                  {totalSelfScore}
                </td>
                <td className="py-4 px-3 border-r border-slate-200 text-slate-600 font-semibold text-[11px]">
                  Xếp loại: Tốt
                </td>
                <td className="py-4 px-3 text-center border-r border-slate-200 text-slate-400">
                  —
                </td>
                <td className="py-4 px-3 text-slate-400 font-normal">
                  —
                </td>
              </tr>

            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Helpful Notes for Students */}
      <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl text-xs space-y-1.5 text-blue-950">
        <span className="font-bold uppercase tracking-wider block text-[11px] text-[#1d6fc2]">
          Lưu ý khi tự đánh giá và nộp minh chứng:
        </span>
        <ul className="list-disc list-inside space-y-1 text-slate-700 leading-relaxed">
          <li>Mỗi minh chứng (giấy chứng nhận, giấy khen, quyết định) chỉ được sử dụng để tính điểm cho 01 tiêu chí duy nhất.</li>
          <li>Đối với Tiêu chí 4 và 5: Cần có quyết định thành lập hoặc xác nhận hợp lệ của đơn vị quản lý kèm danh sách.</li>
          <li>Điểm tự đánh giá sẽ được tập thể Lớp sinh hoạt và Cán bộ Khoa thẩm định đối soát trước khi chốt điểm chính thức.</li>
        </ul>
      </div>

    </div>
  );
};
