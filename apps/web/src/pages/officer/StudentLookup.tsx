import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, UserCheck, Award, Eye, FileText, ChevronRight } from 'lucide-react';
import { mockEvidences } from '../../lib/mockData';

export const StudentLookup: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('102210001');

  const studentData = {
    fullName: 'Nguyễn Văn An',
    studentCode: '102210001',
    class: '21TCLC_DT1',
    faculty: 'Khoa Công nghệ Thông tin',
    cohort: 'K21',
    currentScore: 82.5,
    rank: 'Tốt',
    historyTerms: [
      { term: 'HK1 (2026-2027)', score: 82.5, rank: 'Tốt', status: 'Đang chấm' },
      { term: 'HK2 (2025-2026)', score: 88.0, rank: 'Tốt', status: 'Đã chốt' },
      { term: 'HK1 (2025-2026)', score: 91.0, rank: 'Xuất sắc', status: 'Đã chốt' },
    ],
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Tra cứu thông tin & Điểm sinh viên (O09)</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Xem lịch sử tích lũy điểm rèn luyện và toàn bộ minh chứng của từng sinh viên trong khoa.
        </p>
      </div>

      {/* Search Input */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Nhập Mã số sinh viên (MSSV) hoặc Họ và tên..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none"
          />
        </div>
        <button
          onClick={() => {}}
          className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-lg shadow-sm transition"
        >
          Tìm kiếm
        </button>
      </div>

      {/* Student Details Card */}
      {studentData && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Họ và tên</span>
              <span className="text-slate-900 font-bold text-sm">{studentData.fullName}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">MSSV / Lớp sinh hoạt</span>
              <span className="text-slate-900 font-semibold text-sm">{studentData.studentCode} · {studentData.class}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Khoa / Khóa đào tạo</span>
              <span className="text-slate-900 font-semibold text-sm">{studentData.faculty} ({studentData.cohort})</span>
            </div>
            <div className="sm:text-right">
              <span className="text-slate-400 block font-medium">Điểm kỳ này (Dự kiến)</span>
              <span className="text-emerald-700 font-extrabold text-base">
                {studentData.currentScore} đ ({studentData.rank})
              </span>
            </div>
          </div>

          {/* History Terms */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 font-bold text-xs text-slate-800 uppercase tracking-wider">
              Lịch sử điểm các học kỳ
            </div>

            <div className="divide-y divide-slate-100">
              {studentData.historyTerms.map((t, idx) => (
                <div key={idx} className="p-4 px-5 flex items-center justify-between text-xs hover:bg-slate-50/50 transition">
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-900">{t.term}</span>
                    <span className="text-slate-400 block text-[11px]">{t.status}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-slate-800 text-sm">{t.score} đ</span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                      {t.rank}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Evidences list in current term */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
              Minh chứng sinh viên đã nộp trong kỳ ({mockEvidences.length})
            </h3>
            <div className="divide-y divide-slate-100 text-xs">
              {mockEvidences.map((e) => (
                <div key={e.id} className="py-2.5 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg transition">
                  <div className="space-y-0.5">
                    <Link 
                      to={`/officer/review/${e.id}`}
                      className="font-semibold text-slate-900 hover:text-sky-600 block transition"
                    >
                      {e.declaredActivityName}
                    </Link>
                    <span className="text-[11px] text-slate-500">{e.evidenceType} · {new Date(e.submittedAt).toLocaleDateString('vi-VN')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {e.reviews?.[0]?.finalScore || e.aiSuggestions?.[0]?.suggestedScore || 0} đ
                    </span>
                    <Link
                      to={`/officer/review/${e.id}`}
                      className="p-1 text-slate-400 hover:text-sky-600 transition"
                      title="Mở hồ sơ đối chiếu"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
