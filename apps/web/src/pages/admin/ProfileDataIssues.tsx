import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, ChevronLeft } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import { PageHeader } from '../../components/shared/PageHeader';

type Issue = { id: string; category: string; content: string; status: 'OPEN' | 'RESOLVED' | 'REJECTED'; resolution?: string; createdAt: string; reporter: { fullName: string; email: string; studentCode?: string; class?: { code: string; faculty?: { name: string } } } };

export const ProfileDataIssues: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || 'OPEN';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [data, setData] = useState<{ items: Issue[]; total: number; pageSize: number }>({ items: [], total: 0, pageSize: 25 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [target, setTarget] = useState<Issue | null>(null);
  const [resolution, setResolution] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setLoading(true); setError(''); setData(await apiClient.getProfileDataIssues({ status: status || undefined, page })); } catch { setError('Không tải được yêu cầu cập nhật dữ liệu.'); } finally { setLoading(false); } }, [status, page]);
  useEffect(() => { void load(); }, [load]);
  const resolve = async (decision: 'RESOLVED' | 'REJECTED') => { if (!target || resolution.trim().length < 3) return; try { setBusy(true); await apiClient.resolveProfileDataIssue(target.id, { status: decision, resolution: resolution.trim() }); setTarget(null); setResolution(''); await load(); } catch (e: any) { setError(e.response?.data?.error?.message || 'Không xử lý được yêu cầu.'); } finally { setBusy(false); } };
  return <div className="space-y-5"><PageHeader title="Yêu cầu cập nhật dữ liệu" />
    <Link to="/admin/users" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700"><ChevronLeft className="h-4 w-4"/>Tài khoản & đơn vị</Link>
    <div className="flex gap-2">{['OPEN','RESOLVED','REJECTED'].map(value => <button key={value} onClick={() => setParams({ status: value })} className={`rounded-lg px-3 py-2 text-sm font-semibold ${status === value ? 'bg-blue-700 text-white' : 'border bg-white'}`}>{value === 'OPEN' ? 'Chờ xử lý' : value === 'RESOLVED' ? 'Đã xử lý' : 'Từ chối'}</button>)}</div>
    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}<button onClick={() => void load()} className="ml-2 underline">Thử lại</button></div>}
    {loading ? <div className="rounded-xl border bg-white p-8 text-center">Đang tải yêu cầu…</div> : !data.items.length ? <div className="rounded-xl border border-dashed bg-white p-10 text-center text-slate-500">Không có yêu cầu trong trạng thái này.</div> : <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-3">Người báo</th><th className="p-3">Nội dung</th><th className="p-3">Trạng thái</th><th className="p-3"></th></tr></thead><tbody>{data.items.map(issue => <tr key={issue.id} className="border-t align-top"><td className="p-3 font-semibold">{issue.reporter.fullName}<p className="font-normal text-xs text-slate-500">{issue.reporter.studentCode || issue.reporter.email} · {issue.reporter.class?.code || '—'}</p></td><td className="p-3"><span className="font-semibold">{issue.category}</span><p className="mt-1 whitespace-pre-wrap text-slate-600">{issue.content}</p>{issue.resolution && <p className="mt-2 text-xs text-blue-700">Phản hồi: {issue.resolution}</p>}</td><td className="p-3">{issue.status}</td><td className="p-3 text-right">{issue.status === 'OPEN' && <button onClick={() => { setTarget(issue); setResolution(''); }} className="font-semibold text-blue-700">Xử lý</button>}</td></tr>)}</tbody></table></div>}
    {target && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl bg-white p-5 space-y-4"><h2 className="font-bold">Xử lý yêu cầu của {target.reporter.fullName}</h2><p className="rounded-lg bg-slate-50 p-3 text-sm">{target.content}</p><textarea autoFocus rows={4} value={resolution} onChange={e => setResolution(e.target.value)} className="w-full rounded-lg border p-3" placeholder="Phản hồi bắt buộc…"/><div className="flex justify-end gap-2"><button onClick={() => setTarget(null)} className="px-3 py-2">Hủy</button><button disabled={busy || resolution.trim().length < 3} onClick={() => void resolve('REJECTED')} className="rounded-lg border border-rose-300 px-3 py-2 text-rose-700"><AlertCircle className="mr-1 inline h-4 w-4"/>Từ chối</button><button disabled={busy || resolution.trim().length < 3} onClick={() => void resolve('RESOLVED')} className="rounded-lg bg-emerald-700 px-3 py-2 text-white"><CheckCircle2 className="mr-1 inline h-4 w-4"/>Đã xử lý</button></div></div></div>}
  </div>;
};
