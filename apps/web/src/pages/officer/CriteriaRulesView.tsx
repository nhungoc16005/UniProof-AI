import React, { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../../lib/apiClient';
import { Criterion } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Layers, Search, BookOpen, ShieldCheck, Scale, Award } from 'lucide-react';

const scoringKindLabels: Record<string, string> = {
  manual_verified: 'Cán bộ xác minh và chốt điểm',
  attendance_penalty: 'Điểm nền và các mức trừ chuyên cần',
  group_penalty: 'Điểm theo mức độ hoàn thành làm việc nhóm',
  conduct_penalty: 'Điểm nền và các mức trừ vi phạm',
  leadership_duty: 'Điểm theo chức vụ và xác nhận tập thể',
  academic_effort: 'Điểm theo kết quả và tiến bộ học tập',
  verified_boolean: 'Đạt hoặc không đạt sau xác minh',
  award_tier: 'Điểm theo mức thành tích',
  activity_threshold: 'Điểm theo số hoạt động đã xác minh',
  all_conditions: 'Phải đáp ứng đầy đủ các điều kiện',
  community_activity_tier: 'Điểm theo số hoạt động và điểm quy đổi',
};

export const CriteriaRulesView: React.FC = () => {
  const { activeTerm } = useAuth();
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  useEffect(() => {
    setIsLoading(true);
    if (!activeTerm.id) return;
    apiClient
      .getRubric(activeTerm.id)
      .then((data) => {
        setCriteria(data.criteria || []);
      })
      .catch((err) => {
        console.error('Lỗi khi tải tiêu chí:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [activeTerm.id]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    criteria.forEach((c) => {
      if (c.category) set.add(c.category);
    });
    return Array.from(set);
  }, [criteria]);

  const filteredCriteria = useMemo(() => {
    return criteria.filter((c) => {
      if (selectedCategory !== 'ALL' && c.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCode = c.code.toLowerCase().includes(q);
        const matchName = c.name.toLowerCase().includes(q);
        const matchDesc = c.description?.toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchDesc) return false;
      }
      return true;
    });
  }, [criteria, selectedCategory, searchQuery]);

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Danh mục Tiêu chí & Quy tắc Đánh giá</h1>
          <p className="text-xs text-slate-500 mt-1">
            Tra cứu bộ tiêu chí và quy chế áp dụng cho kỳ đánh giá đang chọn.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold">
          <BookOpen className="w-4 h-4 text-blue-600" />
          <span>{criteria.length} tiêu chí quy định</span>
        </div>
      </div>

      {/* 2. Search & Category Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              selectedCategory === 'ALL'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Tất cả ({criteria.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo mã điều khoản, tên tiêu chí..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
          />
        </div>
      </div>

      {/* 3. Criteria List */}
      {isLoading ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <span className="text-xs text-slate-500 font-medium">Đang tải danh mục tiêu chí từ cơ sở dữ liệu...</span>
        </div>
      ) : filteredCriteria.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl text-xs text-slate-400">
          Không tìm thấy tiêu chí nào phù hợp.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCriteria.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      Điều {item.code}
                    </span>
                    {item.category && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">
                        {item.category}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Tối đa: {item.maxScore} đ
                    </span>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-slate-900 leading-snug">{item.name}</h3>

                {item.description && (
                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    {item.description}
                  </p>
                )}

                {/* Sub-roles score breakdown if available */}
                {item.rolesScore && typeof item.rolesScore === 'object' && Object.keys(item.rolesScore).length > 0 && (
                  <div className="pt-2">
                    <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Điểm theo vai trò:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(item.rolesScore).map(([role, pts]) => (
                        <span
                          key={role}
                          className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-semibold text-slate-700"
                        >
                          {role}: <strong className="text-slate-900 font-bold">+{pts}đ</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {item.scoringConfig && typeof item.scoringConfig === 'object' && (
                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                      <Scale className="w-3 h-3 text-slate-500" />
                      <span>Cách tính điểm:</span>
                    </div>
                    <div className="p-2 rounded bg-amber-50/60 border border-amber-200 text-[11px] text-amber-900">
                      <div className="font-bold">{scoringKindLabels[String(item.scoringConfig.kind)] || 'Tính theo cấu hình rubric của kỳ'}</div>
                      <div className="mt-0.5 text-[10px] text-amber-800">Backend tính điểm đề xuất từ dữ liệu đã xác minh; cán bộ chịu trách nhiệm chốt điểm chính thức.</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
