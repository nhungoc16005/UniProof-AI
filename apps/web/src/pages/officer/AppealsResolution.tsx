import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/apiClient';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { RefreshCw, ChevronLeft, ChevronRight, MessageSquare, ArrowRight, User, X, Check, Ban } from 'lucide-react';

export const AppealsResolution: React.FC = () => {
  const { activeTerm } = useAuth();
  const [params, setParams] = useSearchParams();
  const termId = params.get('termId') || activeTerm.id;
  const status = params.get('status') ?? 'PENDING';
  const classId = params.get('classId') || '';
  const returnTo = params.get('returnTo');
  const safeReturnTo = returnTo?.startsWith('/officer/evaluations?') ? returnTo : '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [opened, setOpened] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const requestId = useRef(0);

  const load = async () => {
    const generation = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      let response;
      if (classId) {
        const studentIds = new Set<string>();
        const firstWorkflow = await apiClient.getEvaluationWorkflow(termId, { classId, page: 1, pageSize: 100 });
        firstWorkflow.items.forEach((item: any) => studentIds.add(item.studentId));
        for (let workflowPage = 2; workflowPage <= Math.ceil(firstWorkflow.total / 100); workflowPage++) {
          const next = await apiClient.getEvaluationWorkflow(termId, { classId, page: workflowPage, pageSize: 100 });
          next.items.forEach((item: any) => studentIds.add(item.studentId));
        }
        const first = await apiClient.getAppealsPage({ termId, status: status || undefined, page: 1, pageSize: 100 });
        const all = [...first.items];
        for (let appealPage = 2; appealPage <= Math.ceil(first.total / 100); appealPage++) {
          const next = await apiClient.getAppealsPage({ termId, status: status || undefined, page: appealPage, pageSize: 100 });
          all.push(...next.items);
        }
        const filtered = all.filter(item => studentIds.has(item.studentId));
        response = { items: filtered.slice((page - 1) * 20, page * 20), total: filtered.length };
      } else {
        response = await apiClient.getAppealsPage({ termId, status: status || undefined, page, pageSize: 20 });
      }
      if (generation !== requestId.current) return;
      setItems(response.items);
      const linkedAppeal = response.items.find(item => item.id === params.get('appealId'));
      if (linkedAppeal) {
        setOpened(linkedAppeal);
        setParams(current => { const next = new URLSearchParams(current); next.delete('appealId'); return next; }, { replace: true });
      }
      setTotal(response.total);
    } catch (err: any) {
      if (generation !== requestId.current) return;
      setError(err.response?.data?.error?.message || 'Không tải được phúc khảo.');
    } finally {
      if (generation === requestId.current) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    return () => {
      requestId.current++;
    };
  }, [termId, status, page, classId]);

  const setFilter = (key: string, value: string) => setParams(current => {
    const next = new URLSearchParams(current);
    next.set('termId', termId);
    value ? next.set(key, value) : next.delete(key);
    if (key !== 'page') next.delete('page');
    return next;
  });

  const resolve = async (decision: string) => {
    setBusy(true);
    setError('');
    try {
      await apiClient.resolveAppeal(opened.id, { status: decision, resolutionNote: reason });
      setOpened(null);
      setReason('');
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || 'Không lưu được quyết định.');
    } finally {
      setBusy(false);
    }
  };

  const totalPages = Math.ceil(total / 20) || 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Giải quyết phúc khảo"
        description="Xem kết quả đã công bố và giải trình của sinh viên. Chấp thuận sẽ mở lại tiêu chí để đánh giá và gửi lại CTSV."
        badge={
          <span className="inline-flex items-center rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-xs font-semibold text-[#6B6B6B] border border-[#E8E8EC]">
            {total} đơn
          </span>
        }
      />

      {safeReturnTo && <Link to={safeReturnTo} className="inline-flex items-center gap-1 text-sm font-semibold text-[#1D6FC2] hover:underline"><ChevronLeft className="h-4 w-4" /> Quay lại lớp đang xem</Link>}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[#E8E8EC] bg-white p-3 shadow-xs">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wider">Trạng thái:</label>
          <select
            aria-label="Trạng thái phúc khảo"
            value={status}
            onChange={(e) => setFilter('status', e.target.value)}
            className="rounded-[6px] border border-[#E8E8EC] bg-[#FAFAFA] px-3 py-1.5 text-sm font-medium text-[#0A0A0A] focus:bg-white focus:border-[#1D6FC2] focus:outline-none transition-colors"
          >
            <option value="PENDING">Chờ xử lý</option>
            <option value="ACCEPTED">Đã chấp thuận</option>
            <option value="REJECTED">Đã bác</option>
            <option value="">Tất cả trạng thái</option>
          </select>
        </div>

        <button
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-[6px] border border-[#E8E8EC] bg-white px-3 py-1.5 text-sm font-medium text-[#0A0A0A] hover:bg-[#F3F4F6] transition-colors"
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
            Đang tải danh sách phúc khảo…
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <MessageSquare className="mx-auto h-10 w-10 text-[#8A8A8E] mb-2" />
            <p className="font-heading font-medium text-[#0A0A0A]">Không có đơn phúc khảo phù hợp</p>
            <p className="text-xs text-[#6B6B6B] mt-1">Các đơn phúc khảo từ sinh viên sẽ xuất hiện tại đây sau khi công bố kết quả</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E8E8EC] bg-[#FAFAFA] text-xs font-semibold uppercase tracking-wider text-[#6B6B6B]">
                <tr>
                  <th className="py-3 px-4 w-[28%]">Sinh viên</th>
                  <th className="py-3 px-4 w-[32%]">Nội dung phúc khảo</th>
                  <th className="py-3 px-4 w-[16%]">Điểm đã công bố</th>
                  <th className="py-3 px-4 w-[12%]">Trạng thái</th>
                  <th className="py-3 px-4 w-[12%] text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E8EC]">
                {items.map((a) => (
                  <tr key={a.id} className="hover:bg-[#F9FAFB] transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-[#EBF3FC] text-[#1D6FC2] flex items-center justify-center text-xs font-semibold shrink-0">
                          {a.student?.fullName?.charAt(0) || <User className="h-3.5 w-3.5" />}
                        </div>
                        <div>
                          <p className="font-medium text-[#0A0A0A]">{a.student?.fullName || '—'}</p>
                          <p className="text-xs text-[#6B6B6B] font-mono">{a.student?.studentCode}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-medium text-[#0A0A0A]">
                        {a.criterion ? `Mục ${a.criterion.code}. ${a.criterion.name}` : a.evidence?.declaredActivityName || 'Đơn phúc khảo'}
                      </p>
                      <p className="text-xs text-[#6B6B6B] mt-0.5 line-clamp-1">{a.content}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-heading font-semibold text-[#0A0A0A]">
                        {a.publishedScore !== null && a.publishedScore !== undefined ? `${a.publishedScore} đ` : '—'}
                      </div>
                      {a.publicationRevision && (
                        <p className="text-xs text-[#6B6B6B]">Đợt {a.publicationRevision}</p>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                          a.status === 'ACCEPTED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : a.status === 'REJECTED'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {a.status === 'ACCEPTED'
                          ? 'Đã chấp thuận'
                          : a.status === 'REJECTED'
                          ? 'Đã bác'
                          : 'Chờ xử lý'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex flex-col items-end gap-1.5">
                        <button
                          className="text-xs font-semibold text-[#1D6FC2] hover:text-[#175A9E] hover:underline"
                          onClick={() => {
                            setOpened(a);
                            setReason('');
                          }}
                        >
                          Xem giải trình
                        </button>
                        <Link
                          className="inline-flex items-center gap-0.5 text-xs text-[#6B6B6B] hover:text-[#0A0A0A] hover:underline"
                          to={`/officer/students/${a.studentId}/assessment?termId=${termId}&returnTo=${encodeURIComponent('/officer/appeals?' + params.toString())}`}
                        >
                          Mở phiếu
                          <ArrowRight className="h-3 w-3" />
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
            <strong className="text-[#0A0A0A]">{total}</strong> đơn
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setFilter('page', String(page - 1))}
              className="inline-flex items-center gap-1 rounded-[6px] border border-[#E8E8EC] bg-white px-2.5 py-1 text-xs font-medium text-[#0A0A0A] hover:bg-[#F3F4F6] disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Trước
            </button>
            <button
              disabled={page * 20 >= total}
              onClick={() => setFilter('page', String(page + 1))}
              className="inline-flex items-center gap-1 rounded-[6px] border border-[#E8E8EC] bg-white px-2.5 py-1 text-xs font-medium text-[#0A0A0A] hover:bg-[#F3F4F6] disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              Sau
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Detail Dialog */}
      {opened && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Giải quyết phúc khảo"
            className="w-full max-w-xl space-y-4 rounded-[12px] bg-white p-6 shadow-xl border border-[#E8E8EC]"
          >
            <div className="flex items-start justify-between border-b border-[#E8E8EC] pb-3">
              <div>
                <h2 className="font-heading font-semibold text-lg text-[#0A0A0A]">
                  Giải trình của {opened.student?.fullName}
                </h2>
                <p className="text-xs text-[#6B6B6B] mt-0.5">
                  MSSV: {opened.student?.studentCode} · {opened.criterion ? `Tiêu chí ${opened.criterion.code}` : ''}
                </p>
              </div>
              <button
                onClick={() => setOpened(null)}
                className="rounded-[6px] p-1 text-[#6B6B6B] hover:bg-[#F3F4F6] hover:text-[#0A0A0A] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[#6B6B6B]">
                  Nội dung phản ánh của sinh viên
                </label>
                <div className="mt-1 rounded-[8px] bg-[#FAFAFA] border border-[#E8E8EC] p-3 text-sm text-[#0A0A0A] whitespace-pre-wrap">
                  {opened.content}
                </div>
              </div>

              {opened.resolutionNote && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#6B6B6B]">
                    Phản hồi đã lưu
                  </label>
                  <div className="mt-1 rounded-[8px] bg-[#F0FDF4] border border-emerald-200 p-3 text-sm text-[#0A0A0A]">
                    {opened.resolutionNote}
                  </div>
                </div>
              )}

              {opened.status === 'PENDING' && opened.term?.status !== 'CLOSED' && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#0A0A0A]">
                    Căn cứ quyết định <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Ghi rõ lý do chấp thuận hoặc bác đơn (bắt buộc)…"
                    rows={3}
                    className="mt-1 w-full rounded-[6px] border border-[#E8E8EC] bg-white p-3 text-sm text-[#0A0A0A] placeholder-[#8A8A8E] focus:border-[#1D6FC2] focus:outline-none transition-colors"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-[#E8E8EC]">
              <button
                disabled={busy}
                onClick={() => setOpened(null)}
                className="rounded-[6px] border border-[#E8E8EC] bg-white px-3.5 py-2 text-sm font-medium text-[#0A0A0A] hover:bg-[#F3F4F6] transition-colors"
              >
                Đóng
              </button>
              {opened.status === 'PENDING' && opened.term?.status !== 'CLOSED' && (
                <>
                  <button
                    disabled={busy || !reason.trim()}
                    className="inline-flex items-center gap-1.5 rounded-[6px] border border-red-200 bg-red-50 px-3.5 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                    onClick={() => void resolve('REJECTED')}
                  >
                    <Ban className="h-4 w-4" />
                    Bác đơn
                  </button>
                  <button
                    disabled={busy || !reason.trim()}
                    className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#1D6FC2] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#175A9E] disabled:opacity-40 disabled:pointer-events-none transition-colors"
                    onClick={() => void resolve('ACCEPTED')}
                  >
                    <Check className="h-4 w-4" />
                    Chấp thuận, mở lại đánh giá
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
