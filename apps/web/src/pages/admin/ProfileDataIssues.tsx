import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import { PageHeader } from '../../components/shared/PageHeader';

type Issue = {
  id: string;
  category: string;
  content: string;
  status: 'OPEN' | 'RESOLVED' | 'REJECTED';
  resolution?: string;
  createdAt: string;
  reporter: {
    fullName: string;
    email: string;
    studentCode?: string;
    class?: { code: string; faculty?: { name: string } };
  };
};

export const ProfileDataIssues: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || 'OPEN';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [data, setData] = useState<{ items: Issue[]; total: number; pageSize: number }>({
    items: [],
    total: 0,
    pageSize: 25,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [target, setTarget] = useState<Issue | null>(null);
  const [resolution, setResolution] = useState('');
  const [busy, setBusy] = useState(false);
  const requestGen = useRef(0);

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  const load = useCallback(async () => {
    const gen = ++requestGen.current;
    try {
      setLoading(true);
      setError('');
      const res = await apiClient.getProfileDataIssues({ status: status || undefined, page });
      if (gen !== requestGen.current) return;
      setData(res);
    } catch {
      if (gen !== requestGen.current) return;
      setError('Không tải được yêu cầu cập nhật dữ liệu.');
    } finally {
      if (gen === requestGen.current) {
        setLoading(false);
      }
    }
  }, [status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const resolve = async (decision: 'RESOLVED' | 'REJECTED') => {
    if (!target || resolution.trim().length < 3) return;
    try {
      setBusy(true);
      await apiClient.resolveProfileDataIssue(target.id, {
        status: decision,
        resolution: resolution.trim(),
      });
      setTarget(null);
      setResolution('');
      if (data.items.length === 1 && page > 1) {
        setParams({ status, page: String(page - 1) });
      } else {
        await load();
      }
    } catch (e: any) {
      setError(e.response?.data?.error?.message || 'Không xử lý được yêu cầu.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Yêu cầu cập nhật dữ liệu" />
      <Link to="/admin/users" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700">
        <ChevronLeft className="h-4 w-4" />
        Tài khoản & đơn vị
      </Link>
      <div className="flex gap-2">
        {['OPEN', 'RESOLVED', 'REJECTED'].map((value) => (
          <button
            key={value}
            onClick={() => setParams({ status: value, page: '1' })}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              status === value ? 'bg-blue-700 text-white shadow-sm' : 'border bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {value === 'OPEN' ? 'Chờ xử lý' : value === 'RESOLVED' ? 'Đã xử lý' : 'Từ chối'}
          </button>
        ))}
      </div>
      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
          <button onClick={() => void load()} className="ml-2 underline font-semibold">
            Thử lại
          </button>
        </div>
      )}
      {loading ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">
          Đang tải yêu cầu…
        </div>
      ) : !data.items.length ? (
        <div className="rounded-xl border border-dashed bg-white p-10 text-center text-slate-500 text-sm">
          Không có yêu cầu trong trạng thái này.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b">
                <tr>
                  <th className="p-3">Người báo</th>
                  <th className="p-3">Nội dung</th>
                  <th className="p-3">Trạng thái</th>
                  <th className="p-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((issue) => (
                  <tr key={issue.id} className="border-t align-top hover:bg-slate-50/50">
                    <td className="p-3 font-semibold text-slate-900">
                      {issue.reporter.fullName}
                      <p className="font-normal text-xs text-slate-500 mt-0.5">
                        {issue.reporter.studentCode || issue.reporter.email} · {issue.reporter.class?.code || '—'}
                      </p>
                    </td>
                    <td className="p-3">
                      <span className="font-semibold text-slate-800">{issue.category}</span>
                      <p className="mt-1 whitespace-pre-wrap text-slate-600 text-xs">{issue.content}</p>
                      {issue.resolution && (
                        <p className="mt-2 text-xs text-blue-700 bg-blue-50 p-2 rounded-lg border border-blue-100">
                          <strong>Phản hồi:</strong> {issue.resolution}
                        </p>
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                          issue.status === 'OPEN'
                            ? 'bg-amber-100 text-amber-800'
                            : issue.status === 'RESOLVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {issue.status === 'OPEN' ? 'Chờ xử lý' : issue.status === 'RESOLVED' ? 'Đã giải quyết' : 'Từ chối'}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {issue.status === 'OPEN' && (
                        <button
                          onClick={() => {
                            setTarget(issue);
                            setResolution('');
                          }}
                          className="font-semibold text-blue-700 hover:text-blue-800 underline"
                        >
                          Xử lý
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Bar */}
          {data.total > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-white border border-slate-200 rounded-xl text-xs text-slate-600 shadow-sm">
              <div>
                Hiển thị <strong>{(page - 1) * data.pageSize + 1}</strong> – <strong>{Math.min(page * data.pageSize, data.total)}</strong> trên tổng số <strong>{data.total}</strong> yêu cầu
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setParams({ status, page: String(page - 1) })}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition"
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
                  onClick={() => setParams({ status, page: String(page + 1) })}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition"
                >
                  Trang sau
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {target && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl bg-white p-5 space-y-4 shadow-xl">
            <h2 className="font-bold text-slate-900">Xử lý yêu cầu của {target.reporter.fullName}</h2>
            <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700 border border-slate-200">{target.content}</p>
            <textarea
              autoFocus
              rows={4}
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Nhập nội dung phản hồi bắt buộc cho sinh viên…"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setTarget(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Hủy
              </button>
              <button
                disabled={busy || resolution.trim().length < 3}
                onClick={() => void resolve('REJECTED')}
                className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 transition"
              >
                <AlertCircle className="mr-1 inline h-4 w-4" />
                Từ chối
              </button>
              <button
                disabled={busy || resolution.trim().length < 3}
                onClick={() => void resolve('RESOLVED')}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 transition shadow-sm"
              >
                <CheckCircle2 className="mr-1 inline h-4 w-4" />
                Đã xử lý
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
