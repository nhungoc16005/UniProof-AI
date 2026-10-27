import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiClient } from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';
import { Evidence } from '../../types';
import { StatusBadge } from '../../components/ui/StatusBadge';
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
 const load = async () => {
   setLoading(true); setError('');
   try { const response = await apiClient.getReviewQueuePage({ termId, status, search: query || undefined, classId: params.get('classId') || undefined, page, pageSize: 20 }); setItems(response.items); setTotal(response.total); }
   catch (err: any) { setError(err.response?.data?.error?.message || 'Không tải được danh sách minh chứng'); setItems([]); }
   finally { setLoading(false); }
 };
 useEffect(() => { void load(); }, [termId, status, page, query, params.get('classId')]);
 useEffect(() => { setSearch(query); }, [query]);
 useEffect(() => {
   if (search === query) return;
   const timer = window.setTimeout(() => {
     setParams(old => {
       const next = new URLSearchParams(old);
       next.set('termId', termId);
       search ? next.set('q', search) : next.delete('q');
       next.delete('page');
       return next;
     });
   }, 350);
   return () => window.clearTimeout(timer);
 }, [search, query, termId, setParams]);
 const filter = (key: string, value: string) => setParams(old => { const next = new URLSearchParams(old); next.set('termId',termId); next.set(key,value); if (key !== 'page') next.delete('page'); return next; });
 return <div className="space-y-4"><header><h1 className="text-xl font-bold">Minh chứng</h1><p className="mt-1 text-sm text-slate-600">Xác nhận tính hợp lệ của từng hồ sơ. Điểm rèn luyện được chấm tại phiếu sinh viên.</p></header>
 <div className="flex flex-wrap gap-3 rounded-xl border bg-white p-3"><input aria-label="Tìm minh chứng" placeholder="Tên hoạt động, MSSV, họ tên" value={search} onChange={e => setSearch(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" /><select aria-label="Trạng thái minh chứng" value={status} onChange={e => filter('status',e.target.value)} className="rounded-lg border px-3 py-2 text-sm">{[['NEEDS_HUMAN_REVIEW','Chờ xác minh'],['NEEDS_SUPPLEMENT','Chờ bổ sung'],['PROCESSING','Đang xử lý AI'],['APPROVED','Hợp lệ'],['REJECTED','Từ chối'],['ALL','Tất cả']].map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select><button onClick={() => void load()} className="rounded-lg border px-3 py-2 text-sm">Làm mới</button></div>
 {error && <p role="alert" className="rounded-lg bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
 {loading ? <p className="p-5 text-sm text-slate-500">Đang tải…</p> : <div className="rounded-xl border bg-white p-3"><table className="w-full table-fixed text-left text-sm"><thead className="border-b text-slate-500"><tr><th className="w-[28%] p-2">Minh chứng</th><th className="w-[23%] p-2">Sinh viên</th><th className="w-[15%] p-2">Ngày nộp</th><th className="w-[18%] p-2">Trạng thái</th><th className="p-2">Thao tác</th></tr></thead><tbody>{items.map(e => <tr key={e.id} className="border-b align-top"><td className="break-words p-2">{e.declaredActivityName}</td><td className="break-words p-2">{e.student?.fullName}<p className="text-xs text-slate-500">{e.student?.studentCode}</p></td><td className="p-2">{e.submittedAt ? new Date(e.submittedAt).toLocaleDateString('vi-VN') : 'Chưa nộp'}</td><td className="p-2"><StatusBadge status={e.status} isOfficer /></td><td className="space-y-2 p-2"><Link className="block text-blue-700" to={'/officer/review/' + e.id + '?termId=' + termId + '&returnTo=' + encodeURIComponent('/officer/queue?' + params.toString())}>Xác minh</Link><Link className="block text-blue-700" to={'/officer/students/' + e.studentId + '/assessment?termId=' + termId}>Phiếu sinh viên</Link></td></tr>)}</tbody></table>{!items.length && <p className="p-5 text-center text-slate-500">Không có minh chứng phù hợp.</p>}</div>}
 <div className="flex gap-3 text-sm"><button disabled={page <= 1} onClick={() => filter('page',String(page-1))} className="disabled:opacity-40">← Trước</button><span>Trang {page} · {total} minh chứng</span><button disabled={page*20 >= total} onClick={() => filter('page',String(page+1))} className="disabled:opacity-40">Sau →</button></div></div>;
};
