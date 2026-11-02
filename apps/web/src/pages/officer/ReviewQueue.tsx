import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiClient } from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';
import { Evidence } from '../../types';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PageHeader } from '../../components/shared/PageHeader';
import { Search, RefreshCw, ChevronLeft, ChevronRight, FileCheck, ArrowRight, User } from 'lucide-react';
import type { EvidenceQueueSummary } from '../../lib/facultyAnalytics';

const emptySummary: EvidenceQueueSummary = { NEEDS_HUMAN_REVIEW: 0, NEEDS_SUPPLEMENT: 0, PROCESSING: 0, APPROVED: 0, REJECTED: 0, decided: 0 };

export const ReviewQueue: React.FC = () => {
  const { activeTerm } = useAuth();
  const [params, setParams] = useSearchParams();
  const termId = params.get('termId') || activeTerm.id;
  const status = params.get('status') || 'NEEDS_HUMAN_REVIEW';
  const query = params.get('q') || '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [search, setSearch] = useState(query);
  const [items, setItems] = useState<Evidence[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<EvidenceQueueSummary>(emptySummary);
  const [summaryError, setSummaryError] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(true);
  const requestId = useRef(0);
  const summaryRequestId = useRef(0);
  const classId = params.get('classId') || '';
  const returnTo = params.get('returnTo');
  const safeReturnTo = returnTo?.startsWith('/officer/evaluations?') ? returnTo : '';

  const load = async () => {
    const generation = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.getReviewQueuePage({
        termId,
        status,
        search: query || undefined,
        classId: classId || undefined,
        page,
        pageSize: 20,
      });
      if (generation !== requestId.current) return;
      setItems(response.items);
      setTotal(response.total);
    } catch (err: any) {
      if (generation !== requestId.current) return;
      setError(err.response?.data?.error?.message || 'Không tải được danh sách minh chứng');
      setItems([]);
    } finally {
      if (generation === requestId.current) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    return () => {
      requestId.current++;
    };
  }, [termId, status, page, query, classId]);

  const loadSummary = async () => {
    const generation = ++summaryRequestId.current;
    setSummaryError('');
    setSummaryLoading(true);
    try {
      const statuses = ['NEEDS_HUMAN_REVIEW', 'NEEDS_SUPPLEMENT', 'PROCESSING', 'APPROVED', 'REJECTED'] as const;
      const responses = await Promise.all(statuses.map(item => apiClient.getReviewQueuePage({ termId, classId: classId || undefined, status: item, page: 1, pageSize: 1 })));
      if (generation !== summaryRequestId.current) return;
      const next = Object.fromEntries(statuses.map((item, index) => [item, responses[index].total])) as Omit<EvidenceQueueSummary, 'decided'>;
      setSummary({ ...next, decided: next.APPROVED + next.REJECTED });
    } catch (err: any) {
      if (generation === summaryRequestId.current) setSummaryError(err.response?.data?.error?.message || 'Không tải được số lượng theo trạng thái.');
    } finally {
      if (generation === summaryRequestId.current) setSummaryLoading(false);
    }
  };

  useEffect(() => {
    void loadSummary();
    return () => { summaryRequestId.current++; };
  }, [termId, classId]);

  useEffect(() => {
    setSearch(query);
  }, [query]);

  useEffect(() => {
    if (search === query) return;
    const timer = window.setTimeout(() => {
      setParams((old) => {
        const next = new URLSearchParams(old);
        next.set('termId', termId);
        search ? next.set('q', search) : next.delete('q');
        next.delete('page');
        return next;
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search, query, termId, setParams]);

  const filter = (key: string, value: string) =>
    setParams((old) => {
      const next = new URLSearchParams(old);
      next.set('termId', termId);
      next.set(key, value);
      if (key !== 'page') next.delete('page');
      return next;
    });

  const totalPages = Math.ceil(total / 20) || 1;
  const decided = status === 'APPROVED' || status === 'REJECTED';
  const mainTabs = [
    { label: 'Chờ Khoa xác minh', status: 'NEEDS_HUMAN_REVIEW', count: summary.NEEDS_HUMAN_REVIEW },
    { label: 'Chờ bổ sung', status: 'NEEDS_SUPPLEMENT', count: summary.NEEDS_SUPPLEMENT },
    { label: 'Đang xử lý', status: 'PROCESSING', count: summary.PROCESSING },
    { label: 'Đã quyết định', status: 'APPROVED', count: summary.decided, decided: true },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hàng đợi minh chứng"
        description="Xác nhận tính hợp lệ của từng hồ sơ minh chứng. Điểm rèn luyện được thẩm định tại phiếu sinh viên."
        badge={
          <span className="inline-flex items-center rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-xs font-semibold text-[#6B6B6B] border border-[#E8E8EC]">
            {total} hồ sơ
          </span>
        }
      />

      {safeReturnTo && <Link to={safeReturnTo} className="inline-flex items-center gap-1 text-sm font-semibold text-[#1D6FC2] hover:underline"><ChevronLeft className="h-4 w-4" /> Quay lại lớp đang xem</Link>}

      <div className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Nhóm trạng thái minh chứng">
          {mainTabs.map(tab => {
            const active = tab.decided ? decided : status === tab.status;
            return <button key={tab.label} type="button" aria-pressed={active} onClick={() => filter('status', tab.status)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${active ? 'border-[#1D6FC2] bg-[#E1EDF9] text-[#175A9E]' : 'border-[#E8E8EC] bg-white text-[#6B6B6B]'}`}>{tab.label} <span className="ml-1 tabular-nums">{summaryLoading ? '…' : tab.count}</span></button>;
          })}
        </div>
        {decided && <div className="flex gap-2" aria-label="Kết quả quyết định"><button type="button" onClick={() => filter('status', 'APPROVED')} aria-pressed={status === 'APPROVED'} className={`rounded-md px-3 py-1.5 text-xs font-medium ${status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'border border-[#E8E8EC]'}`}>Hợp lệ ({summaryLoading ? '…' : summary.APPROVED})</button><button type="button" onClick={() => filter('status', 'REJECTED')} aria-pressed={status === 'REJECTED'} className={`rounded-md px-3 py-1.5 text-xs font-medium ${status === 'REJECTED' ? 'bg-red-100 text-red-800' : 'border border-[#E8E8EC]'}`}>Từ chối ({summaryLoading ? '…' : summary.REJECTED})</button></div>}
        {summaryError && <p role="status" className="text-xs text-amber-700">{summaryError} <button type="button" onClick={() => void loadSummary()} className="font-semibold underline">Thử lại</button></p>}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-[12px] border border-[#E8E8EC] bg-white p-3 shadow-xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B6B6B]" />
          <input
            aria-label="Tìm minh chứng"
            placeholder="Tên hoạt động, MSSV, họ tên…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-[6px] border border-[#E8E8EC] bg-[#FAFAFA] pl-9 pr-3 py-2 text-sm text-[#0A0A0A] placeholder-[#8A8A8E] focus:bg-white focus:border-[#1D6FC2] focus:outline-none transition-colors"
          />
        </div>

        <select
          aria-label="Trạng thái minh chứng"
          value={status}
          onChange={(e) => filter('status', e.target.value)}
          className="rounded-[6px] border border-[#E8E8EC] bg-[#FAFAFA] px-3 py-2 text-sm font-medium text-[#0A0A0A] focus:bg-white focus:border-[#1D6FC2] focus:outline-none transition-colors"
        >
          {[
            ['NEEDS_HUMAN_REVIEW', 'Chờ Khoa xác minh'],
            ['NEEDS_SUPPLEMENT', 'Chờ sinh viên bổ sung'],
            ['PROCESSING', 'Đang được hệ thống xử lý'],
            ['APPROVED', 'Hợp lệ'],
            ['REJECTED', 'Từ chối'],
            ['PLAUSIBLE', 'Có thể chấp nhận'],
            ['VERIFIED', 'Đã xác minh dữ liệu'],
            ['INVALID', 'Mâu thuẫn dữ liệu'],
            ['APPEALING', 'Đang phúc khảo'],
            ['WITHDRAWN', 'Đã rút'],
            ['ALL', 'Tất cả trạng thái'],
          ].map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        <button
          onClick={() => { void load(); void loadSummary(); }}
          className="inline-flex items-center gap-1.5 rounded-[6px] border border-[#E8E8EC] bg-white px-3 py-2 text-sm font-medium text-[#0A0A0A] hover:bg-[#F3F4F6] transition-colors"
        >
          <RefreshCw className={`h-4 w-4 text-[#6B6B6B] ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-[12px] border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Main Table */}
      <div className="overflow-hidden rounded-[12px] border border-[#E8E8EC] bg-white shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-sm text-[#6B6B6B]">
            <RefreshCw className="mx-auto h-6 w-6 animate-spin text-[#1D6FC2] mb-2" />
            Đang tải danh sách minh chứng…
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <FileCheck className="mx-auto h-10 w-10 text-[#8A8A8E] mb-2" />
            <p className="font-heading font-medium text-[#0A0A0A]">Không có minh chứng phù hợp</p>
            <p className="text-xs text-[#6B6B6B] mt-1">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E8E8EC] bg-[#FAFAFA] text-xs font-semibold uppercase tracking-wider text-[#6B6B6B]">
                <tr>
                  <th className="py-3 px-4 w-[30%]">Minh chứng / Hoạt động</th>
                  <th className="py-3 px-4 w-[25%]">Sinh viên</th>
                  <th className="py-3 px-4 w-[15%]">Ngày nộp</th>
                  <th className="py-3 px-4 w-[15%]">Trạng thái</th>
                  <th className="py-3 px-4 w-[15%] text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E8EC]">
                {items.map((e) => (
                  <tr key={e.id} className="hover:bg-[#F9FAFB] transition-colors">
                    <td className="py-3.5 px-4">
                      <p className="font-medium text-[#0A0A0A] line-clamp-2">{e.declaredActivityName}</p>
                      {e.criterionAssessment?.criterion && (
                        <p className="text-xs text-[#6B6B6B] mt-0.5">
                          Tiêu chí {e.criterionAssessment.criterion.code}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-[#EBF3FC] text-[#1D6FC2] flex items-center justify-center text-xs font-semibold shrink-0">
                          {e.student?.fullName?.charAt(0) || <User className="h-3.5 w-3.5" />}
                        </div>
                        <div>
                          <p className="font-medium text-[#0A0A0A]">{e.student?.fullName || '—'}</p>
                          <p className="text-xs text-[#6B6B6B] font-mono">{e.student?.studentCode}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-[#6B6B6B]">
                      {e.submittedAt ? new Date(e.submittedAt).toLocaleDateString('vi-VN') : 'Chưa nộp'}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={e.status} isOfficer />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex flex-col items-end gap-1.5">
                        <Link
                          to={`/officer/review/${e.id}?termId=${termId}&returnTo=${encodeURIComponent(
                            '/officer/queue?' + params.toString()
                          )}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#1D6FC2] hover:text-[#175A9E] hover:underline"
                        >
                          Xác minh
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                        <Link
                          to={`/officer/students/${e.studentId}/assessment?termId=${termId}&returnTo=${encodeURIComponent('/officer/queue?' + params.toString())}`}
                          className="text-xs text-[#6B6B6B] hover:text-[#0A0A0A] hover:underline"
                        >
                          Phiếu sinh viên
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-[#E8E8EC] bg-[#FAFAFA] px-4 py-3 text-xs text-[#6B6B6B]">
          <span>
            Trang <strong className="text-[#0A0A0A]">{page}</strong> / {totalPages} · Tổng{' '}
            <strong className="text-[#0A0A0A]">{total}</strong> minh chứng
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => filter('page', String(page - 1))}
              className="inline-flex items-center gap-1 rounded-[6px] border border-[#E8E8EC] bg-white px-2.5 py-1 text-xs font-medium text-[#0A0A0A] hover:bg-[#F3F4F6] disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Trước
            </button>
            <button
              disabled={page * 20 >= total}
              onClick={() => filter('page', String(page + 1))}
              className="inline-flex items-center gap-1 rounded-[6px] border border-[#E8E8EC] bg-white px-2.5 py-1 text-xs font-medium text-[#0A0A0A] hover:bg-[#F3F4F6] disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              Sau
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
