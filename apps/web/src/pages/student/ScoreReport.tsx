import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/apiClient';
import { Evidence } from '../../types';
import { calculateStudentConductScore } from '../../lib/ruleEngine';
import { Printer, CheckCircle, Award, FileText, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const ScoreReport: React.FC = () => {
  const { user, activeTerm } = useAuth();
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      setIsLoading(true);
      apiClient.getEvidences({ studentId: user.id, termId: activeTerm.id }).then((data) => {
        setEvidences(data);
        setIsLoading(false);
      });
    }
  }, [user?.id, activeTerm.id]);

  // Rule Engine calculations from real DB data
  const { allCriteria, categorySummaries, totalOfficialScore, totalAiScore } = useMemo(() => {
    return calculateStudentConductScore(evidences);
  }, [evidences]);

  const totalScore = totalOfficialScore;

  const rank = useMemo(() => {
    if (totalScore >= 90) return { name: 'Loại Xuất sắc', color: 'text-purple-700 bg-purple-50 border-purple-200' };
    if (totalScore >= 80) return { name: 'Loại Tốt', color: 'text-blue-700 bg-blue-50 border-blue-200' };
    if (totalScore >= 65) return { name: 'Loại Khá', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    if (totalScore >= 50) return { name: 'Loại Trung bình', color: 'text-amber-700 bg-amber-50 border-amber-200' };
    return { name: 'Loại Yếu / Kém', color: 'text-rose-700 bg-rose-50 border-rose-200' };
  }, [totalScore]);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img
            src="/dut-logo.png"
            alt="DUT Logo"
            className="w-12 h-12 object-contain shrink-0"
          />
          <div>
            <h1 className="text-xl font-bold text-slate-900">Bảng điểm rèn luyện & Truy vết (S09)</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Trường Đại học Bách Khoa – ĐH Đà Nẵng · {activeTerm.name}
            </p>
          </div>
        </div>

        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white text-slate-700 hover:bg-slate-50 border border-slate-300 font-semibold text-xs rounded-lg shadow-sm transition"
        >
          <Printer className="w-4 h-4 text-slate-500" />
          <span>In / Xuất PDF</span>
        </button>
      </div>

      {/* Student Card Summary */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
        <div>
          <span className="text-slate-400 block font-medium">Họ và tên sinh viên</span>
          <span className="text-slate-900 font-bold text-sm">{user?.fullName}</span>
        </div>
        <div>
          <span className="text-slate-400 block font-medium">Mã số sinh viên (MSSV)</span>
          <span className="text-slate-900 font-semibold text-sm">{user?.studentCode || '102210001'}</span>
        </div>
        <div>
          <span className="text-slate-400 block font-medium">Lớp sinh hoạt / Khoa</span>
          <span className="text-slate-900 font-semibold text-sm">
            {user?.class?.code || '21TCLC_DT1'} · {user?.class?.faculty?.name || user?.faculty?.name || 'Khoa CNTT'}
          </span>
        </div>
        <div className="sm:text-right">
          <span className="text-slate-400 block font-medium">Tổng điểm chính thức / Xếp loại</span>
          <span className="text-emerald-700 font-extrabold text-base">
            {totalScore} / 100 ({rank.name})
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
          Đang tính toán bảng điểm rèn luyện từ cơ sở dữ liệu...
        </div>
      ) : (
        /* Traceability Table by 5 Categories */
        <div className="space-y-4">
          {categorySummaries.map((cat, idx) => {
            const catCriteria = allCriteria.filter((c) => c.category === cat.category);

            return (
              <div key={idx} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs text-slate-900 uppercase">{cat.name}</span>
                    <span className="text-[11px] text-slate-400 ml-2">({cat.category})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      {cat.officialScore} / {cat.maxScore} điểm
                    </span>
                    {cat.officialScore >= cat.maxScore && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded">
                        Đạt trần
                      </span>
                    )}
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {catCriteria.map((item, i) => (
                    <div key={i} className="p-3.5 px-5 flex items-start justify-between text-xs hover:bg-slate-50/50 transition gap-4">
                      <div className="space-y-1 max-w-2xl">
                        <span className="font-semibold text-slate-800 block">
                          Tiêu chí {item.code}: {item.name}
                        </span>
                        <p className="text-[11px] text-slate-500">
                          {item.tierDescription}
                        </p>
                        {item.nextTierAdvice && (
                          <span className="text-[11px] text-[#1d6fc2] block font-medium">
                            💡 Gợi ý: {item.nextTierAdvice}
                          </span>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`font-bold px-2.5 py-1 rounded border block text-xs ${
                          item.officialScore > 0
                            ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                            : 'text-slate-400 bg-slate-50 border-slate-200'
                        }`}>
                          +{item.officialScore} / {item.maxScore} đ
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer Summary Notice */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <span className="text-slate-600">
          Dữ liệu bảng điểm được cập nhật theo thời gian thực từ các minh chứng đã được Cán bộ phê duyệt và đối chiếu tự động.
        </span>
        <Link
          to="/student/criteria"
          className="font-bold text-[#1d6fc2] hover:underline flex items-center gap-1 shrink-0"
        >
          <span>Xem quy chế 16 tiêu chí</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

    </div>
  );
};
