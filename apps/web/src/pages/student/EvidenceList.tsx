import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/apiClient';
import { Evidence } from '../../types';
import { StatusBadge } from '../../components/ui/StatusBadge';

export const EvidenceList: React.FC = () => {
  const { user, activeTerm } = useAuth();
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
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

  const filtered = evidences.filter((item) => {
    if (filterStatus !== 'ALL' && item.status !== filterStatus) return false;
    if (searchQuery && !item.declaredActivityName?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Minh chứng của tôi</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý và theo dõi tiến trình xét duyệt các hồ sơ minh chứng trong {activeTerm.name}.
          </p>
        </div>

        {activeTerm.status === 'ACTIVE' && (
          <Link
            to="/student/evidence/new"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm shadow-blue-500/20 transition"
          >
            Nộp minh chứng mới
          </Link>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* Search */}
        <div className="w-full sm:w-80">
          <input
            type="text"
            placeholder="Tìm theo tên hoạt động hoặc mã hồ sơ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition"
          />
        </div>

        {/* Filter Status */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
          >
            <option value="ALL">Tất cả trạng thái ({evidences.length})</option>
            <option value="APPROVED">Đã duyệt chính thức</option>
            <option value="NEEDS_SUPPLEMENT">Cần bổ sung giấy tờ</option>
            <option value="NEEDS_HUMAN_REVIEW">Chờ cán bộ xem xét</option>
            <option value="VERIFIED">Đã xác minh đối chứng</option>
            <option value="PROCESSING">Đang xử lý AI/OCR</option>
            <option value="REJECTED">Bị từ chối</option>
            <option value="WITHDRAWN">Đã rút</option>
          </select>
        </div>
      </div>

      {/* Evidences Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <p className="text-xs font-semibold text-slate-700">Không tìm thấy hồ sơ minh chứng nào</p>
            <p className="text-[11px] text-slate-400 mt-1">Hãy nộp minh chứng mới để tích lũy điểm rèn luyện.</p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs min-w-[820px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4 min-w-[220px]">Tên hoạt động</th>
                  <th className="py-3 px-4 whitespace-nowrap min-w-[140px]">Loại minh chứng</th>
                  <th className="py-3 px-4 whitespace-nowrap min-w-[100px]">Ngày nộp</th>
                  <th className="py-3 px-4 whitespace-nowrap min-w-[140px]">Trạng thái</th>
                  <th className="py-3 px-4 whitespace-nowrap min-w-[140px]">Điểm số</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap min-w-[180px]">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item) => {
                  const officialScore = item.reviews?.[0]?.finalScore;
                  const aiScore = item.aiSuggestions?.[0]?.suggestedScore;

                  return (
                    <tr key={item.id} className="hover:bg-blue-50/20 transition">
                      <td className="py-3.5 px-4">
                        <Link
                          to={`/student/evidence/${item.id}`}
                          className="font-bold text-slate-900 hover:text-blue-600 block transition leading-snug"
                        >
                          {item.declaredActivityName}
                        </Link>
                        <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">ID: {item.id}</span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 font-medium whitespace-nowrap">
                        {item.evidenceType}
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                        {new Date(item.submittedAt).toLocaleDateString('vi-VN')}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusBadge status={item.status} />
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {officialScore !== undefined ? (
                          <span className="font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200 whitespace-nowrap inline-block">
                            {officialScore} điểm (Chính thức)
                          </span>
                        ) : aiScore !== undefined ? (
                          <span className="font-semibold text-blue-600 bg-blue-50/70 px-2.5 py-1 rounded-md border border-dashed border-blue-200 whitespace-nowrap inline-block">
                            +{aiScore} đ (Đề xuất)
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-2">
                          {item.status === 'NEEDS_SUPPLEMENT' && (
                            <Link
                              to={`/student/evidence/${item.id}/supplement`}
                              className="px-2.5 py-1 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition whitespace-nowrap shrink-0"
                            >
                              Bổ sung
                            </Link>
                          )}

                          <Link
                            to={`/student/evidence/${item.id}`}
                            className="px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 rounded-lg border border-blue-200 transition whitespace-nowrap shrink-0"
                          >
                            Xem chi tiết
                          </Link>

                          {/* Cho phép rút hồ sơ nếu chưa được duyệt */}
                          {item.status !== 'APPROVED' && item.status !== 'WITHDRAWN' && (
                            <button
                              onClick={() => handleWithdraw(item.id)}
                              className="px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition whitespace-nowrap shrink-0"
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
