import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/apiClient';
import { errorMessage } from './EvaluationBoard';
type Job = { id: string; evidenceId: string; status: string; attempts: number; error?: string; createdAt: string; evidence: { declaredActivityName?: string; student: { fullName: string; studentCode: string } }; pipelineRuns: { id: string; status: string; inputVersion: number; modelName?: string; modelVersion?: string; configVersion?: string; steps: { id: string; stepKey: string; status: string }[] }[] };
export const AiJobs: React.FC = () => {
  const { activeTerm } = useAuth();
  const [params,setParams] = useSearchParams();
  const termId = params.get('termId') || activeTerm.id;
  const status = params.get('jobStatus') || '';
  const page = Math.max(1,Number(params.get('jobPage')) || 1);
  const [data,setData] = useState<{ items: Job[]; total: number } | null>(null);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [loading,setLoading] = useState(false);
  const [busy,setBusy] = useState(false);
  const [refresh,setRefresh] = useState(0);
  useEffect(() => {
    let cancelled = false; setLoading(true); setError(''); setData(null);
    apiClient.getAiJobs({ termId: termId || undefined, status: status || undefined, page, pageSize: 25 }).then(response => { if (!cancelled) setData(response.data); }).catch(err => { if (!cancelled) setError(errorMessage(err)); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [termId,status,page,refresh]);
  const change = (key: string,value: string) => setParams(p => { const n=new URLSearchParams(p); value ? n.set(key,value) : n.delete(key); if (key !== 'jobPage') n.delete('jobPage'); return n; });
  const retry = async (job: Job) => {
    if (!window.confirm('Tạo lượt AI mới? Backend sẽ kiểm tra phiếu còn được xử lý trước khi thực hiện.')) return;
    setBusy(true); setError(''); setNotice('');
    try { await apiClient.retryAiJob(job.id); setNotice('Đã tạo lượt xử lý mới và lưu nhật ký.'); setRefresh(n=>n+1); } catch(err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };
  return <section className="space-y-4"><div className="flex gap-3"><select aria-label="Trạng thái job AI" value={status} onChange={e=>change('jobStatus',e.target.value)} className="rounded-lg border p-2 text-sm"><option value="">Tất cả trạng thái</option>{['QUEUED','PROCESSING','COMPLETED','FAILED','UNAVAILABLE','CANCELLED'].map(s=><option key={s}>{s}</option>)}</select><button className="rounded-lg border px-3 text-sm" onClick={()=>setRefresh(n=>n+1)}>Làm mới</button></div>{error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}{notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}{loading && <p role="status">Đang tải job AI…</p>}<div className="overflow-x-auto rounded-xl border bg-white p-4"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Sinh viên / Minh chứng</th><th>Trạng thái / Lượt</th><th>Phiên bản và bước xử lý</th><th>Thao tác</th></tr></thead><tbody>{data?.items.map(j=><tr key={j.id} className="border-b align-top"><td className="p-2">{j.evidence.student.studentCode} · {j.evidence.student.fullName}<p className="text-xs text-slate-500">{j.evidence.declaredActivityName}</p></td><td className="p-2">{j.status} · {j.attempts}<p className="max-w-sm break-words text-xs text-rose-700">{j.error}</p></td><td className="p-2">{j.pipelineRuns.map(r=><div key={r.id} className="text-xs">Đầu vào v{r.inputVersion} · {r.modelName || 'Chưa ghi nhận model'} {r.modelVersion} · Cấu hình {r.configVersion || 'Chưa ghi nhận'}{r.steps.map(s=><p key={s.id}>{s.stepKey}: {s.status}</p>)}</div>)}</td><td className="p-2">{['FAILED','UNAVAILABLE'].includes(j.status) && <button disabled={busy} className="text-blue-700 disabled:opacity-40" onClick={()=>void retry(j)}>Xử lý lại</button>}</td></tr>)}</tbody></table>{!loading && !data?.items.length && <p className="p-5 text-sm text-slate-500">Chưa có job phù hợp.</p>}</div><div className="flex justify-end gap-3 text-sm"><button disabled={page<=1} onClick={()=>change('jobPage',String(page-1))}>Trước</button><span>Trang {page} · {data?.total || 0} job</span><button disabled={page*25 >= (data?.total || 0)} onClick={()=>change('jobPage',String(page+1))}>Tiếp</button></div></section>;
};
