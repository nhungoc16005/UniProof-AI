import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/apiClient';
export const AppealsResolution: React.FC = () => {
 const { activeTerm } = useAuth();
 const [params,setParams] = useSearchParams();
 const termId = params.get('termId') || activeTerm.id;
 const status = params.get('status') || 'PENDING';
 const page = Math.max(1,Number(params.get('page')) || 1);
 const [items,setItems] = useState<any[]>([]);
 const [total,setTotal] = useState(0);
 const [opened,setOpened] = useState<any>(null);
 const [reason,setReason] = useState('');
 const [error,setError] = useState('');
 const [loading,setLoading] = useState(false);
 const [busy,setBusy] = useState(false);
 const load = async () => {
  setLoading(true); setError('');
  try {
   const response = await apiClient.getAppealsPage({ termId, status: status || undefined, page, pageSize: 20 });
   setItems(response.items);
   setTotal(response.total);
  }
  catch (err:any) { setError(err.response?.data?.error?.message || 'Không tải được phúc khảo.'); }
  finally { setLoading(false); }
 };
 useEffect(() => { void load(); },[termId,status,page]);
 const resolve = async (decision: string) => {
  setBusy(true); setError('');
  try { await apiClient.resolveAppeal(opened.id,{ status: decision, resolutionNote: reason }); setOpened(null); setReason(''); await load(); }
  catch (err:any) { setError(err.response?.data?.error?.message || err.response?.data?.message || 'Không lưu được quyết định.'); }
  finally { setBusy(false); }
 };
 return <div className="space-y-4"><header><h1 className="text-xl font-bold">Phúc khảo</h1><p className="mt-1 text-sm text-slate-600">Xem kết quả đã công bố và giải trình. Chấp thuận sẽ mở lại tiêu chí để đánh giá và gửi lại CTSV.</p></header>
 <select aria-label="Trạng thái phúc khảo" value={status} onChange={e => setParams({termId,status:e.target.value})} className="rounded-lg border bg-white p-2 text-sm"><option value="PENDING">Chờ xử lý</option><option value="ACCEPTED">Đã chấp thuận</option><option value="REJECTED">Đã bác</option><option value="">Tất cả</option></select>
 {error && <p role="alert" className="rounded-lg bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
 {loading ? <p className="p-5 text-sm">Đang tải…</p> : <div className="rounded-xl border bg-white p-3"><table className="w-full table-fixed text-left text-sm"><thead className="border-b text-slate-500"><tr><th className="w-1/4 p-2">Sinh viên</th><th className="w-1/4 p-2">Nội dung</th><th className="p-2">Kết quả công bố</th><th className="p-2">Thao tác</th></tr></thead><tbody>{items.map(a => <tr key={a.id} className="border-b align-top"><td className="p-2 break-words">{a.student?.fullName}<p className="text-xs text-slate-500">{a.student?.studentCode}</p></td><td className="p-2 break-words">{a.criterion ? 'Mục '+a.criterion.code+'. '+a.criterion.name : a.evidence?.declaredActivityName}<p className="mt-1 text-xs text-slate-500">{a.term?.name}</p></td><td className="p-2">{a.publishedScore ?? '—'}{a.publicationRevision && <p className="text-xs text-slate-500">Phiên bản {a.publicationRevision}</p>}</td><td className="space-y-2 p-2"><button className="block text-blue-700" onClick={() => {setOpened(a);setReason('');}}>Xem giải trình</button><Link className="block text-blue-700" to={'/officer/students/'+a.studentId+'/assessment?termId='+termId}>Mở phiếu</Link></td></tr>)}</tbody></table>{!items.length && <p className="p-5 text-center text-slate-500">Không có đơn phù hợp.</p>}</div>}
 <div className="flex gap-3 text-sm"><button disabled={page<=1} onClick={() => setParams({termId,status,page:String(page-1)})}>← Trước</button><span>Trang {page} · {total} đơn</span><button disabled={page*20>=total} onClick={() => setParams({termId,status,page:String(page+1)})}>Sau →</button></div>
 {opened && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"><div role="dialog" aria-modal="true" aria-label="Giải quyết phúc khảo" className="w-full max-w-xl space-y-4 rounded-xl bg-white p-5"><h2 className="font-semibold">Giải trình của {opened.student?.fullName}</h2><p className="whitespace-pre-wrap text-sm">{opened.content}</p>{opened.resolutionNote && <p className="text-sm">Phản hồi: {opened.resolutionNote}</p>}{opened.status==='PENDING' && opened.term?.status!=='CLOSED' && <textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Căn cứ chấp thuận hoặc bác đơn (bắt buộc)" rows={3} className="w-full rounded-lg border p-3 text-sm" />}<div className="flex flex-wrap justify-end gap-3"><button disabled={busy} onClick={()=>setOpened(null)}>Đóng</button>{opened.status==='PENDING' && opened.term?.status!=='CLOSED' && <><button disabled={busy||!reason.trim()} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40" onClick={()=>void resolve('REJECTED')}>Bác đơn</button><button disabled={busy||!reason.trim()} className="rounded-lg bg-blue-700 px-3 py-2 text-sm text-white disabled:opacity-40" onClick={()=>void resolve('ACCEPTED')}>Chấp thuận, mở lại đánh giá</button></>}</div></div></div>}</div>;
};
