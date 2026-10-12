import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronRight } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import { Evidence, User } from '../../types';

export const StudentLookup: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('102210001');
  const [student, setStudent] = useState<User | null>(null);
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [conductDashboard, setConductDashboard] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setIsLoading(true);
    try {
      const users = await apiClient.getUsers({ search: searchTerm, role: 'STUDENT' });
      if (users.length > 0) {
        const found = users[0];
        setStudent(found);
        const [evList, scoreData] = await Promise.all([
          apiClient.getEvidences({ studentId: found.id }),
          apiClient.getStudentScore(found.id).catch(() => null),
        ]);
        setEvidences(evList);
        setConductDashboard(scoreData);
      } else {
        setStudent(null);
        setEvidences([]);
        setConductDashboard(null);
      }
    } catch (err) {
      console.error('Lỗi tra cứu sinh viên', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handleSearch();
  }, []);

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
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Nhập Mã số sinh viên (MSSV) hoặc Họ và tên..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={isLoading}
          className="px-5 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-semibold text-xs rounded-lg shadow-sm transition"
        >
          {isLoading ? 'Đang tìm...' : 'Tìm kiếm'}
        </button>
      </div>

      {/* Student Details Card */}
      {student ? (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Họ và tên</span>
              <span className="text-slate-900 font-bold text-sm">{student.fullName}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">MSSV / Lớp sinh hoạt</span>
              <span className="text-slate-900 font-semibold text-sm">
                {student.studentCode || 'N/A'} · {student.class?.name || student.classId || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Khoa</span>
              <span className="text-slate-900 font-semibold text-sm">
                {student.faculty?.name || 'Khoa Công nghệ Thông tin'}
              </span>
            </div>
            <div className="sm:text-right">
              <span className="text-slate-400 block font-medium">Điểm rèn luyện kỳ này</span>
              <span className="text-emerald-700 font-extrabold text-base">
                {conductDashboard?.officialScore ?? 0} đ ({conductDashboard?.classification ?? 'Đang chấm'})
              </span>
            </div>
          </div>

          {/* Evidences list in current term */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
              Minh chứng sinh viên đã nộp trong kỳ ({evidences.length})
            </h3>
            {evidences.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">Sinh viên chưa có minh chứng nào trong kỳ này.</div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {evidences.map((e) => (
                  <div key={e.id} className="py-2.5 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg transition">
                    <div className="space-y-0.5">
                      <Link 
                        to={`/officer/review/${e.id}`}
                        className="font-semibold text-slate-900 hover:text-sky-600 block transition"
                      >
                        {e.declaredActivityName}
                      </Link>
                      <span className="text-[11px] text-slate-500">
                        {e.evidenceType} · {new Date(e.submittedAt).toLocaleDateString('vi-VN')}
                      </span>
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
            )}
          </div>
        </div>
      ) : !isLoading && (
        <div className="p-8 bg-white border border-slate-200 rounded-xl text-center text-slate-400 text-xs">
          Không tìm thấy sinh viên nào phù hợp với từ khóa "{searchTerm}".
        </div>
      )}
    </div>
  );
};
