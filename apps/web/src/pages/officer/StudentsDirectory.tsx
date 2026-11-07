import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Users, RefreshCw, ChevronLeft, ChevronRight, GraduationCap } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';
import type { Class, User } from '../../types';

const PAGE_SIZE = 25;

export const StudentsDirectory: React.FC = () => {
  const { user, activeTerm } = useAuth();
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<User[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const page = Math.max(1, Number(params.get('page') || 1));
  const search = params.get('search') || '';
  const classId = params.get('classId') || '';
  const termId = params.get('termId') || activeTerm.id;

  const update = (values: Record<string, string | undefined>) => setParams(current => {
    const next = new URLSearchParams(current);
    Object.entries(values).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    return next;
  });

  const load = React.useCallback(async () => {
    setLoading(true); setError(''); setItems([]);
    try {
      const result = await apiClient.getUsersPage({ role: 'STUDENT', termId: termId || undefined, classId: classId || undefined, search: search.trim() || undefined, page, pageSize: PAGE_SIZE });
      setItems(result.items); setTotal(result.total);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Không tải được danh sách sinh viên của Khoa.');
    } finally { setLoading(false); }
  }, [classId, page, search, termId]);

  useEffect(() => { apiClient.getClasses(user.facultyId).then(setClasses).catch(() => setClasses([])); }, [user.facultyId]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 250); return () => window.clearTimeout(timer); }, [load]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const classMap = useMemo(() => new Map(classes.map(item => [item.id, item])), [classes]);

  return <div className="space-y-5 pb-12">
    <header><p className="text-xs font-medium text-slate-500">{user.faculty?.name || 'Khoa phụ trách'} · {activeTerm.name}</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Sinh viên Khoa</h1><p className="mt-1 text-sm text-slate-600">Tra cứu hồ sơ học vụ và mở đánh giá của sinh viên thuộc phạm vi Khoa.</p></header>
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_240px_auto]">
        <label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input value={search} onChange={event => update({ search: event.target.value || undefined, page: undefined })} placeholder="Tìm MSSV, họ tên hoặc email" className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm"/></label>
        <select value={classId} onChange={event => update({ classId: event.target.value || undefined, page: undefined })} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm"><option value="">Tất cả lớp</option>{classes.map(item => <option key={item.id} value={item.id}>{item.code} · {item.cohort}</option>)}</select>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/>Làm mới</button>
      </div>
      <p className="mt-3 text-xs text-slate-500">{total} sinh viên phù hợp. Danh sách được phân trang từ Backend.</p>
    </section>
    {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{error} <button onClick={() => void load()} className="font-semibold underline">Thử lại</button></div> : loading ? <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">Đang tải danh sách sinh viên…</div> : !items.length ? <div className="rounded-xl border border-dashed bg-white p-10 text-center"><Users className="mx-auto h-8 w-8 text-slate-400"/><h2 className="mt-3 font-semibold text-slate-900">Không tìm thấy sinh viên phù hợp</h2><button onClick={() => update({ search: undefined, classId: undefined, page: undefined })} className="mt-2 text-sm font-semibold text-blue-700">Xóa bộ lọc</button></div> : <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Sinh viên</th><th className="px-4 py-3">Lớp / khóa</th><th className="px-4 py-3">Tài khoản</th><th className="px-4 py-3 text-right">Hồ sơ</th></tr></thead><tbody className="divide-y">{items.map(student => { const cls = student.class || (student.classId ? classMap.get(student.classId) : undefined); return <tr key={student.id} className="hover:bg-slate-50"><td className="px-4 py-3"><strong className="block text-slate-900">{student.fullName}</strong><span className="text-xs text-slate-500">{student.studentCode || 'Chưa có MSSV'} · {student.email}</span></td><td className="px-4 py-3"><span className="inline-flex items-center gap-1.5"><GraduationCap className="h-4 w-4 text-slate-400"/>{cls?.code || 'Chưa xếp lớp'}{cls?.cohort ? ` · ${cls.cohort}` : ''}</span></td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${student.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{student.isActive ? 'Đang hoạt động' : 'Đã khóa'}</span></td><td className="px-4 py-3 text-right"><Link to={`/officer/students/${student.id}/assessment?${new URLSearchParams({ termId, returnTo: `/officer/students-directory?${params.toString()}` })}`} className="font-semibold text-blue-700 hover:underline">Mở đánh giá</Link></td></tr>; })}</tbody></table></div><footer className="flex items-center justify-between border-t px-4 py-3 text-sm"><span>Trang {page}/{pages}</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => update({ page: String(page - 1) })} className="rounded border p-2 disabled:opacity-40" aria-label="Trang trước"><ChevronLeft className="h-4 w-4"/></button><button disabled={page >= pages} onClick={() => update({ page: String(page + 1) })} className="rounded border p-2 disabled:opacity-40" aria-label="Trang sau"><ChevronRight className="h-4 w-4"/></button></div></footer></section>}
  </div>;
};
