import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/apiClient';
import { EvaluationData, EvaluationRow, errorMessage, saveEvaluationExcel, evaluationStateLabels } from './EvaluationBoard';

type Report = EvaluationData & { totalEvaluated: number; pendingStudents: number; averageScore: number | null; distribution: Record<string, number>; source: string; classProgress: { id: string; code: string; total: number; completed: number; pending: number; average: number | null }[] };
export const ResultReports: React.FC<{ admin?: boolean }> = ({ admin = false }) => {
  const { activeTerm } = useAuth();
  const [params, setParams] = useSearchParams();
  const termId = params.get('termId') || activeTerm.id;
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const filters = { facultyId: params.get('facultyId') || undefined, classId: params.get('classId') || undefined, q: params.get('q') || undefined, page: Math.max(1,Number(params.get('page')) || 1), pageSize: 25 };
  const filterKey = JSON.stringify(filters);
  const page = Math.max(1, Number(params.get('page')) || 1);
  const setFilter = (key: string, value: string) => setParams(p => { const next = new URLSearchParams(p); value ? next.set(key,value) : next.delete(key); if (key !== 'page') next.delete('page'); next.set('termId',termId); return next; });
  useEffect(() => {
    let cancelled = false;
    if (!termId) return;
    setLoading(true); setError('');
    apiClient.getResultReport(termId,filters).then(result => { if (!cancelled) setData(result); }).catch(err => { if (!cancelled) { setError(errorMessage(err)); setData(null); } }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [termId, filterKey, refresh]);
  const current = data?.term.id === termId ? data : null;
  const groups = current?.classProgress || [];
  const rows: EvaluationRow[] = current?.items || [];
  const exportRows = async () => {
    setError('');
    try { const result = await apiClient.exportResultReport(termId,filters); saveEvaluationExcel(result.items,termId); }
    catch (err) { setError(errorMessage(err)); }
  };
  return <div className="space-y-5"><header><h1 className="text-xl font-bold">{admin ? 'Báo cáo toàn trường' : 'Báo cáo Khoa'}</h1><p className="mt-1 text-sm text-slate-600">Kết quả lấy từ phiên bản công bố mới nhất; phiếu đang xử lý và sinh viên không nộp được thống kê riêng.</p></header>
    {!termId && <p>Chưa có kỳ đánh giá.</p>}
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-4 text-sm text-rose-800">{error} <button className="underline" onClick={() => setRefresh(n => n+1)}>Thử lại</button></p>}
    {loading && <p role="status" className="text-sm text-slate-500">Đang tải báo cáo…</p>}
    {current && <><div className="flex flex-wrap gap-2 rounded-xl border bg-white p-3"><input aria-label="Tìm sinh viên" placeholder="MSSV hoặc họ tên" value={filters.q || ''} onChange={e => setFilter('q',e.target.value)} className="rounded-lg border p-2 text-sm" />{admin && <select aria-label="Khoa" value={filters.facultyId || ''} onChange={e => setFilter('facultyId',e.target.value)} className="rounded-lg border p-2 text-sm"><option value="">Tất cả Khoa</option>{current.filters.faculties.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select>}<select aria-label="Lớp" value={filters.classId || ''} onChange={e => setFilter('classId',e.target.value)} className="rounded-lg border p-2 text-sm"><option value="">Tất cả lớp</option>{current.filters.classes.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}</select><button disabled={loading} onClick={() => void exportRows()} className="rounded-lg border p-2 text-sm disabled:opacity-40">Xuất Excel toàn bộ bộ lọc</button></div>
      <p className="text-sm text-slate-600">{current.term.name} · Cập nhật {new Date(current.updatedAt).toLocaleString('vi-VN')} · Nguồn: {current.source === 'LEGACY_RUBRIC' ? 'Rubric kỳ lịch sử' : 'Kết quả đã công bố'}</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Sinh viên trong danh sách',current.total],['Có kết quả',current.totalEvaluated],['Chưa có kết quả',current.pendingStudents],['Điểm trung bình',current.averageScore ?? '—']].map(([label,value]) => <div key={label} className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">{label}</p><strong className="text-2xl">{value}</strong></div>)}</div>
      <div className="flex flex-wrap gap-4 rounded-xl border bg-white p-4 text-sm">{[['XUAT_SAC','Xuất sắc'],['TOT','Tốt'],['KHA','Khá'],['TRUNG_BINH','Trung bình'],['YEU','Yếu']].map(([key,label]) => <span key={key}>{label}: <strong>{current.distribution[key]}</strong></span>)}<span>Ghi nhận không nộp: <strong>{current.summary.recordedNotSubmitted}</strong></span></div>
      <div className="overflow-x-auto rounded-xl border bg-white p-4"><h2 className="mb-3 font-semibold">Tổng hợp theo lớp</h2><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Lớp</th><th>Sĩ số kỳ</th><th>Có kết quả</th><th>Chưa có kết quả</th><th>Điểm trung bình</th></tr></thead><tbody>{groups.map(g => <tr key={g.id} className="border-b"><td className="p-2"><button className="text-blue-700" onClick={() => setFilter('classId',g.id)}>{g.code}</button></td><td>{g.total}</td><td>{g.completed}</td><td>{g.pending}</td><td>{g.average ?? '—'}</td></tr>)}</tbody></table></div>
      <div className="overflow-x-auto rounded-xl border bg-white p-4"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Sinh viên</th><th>Lớp</th><th>Trạng thái</th><th>Điểm công bố</th><th>Xếp loại</th><th>Phiên bản</th></tr></thead><tbody>{rows.map(r => <tr key={r.studentId} className="border-b"><td className="p-2"><Link className="text-blue-700" to={(admin ? '/admin/results/' : '/officer/students/') + r.studentId + (admin ? '' : '/assessment') + '?termId=' + termId}>{r.student?.studentCode} · {r.student?.fullName}</Link></td><td>{r.class?.code}</td><td>{evaluationStateLabels[r.state]}</td><td>{r.officialScore ?? '—'}</td><td>{r.classification}</td><td>{r.publicationRevision ?? '—'}</td></tr>)}</tbody></table>{!rows.length && <p className="p-5 text-center text-sm text-slate-500">Không có dữ liệu phù hợp.</p>}</div><div className="flex justify-end gap-3 text-sm"><button disabled={page<=1} onClick={() => setFilter('page',String(page-1))}>Trước</button><span>Trang {page}/{Math.max(1,Math.ceil(current.total/25))}</span><button disabled={page*25>=current.total} onClick={() => setFilter('page',String(page+1))}>Tiếp</button></div>
    </>}
  </div>;
};
