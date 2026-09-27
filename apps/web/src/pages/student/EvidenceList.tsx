import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/apiClient';
import { Evidence, EvidenceStatus } from '../../types';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { 
  ListFilter, 
  Search, 
  UploadCloud, 
  Calendar, 
  ChevronRight, 
  FileText,
  Undo2,
  AlertCircle
} from 'lucide-react';

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
          <h1 className="text-xl font-bold text-slate-900">Minh chứng của tôi (S04)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý và theo dõi tiến trình xét duyệt các hồ sơ minh chứng trong {activeTerm.name}.
          </p>
        </div>

        {activeTerm.status === 'ACTIVE' && (
          <Link
            to="/student/evidence/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-lg shadow-sm transition"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Nộp minh chứng mới</span>
          </Link>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo tên hoạt động..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none"
          />
        </div>

        {/* Filter Status */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <ListFilter className="w-4 h-4 text-slate-500 shrink-0" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
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
          <div className="p-8 text-center text-slate-500">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">Không tìm thấy hồ sơ minh chứng nào</p>
            <p className="text-[11px] text-slate-400 mt-1">Hãy nộp minh chứng mới để tích lũy điểm rèn luyện.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Tên hoạt động</th>
                  <th className="py-3 px-4">Loại minh chứng</th>
                  <th className="py-3 px-4">Ngày nộp</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4">Điểm số</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item) => {
                  const officialScore = item.reviews?.[0]?.finalScore;
                  const aiScore = item.aiSuggestions?.[0]?.suggestedScore;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-4">
                        <Link
                          to={`/student/evidence/${item.id}`}
                          className="font-bold text-slate-900 hover:text-sky-600 block"
                        >
                          {item.declaredActivityName}
                        </Link>
                        <span className="text-[10px] text-slate-400">ID: {item.id}</span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 font-medium">
                        {item.evidenceType}
                      </td>

                      <td className="py-3.5 px-4 text-slate-500">
                        {new Date(item.submittedAt).toLocaleDateString('vi-VN')}
                      </td>

                      <td className="py-3.5 px-4">
                        <StatusBadge status={item.status} />
                      </td>

                      <td className="py-3.5 px-4">
                        {officialScore !== undefined ? (
                          <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            {officialScore} điểm (Chính thức)
                          </span>
                        ) : aiScore !== undefined ? (
                          <span className="font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-dashed border-sky-300">
                            ✦ {aiScore} đ (Đề xuất)
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right space-x-2">
                        <Link
                          to={`/student/evidence/${item.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-50 rounded border border-sky-200 transition"
                        >
                          <span>Xem</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>

                        {/* Cho phép rút hồ sơ nếu chưa được duyệt */}
                        {item.status !== 'APPROVED' && item.status !== 'WITHDRAWN' && (
                          <button
                            onClick={() => handleWithdraw(item.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                            title="Rút hồ sơ"
                          >
                            <Undo2 className="w-3 h-3" />
                            <span>Rút</span>
                          </button>
                        )}
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
