import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../lib/apiClient';
import { Criterion } from '../../types';
import { BookOpen, ChevronDown, ChevronRight, HelpCircle, Shield, Award } from 'lucide-react';

export const CriteriaView: React.FC = () => {
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>('crit-1.1');

  useEffect(() => {
    apiClient.getCriteria().then(setCriteria);
  }, []);

  const categories = [
    { key: 'KHUNG_I', name: 'Khung I: Đánh giá về ý thức học tập', max: 20 },
    { key: 'KHUNG_II', name: 'Khung II: Ý thức chấp hành pháp luật và nội quy nhà trường', max: 25 },
    { key: 'KHUNG_III', name: 'Khung III: Tham gia các hoạt động chính trị - xã hội, văn hóa, thể thao', max: 20 },
    { key: 'KHUNG_IV', name: 'Khung IV: Phẩm chất công dân và quan hệ cộng đồng', max: 25 },
    { key: 'KHUNG_V', name: 'Khung V: Ý thức và kết quả tham gia công tác phụ trách lớp, đoàn thể', max: 10 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Tiêu chí & Quy chế Đánh giá (S02)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Biểu điểm khung và điều kiện minh chứng chuẩn theo Quy chế Rèn luyện hiện hành (v2025.1).
          </p>
        </div>

        <Link
          to="/regulations/ask"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-sky-50 text-sky-700 hover:bg-sky-100 font-semibold text-xs rounded-lg border border-sky-200 transition"
        >
          <HelpCircle className="w-4 h-4" />
          <span>Hỏi đáp quy chế (RAG AI)</span>
        </Link>
      </div>

      <div className="space-y-4">
        {categories.map((cat) => {
          const catCriteria = criteria.filter((c) => c.category === cat.key);

          return (
            <div key={cat.key} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-slate-50 px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-sky-600" />
                  <span className="font-bold text-xs text-slate-800">{cat.name}</span>
                </div>
                <span className="text-xs font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full">
                  Tối đa: {cat.max} điểm
                </span>
              </div>

              <div className="divide-y divide-slate-100 p-2">
                {catCriteria.map((c) => {
                  const isExpanded = expandedId === c.id;
                  return (
                    <div key={c.id} className="p-3 rounded-lg hover:bg-slate-50/50 transition">
                      <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : c.id)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-mono font-bold text-xs rounded">
                            {c.code}
                          </span>
                          <span className="font-semibold text-xs text-slate-900">{c.name}</span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs font-semibold text-emerald-700">
                            +{c.maxScore} đ
                          </span>
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 pl-10 space-y-2">
                          <p>{c.description}</p>
                          <div className="flex items-center gap-2 pt-1 text-[11px] text-sky-700">
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>Căn cứ pháp lý: Quy chế số 2025/QĐ-ĐHBK · Khoản tương ứng</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
