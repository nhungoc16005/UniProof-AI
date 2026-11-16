import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/apiClient';
import { Evidence } from '../../types';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

export const EvidenceList: React.FC = () => {
  const { user, activeTerm, terms } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTermId = searchParams.get('termId');
  const selectedTerm = (urlTermId && terms.find((t) => t.id === urlTermId)) || activeTerm;
  const effectiveTermId = selectedTerm?.id || activeTerm?.id || '';

  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [filterTab, setFilterTab] = useState<'ALL' | 'APPROVED' | 'SUPPLEMENT' | 'REVIEWING'>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ all: 0, approved: 0, supplement: 0, reviewing: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const requestGen = useRef(0);

  // Đồng bộ URL ?termId=... nếu chưa có param
  useEffect(() => {
    if (effectiveTermId && !urlTermId) {
      const next = new URLSearchParams(searchParams);
      next.set('termId', effectiveTermId);
      setSearchParams(next, { replace: true });
    }
  }, [effectiveTermId, urlTermId, searchParams, setSearchParams]);

  // Reset page = 1 khi effectiveTermId thay đổi
  const prevTermIdRef = useRef(effectiveTermId);
  useEffect(() => {
    if (prevTermIdRef.current !== effectiveTermId) {
      prevTermIdRef.current = effectiveTermId;
      setPage(1);
    }
  }, [effectiveTermId]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1); // Reset trang khi tìm kiếm
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleTermChange = (newTermId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('termId', newTermId);
    next.delete('page');
    setSearchParams(next);
    setPage(1);
  };

  const fetchEvidences = async () => {
    const currentGen = ++requestGen.current;
    setIsLoading(true);
    setLoadError('');
    try {
      const res = await apiClient.getEvidencesPage({
        studentId: user.id,
        termId: effectiveTermId,
        statusGroup: filterTab,
        search: debouncedSearch || undefined,
        page,
        pageSize,
      });
      if (currentGen !== requestGen.current) return;
      setEvidences(res.items);
      setTotal(res.total);
      if (res.counts) {
        setCounts(res.counts);
      }
    } catch {
      if (currentGen !== requestGen.current) return;
      setEvidences([]);
      setLoadError('Không tải được minh chứng từ máy chủ. Vui lòng thử lại.');
    } finally {
      if (currentGen === requestGen.current) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    void fetchEvidences();
  }, [user.id, effectiveTermId, filterTab, debouncedSearch, page]);

  const handleWithdraw = async (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn rút hồ sơ minh chứng này không?')) {
      const ok = await apiClient.withdrawEvidence(id);
      if (ok) {
        if (evidences.length === 1 && page > 1) {
          setPage((p) => p - 1);
        } else {
          void fetchEvidences();
        }
      }
    }
  };

  const handleDeleteEvidence = async (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa hồ sơ minh chứng này không? Dữ liệu sẽ không thể khôi phục.')) {
      try {
        await apiClient.deleteEvidence(id);
        alert('Đã xóa hồ sơ minh chứng.');
        if (evidences.length === 1 && page > 1) {
          setPage((p) => p - 1);
        } else {
          void fetchEvidences();
        }
      } catch (err: any) {
        alert(err.response?.data?.message || 'Không thể xóa hồ sơ.');
      }
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6 pb-12">
      {loadError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {loadError}
          <button onClick={() => void fetchEvidences()} className="ml-2 underline font-semibold">
            Thử lại
          </button>
        </div>
      )}

      {/* 1. Header with Term info and Quick Action */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.05)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <select
              value={effectiveTermId}
              onChange={(e) => handleTermChange(e.target.value)}
              className="text-xs font-semibold bg-blue-50 text-[#1d6fc2] border border-blue-100 rounded-xl px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
            >
              {(terms.length > 0 ? terms : [activeTerm]).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.status === 'ACTIVE' ? '(Hiện hành)' : ''}
                </option>
              ))}
            </select>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Minh chứng của tôi
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Theo dõi tiến trình thẩm định và kết quả ghi nhận điểm rèn luyện của từng hồ sơ.
          </p>
        </div>

        {selectedTerm?.status === 'ACTIVE' && (
          <Link
            to={`/student/scores?termId=${effectiveTermId}`}
            className="px-4 py-2.5 bg-[#1d6fc2] hover:bg-[#175ea5] active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition cursor-pointer shrink-0"
          >
            Mở phiếu đánh giá
          </Link>
        )}
      </div>

      {/* 2. Sleek Filter Tabs & Search Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.05)] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Rounded Pills Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => {
              setFilterTab('ALL');
              setPage(1);
            }}
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
            onClick={() => {
              setFilterTab('APPROVED');
              setPage(1);
            }}
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
            onClick={() => {
              setFilterTab('SUPPLEMENT');
              setPage(1);
            }}
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
            onClick={() => {
              setFilterTab('REVIEWING');
              setPage(1);
            }}
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
        <div className="w-full md:w-80 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo tên hoạt động hoặc mã..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50/80 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none transition font-medium"
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
        ) : evidences.length === 0 ? (
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
                {evidences.map((item) => {
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

                          {/* Cho phép rút hồ sơ nếu đang chờ duyệt */}
                          {item.status !== 'APPROVED' && item.status !== 'WITHDRAWN' && (
                            <button
                              onClick={() => handleWithdraw(item.id)}
                              className="px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              Rút
                            </button>
                          )}

                          {/* Cho phép xóa hồ sơ nếu chưa duyệt chính thức */}
                          {item.status !== 'APPROVED' && (
                            <button
                              onClick={() => handleDeleteEvidence(item.id)}
                              className="px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              Xóa
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

        {/* 4. Pagination Bar */}
        {!isLoading && total > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-slate-50/75 border-t border-slate-200 text-xs text-slate-600">
            <div>
              Hiển thị <strong>{(page - 1) * pageSize + 1}</strong> – <strong>{Math.min(page * pageSize, total)}</strong> trên tổng số <strong>{total}</strong> hồ sơ
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                Trang trước
              </button>
              <span className="font-semibold text-slate-700 px-1">
                Trang {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition cursor-pointer"
              >
                Trang sau
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
