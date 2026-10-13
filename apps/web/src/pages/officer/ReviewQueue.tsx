import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';
import { Evidence } from '../../types';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { VerificationBadge } from '../../components/ui/VerificationBadge';
import { Search, Filter, ArrowUpDown, RefreshCw, CheckCircle2 } from 'lucide-react';

export const ReviewQueue: React.FC = () => {
  const { user, activeTerm } = useAuth();

  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [classes, setClasses] = useState<{ id: string; code: string; name: string }[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc'); // FIFO mặc định
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterTab, setFilterTab] = useState<'ALL' | 'FAST_TRACK' | 'MANUAL' | 'SUPPLEMENT' | 'APPROVED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  // Load Classes for Faculty
  useEffect(() => {
    apiClient.getClasses(user?.facultyId).then((res) => {
      setClasses(res || []);
    }).catch(() => setClasses([]));
  }, [user?.facultyId]);

  // Load Real Review Queue from Backend
  const loadQueue = async () => {
    try {
      setIsLoading(true);
      const data = await apiClient.getReviewQueue({
        termId: activeTerm?.id || undefined,
        classId: selectedClassId || undefined,
        sortOrder,
        status: 'ALL',
      });
      setEvidences(data);
    } catch (err) {
      console.error('Lỗi khi tải hàng đợi xét duyệt:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, [activeTerm?.id, selectedClassId, sortOrder]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filtered.map((item) => item.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    if (isBatchProcessing) return;
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Real Batch Approval with optimistic update
  const handleBatchApprove = async () => {
    if (selectedIds.length === 0 || isBatchProcessing) return;
    if (!window.confirm(`Xác nhận duyệt nhanh ${selectedIds.length} hồ sơ đã chọn theo điểm gợi ý của AI / dữ liệu đối chiếu?`)) {
      return;
    }

    setIsBatchProcessing(true);
    setBatchProgress({ current: 0, total: selectedIds.length });
    let successCount = 0;

    for (let i = 0; i < selectedIds.length; i++) {
      const id = selectedIds[i];
      const item = evidences.find((e) => e.id === id);
      const score = item?.aiSuggestions?.[0]?.suggestedScore ?? (item as any)?.declaredScore ?? 5.0;

      try {
        await apiClient.reviewEvidence(id, {
          decision: 'APPROVED',
          finalScore: Number(score),
          reason: 'Duyệt nhanh Fast-Track theo dữ liệu đối chiếu hệ thống.',
        });
        successCount++;
      } catch (err) {
        console.error(`Lỗi duyệt hồ sơ ${id}:`, err);
      }
      setBatchProgress({ current: i + 1, total: selectedIds.length });
    }

    alert(`Đã hoàn tất duyệt thành công ${successCount}/${selectedIds.length} hồ sơ!`);
    setSelectedIds([]);
    setIsBatchProcessing(false);
    await loadQueue();
  };

  // KPI calculations
  const fastTrackCount = evidences.filter((e) => {
    const level = e.verificationResults?.[0]?.verificationLevel || 3;
    return (level === 1 || level === 2) && e.status !== 'APPROVED';
  }).length;

  const manualCount = evidences.filter((e) => {
    const level = e.verificationResults?.[0]?.verificationLevel || 3;
    return level >= 3 && e.status === 'NEEDS_HUMAN_REVIEW';
  }).length;

  const supplementCount = evidences.filter((e) => e.status === 'NEEDS_SUPPLEMENT').length;
  const approvedCount = evidences.filter((e) => e.status === 'APPROVED').length;

  const filtered = useMemo(() => {
    return evidences.filter((e) => {
      const level = e.verificationResults?.[0]?.verificationLevel || 3;

      if (filterTab === 'FAST_TRACK') {
        if (!((level === 1 || level === 2) && e.status !== 'APPROVED')) return false;
      } else if (filterTab === 'MANUAL') {
        if (!(level >= 3 && e.status === 'NEEDS_HUMAN_REVIEW')) return false;
      } else if (filterTab === 'SUPPLEMENT') {
        if (e.status !== 'NEEDS_SUPPLEMENT') return false;
      } else if (filterTab === 'APPROVED') {
        if (e.status !== 'APPROVED') return false;
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = e.declaredActivityName?.toLowerCase().includes(q);
        const matchStudent = e.student?.fullName?.toLowerCase().includes(q);
        const matchCode = e.student?.studentCode?.includes(searchQuery);
        const matchClass = e.student?.class?.code?.toLowerCase().includes(q);
        if (!matchName && !matchStudent && !matchCode && !matchClass) return false;
      }
      return true;
    });
  }, [evidences, filterTab, searchQuery]);

  return (
    <div className="space-y-6 pb-20 relative">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Hàng đợi xét duyệt hồ sơ</h1>
          <p className="text-xs text-slate-500 mt-1">
            Học kỳ: <strong className="text-slate-800 font-semibold">{activeTerm?.name || 'Hiện tại'}</strong> · Tự động phân luồng theo cấp độ xác thực (L1–L5) từ Real Database.
          </p>
        </div>

        <button
          onClick={loadQueue}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
          title="Tải lại danh sách"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Làm mới</span>
        </button>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          onClick={() => setFilterTab('ALL')}
          className={`p-4 rounded-xl border cursor-pointer transition ${
            filterTab === 'ALL'
              ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-200'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Tổng hồ sơ</span>
          </div>
          <div className="text-2xl font-black text-slate-900">{evidences.length}</div>
          <span className="text-[10px] text-slate-500 font-medium">Trong kỳ hiện tại</span>
        </div>

        <div
          onClick={() => setFilterTab('FAST_TRACK')}
          className={`p-4 rounded-xl border cursor-pointer transition ${
            filterTab === 'FAST_TRACK'
              ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-200'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-700 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Fast-track (L1–L2)</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="text-2xl font-black text-emerald-700">{fastTrackCount}</div>
          <span className="text-[10px] text-emerald-600 font-medium">Đủ điều kiện duyệt 1-click</span>
        </div>

        <div
          onClick={() => setFilterTab('MANUAL')}
          className={`p-4 rounded-xl border cursor-pointer transition ${
            filterTab === 'MANUAL'
              ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-200'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-amber-700 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Cần thẩm định (L3–L5)</span>
          </div>
          <div className="text-2xl font-black text-amber-700">{manualCount}</div>
          <span className="text-[10px] text-amber-600 font-medium">Chỉ có chứng nhận ảnh</span>
        </div>

        <div
          onClick={() => setFilterTab('APPROVED')}
          className={`p-4 rounded-xl border cursor-pointer transition ${
            filterTab === 'APPROVED'
              ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-200'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-600 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Đã hoàn tất</span>
          </div>
          <div className="text-2xl font-black text-slate-800">{approvedCount}</div>
          <span className="text-[10px] text-slate-500 font-medium">Đã chốt điểm</span>
        </div>
      </div>

      {/* 2. Priority Segmented Tabs, Class Filter, Sort, Search */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Tab Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          <button
            type="button"
            onClick={() => setFilterTab('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              filterTab === 'ALL'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Tất cả ({evidences.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('FAST_TRACK')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              filterTab === 'FAST_TRACK'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            Fast-track ({fastTrackCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('MANUAL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              filterTab === 'MANUAL'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-amber-700 hover:bg-amber-50'
            }`}
          >
            Cần thẩm định ({manualCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('SUPPLEMENT')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              filterTab === 'SUPPLEMENT'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-indigo-700 hover:bg-indigo-50'
            }`}
          >
            Chờ bổ sung ({supplementCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('APPROVED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              filterTab === 'APPROVED'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Đã duyệt ({approvedCount})
          </button>
        </div>

        {/* Filter Controls: Class + FIFO/LIFO + Search */}
        <div className="flex flex-col sm:flex-row items-center gap-2">
          {/* Class Filter */}
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full sm:w-auto px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Tất cả Lớp sinh hoạt</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
              </option>
            ))}
          </select>

          {/* Sort FIFO vs LIFO */}
          <button
            type="button"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="w-full sm:w-auto px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg bg-white inline-flex items-center justify-center gap-1.5 transition whitespace-nowrap"
            title="Đổi thứ tự hiển thị"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span>{sortOrder === 'asc' ? 'FIFO: Nộp trước xếp trên' : 'Mới nhất xếp trên'}</span>
          </button>

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="MSSV, tên sinh viên hoặc hoạt động..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition"
            />
          </div>
        </div>
      </div>

      {/* 3. Main Queue Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs min-w-[880px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filtered.length && filtered.length > 0}
                    onChange={handleSelectAll}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="py-3 px-4 min-w-[160px]">Sinh viên</th>
                <th className="py-3 px-4 min-w-[220px]">Hoạt động khai báo</th>
                <th className="py-3 px-4 whitespace-nowrap min-w-[140px]">Xác minh nguồn</th>
                <th className="py-3 px-4 whitespace-nowrap min-w-[120px]">AI Đề xuất</th>
                <th className="py-3 px-4 whitespace-nowrap min-w-[130px]">Trạng thái</th>
                <th className="py-3 px-4 text-right whitespace-nowrap min-w-[120px]">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                    Đang tải dữ liệu hồ sơ từ hệ thống...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                    Không có hồ sơ nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const aiScore = item.aiSuggestions?.[0]?.suggestedScore;
                  const isSelected = selectedIds.includes(item.id);
                  const verifLevel = item.verificationResults?.[0]?.verificationLevel || 3;
                  const isFastTrack = (verifLevel === 1 || verifLevel === 2) && item.status !== 'APPROVED';

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-blue-50/20 transition ${isSelected ? 'bg-blue-50/50' : ''}`}
                    >
                      <td className="py-3.5 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(item.id)}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 block">
                          {item.student?.fullName || 'Chưa cập nhật'}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {item.student?.studentCode || 'N/A'}
                          {item.student?.class?.code ? ` · ${item.student.class.code}` : ''}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          {isFastTrack && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              Fast-track
                            </span>
                          )}
                          <Link
                            to={`/officer/review/${item.id}`}
                            className="font-bold text-slate-800 hover:text-blue-600 block max-w-xs truncate transition"
                            title={item.declaredActivityName}
                          >
                            {item.declaredActivityName}
                          </Link>
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          Nộp: {new Date(item.submittedAt).toLocaleDateString('vi-VN')} · {item.evidenceType}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <VerificationBadge level={verifLevel} isOfficer={true} />
                      </td>

                      <td className="py-3.5 px-4">
                        {aiScore !== undefined ? (
                          <span className="font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded border border-dashed border-blue-200">
                            +{aiScore.toFixed(1)} đ
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <StatusBadge status={item.status} isOfficer={true} />
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <Link
                          to={`/officer/review/${item.id}`}
                          className="inline-block px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm shadow-blue-500/20 transition text-xs"
                        >
                          Mở xét duyệt
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Sleek Floating Batch Action Bar (Appears when >= 1 items selected) */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-md border border-slate-700 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isBatchProcessing ? 'bg-amber-400 animate-spin' : 'bg-emerald-400 animate-pulse'
              }`}
            />
            <span className="text-xs font-semibold">
              {isBatchProcessing ? (
                <span>
                  Đang duyệt: <strong className="text-amber-400">{batchProgress.current}/{batchProgress.total}</strong>
                </span>
              ) : (
                <span>
                  Đã chọn <strong className="text-emerald-400">{selectedIds.length}</strong> hồ sơ
                </span>
              )}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-700" />

          <button
            onClick={handleBatchApprove}
            disabled={isBatchProcessing}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-full shadow transition"
          >
            {isBatchProcessing ? 'Đang xử lý...' : `Duyệt nhanh Fast-Track (${selectedIds.length})`}
          </button>

          {!isBatchProcessing && (
            <button
              onClick={() => setSelectedIds([])}
              className="text-xs text-slate-400 hover:text-white transition"
            >
              Bỏ chọn
            </button>
          )}
        </div>
      )}
    </div>
  );
};
