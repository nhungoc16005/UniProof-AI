import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/apiClient';
import { Evidence } from '../../types';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { TableSkeleton } from '../../components/ui/Skeleton';

export const EvidenceList: React.FC = () => {
  const { user, activeTerm } = useAuth();
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [filterTab, setFilterTab] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchEvidences = () => {
    setIsLoading(true);
    apiClient.getEvidences({ studentId: user.id, termId: activeTerm.id }).then((data) => {
      setEvidences(data);
      setIsLoading(false);
    });
  };

  useEffect(() => {
    fetchEvidences();
  }, [user.id, activeTerm.id]);

  const handleWithdraw = async (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn rút hồ sơ minh chứng này không?')) {
      const ok = await apiClient.withdrawEvidence(id);
      if (ok) {
        fetchEvidences();
      }
    }
  };

  // Filter counts
  const counts = useMemo(() => {
    const all = evidences.length;
    const approved = evidences.filter((e) => e.status === 'APPROVED').length;
    const supplement = evidences.filter((e) => e.status === 'NEEDS_SUPPLEMENT').length;
    const reviewing = evidences.filter((e) => e.status === 'NEEDS_HUMAN_REVIEW' || e.status === 'PROCESSING' || e.status === 'PLAUSIBLE').length;
    return { all, approved, supplement, reviewing };
  }, [evidences]);

  const filtered = useMemo(() => {
    return evidences.filter((item) => {
      if (filterTab === 'APPROVED' && item.status !== 'APPROVED') return false;
      if (filterTab === 'SUPPLEMENT' && item.status !== 'NEEDS_SUPPLEMENT') return false;
      if (filterTab === 'REVIEWING' && item.status !== 'NEEDS_HUMAN_REVIEW' && item.status !== 'PROCESSING' && item.status !== 'PLAUSIBLE') return false;

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = item.declaredActivityName?.toLowerCase().includes(query);
        const matchesId = item.id.toLowerCase().includes(query);
        if (!matchesName && !matchesId) return false;
      }
      return true;
    });
  }, [evidences, filterTab, searchQuery]);

  return (
    <div className="space-y-6 pb-12">
      
      {/* 1. Header with Term info and Quick Action */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.05)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-[#1d6fc2] mb-2 border border-blue-100">
            <span>{activeTerm.name}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Minh chứng của tôi
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Theo dõi tiến trình thẩm định và kết quả ghi nhận điểm rèn luyện của từng hồ sơ.
          </p>
        </div>

        {activeTerm.status === 'ACTIVE' && (
          <Link
            to="/student/evidence/new"
            className="px-4 py-2.5 bg-[#1d6fc2] hover:bg-[#175ea5] active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition cursor-pointer shrink-0"
          >
            Nộp minh chứng mới
          </Link>
        )}
      </div>

      {/* 2. Sleek Filter Tabs & Search Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.05)] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        
        {/* Rounded Pills Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => setFilterTab('ALL')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              filterTab === 'ALL'
                ? 'bg-[#1d6fc2] text-white shadow-sm shadow-blue-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Tất cả ({counts.all})
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('APPROVED')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              filterTab === 'APPROVED'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            Đã duyệt ({counts.approved})
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('SUPPLEMENT')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              filterTab === 'SUPPLEMENT'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-amber-800 hover:bg-amber-50'
            }`}
          >
            Cần bổ sung ({counts.supplement})
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('REVIEWING')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              filterTab === 'REVIEWING'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-indigo-700 hover:bg-indigo-50'
            }`}
          >
            Đang xử lý ({counts.reviewing})
          </button>
        </div>

        {/* High-quality Search Input */}
        <div className="w-full md:w-80">
          <input
            type="text"
            placeholder="Tìm theo tên hoạt động hoặc mã..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3.5 py-2 text-xs bg-slate-50/80 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none transition font-medium"
          />
        </div>
      </div>

      {/* 3. Enterprise Evidences Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_4px_24px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
        {isLoading ? (
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4 text-xs font-semibold text-slate-500">
              <span className="w-2 h-2 rounded-full bg-[#1d6fc2] animate-pulse" />
              Đang tải danh sách minh chứng...
            </div>
            <TableSkeleton rows={4} cols={6} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <p className="text-xs font-bold text-slate-700">Không tìm thấy hồ sơ minh chứng nào</p>
            <p className="text-[11px] text-slate-400">Không có hồ sơ nào trùng khớp với bộ lọc hiện tại.</p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs min-w-[820px]">
              <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4 min-w-[220px]">Tên hoạt động</th>
                  <th className="py-3.5 px-4 whitespace-nowrap min-w-[140px]">Loại minh chứng</th>
                  <th className="py-3.5 px-4 whitespace-nowrap min-w-[100px]">Ngày nộp</th>
                  <th className="py-3.5 px-4 whitespace-nowrap min-w-[140px]">Trạng thái</th>
                  <th className="py-3.5 px-4 whitespace-nowrap min-w-[140px]">Điểm số</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap min-w-[180px]">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item) => {
                  const officialScore = item.reviews?.[0]?.finalScore;
                  const aiScore = item.aiSuggestions?.[0]?.suggestedScore;

                  return (
                    <tr key={item.id} className="hover:bg-blue-50/30 transition-colors duration-150">
                      <td className="py-4 px-4">
                        <Link
                          to={`/student/evidence/${item.id}`}
                          className="font-bold text-slate-900 hover:text-[#1d6fc2] block transition leading-snug"
                        >
                          {item.declaredActivityName}
                        </Link>
                        <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">ID: {item.id}</span>
                      </td>

                      <td className="py-4 px-4 text-slate-600 font-medium whitespace-nowrap">
                        {item.evidenceType}
                      </td>

                      <td className="py-4 px-4 text-slate-500 whitespace-nowrap">
                        {new Date(item.submittedAt).toLocaleDateString('vi-VN')}
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        <StatusBadge status={item.status} />
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        {officialScore !== undefined ? (
                          <span className="font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 whitespace-nowrap inline-block">
                            {officialScore} điểm (Chính thức)
                          </span>
                        ) : aiScore !== undefined ? (
                          <span className="font-semibold text-blue-600 bg-blue-50/70 px-2.5 py-1 rounded-lg border border-dashed border-blue-200 whitespace-nowrap inline-block">
                            +{aiScore} đ (Đề xuất)
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-2">
                          {item.status === 'NEEDS_SUPPLEMENT' && (
                            <Link
                              to={`/student/evidence/${item.id}/supplement`}
                              className="px-3 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs transition whitespace-nowrap shrink-0"
                            >
                              Bổ sung
                            </Link>
                          )}

                          <Link
                            to={`/student/evidence/${item.id}`}
                            className="px-3 py-1.5 text-xs font-semibold text-[#1d6fc2] hover:bg-blue-50 rounded-lg border border-blue-200 transition whitespace-nowrap shrink-0"
                          >
                            Xem chi tiết
                          </Link>

                          {/* Cho phép rút hồ sơ nếu chưa được duyệt */}
                          {item.status !== 'APPROVED' && item.status !== 'WITHDRAWN' && (
                            <button
                              onClick={() => handleWithdraw(item.id)}
                              className="px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              Rút
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

    </div>
  );
};
