import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/apiClient';

export const evaluationStateLabels: Record<string, string> = {
  NOT_SUBMITTED: 'Chưa nộp', STUDENT_RETURNED: 'Chờ sinh viên sửa', REVIEWING: 'Đang chấm',
  READY: 'Hoàn tất chấm', SENT: 'Đã gửi CTSV', PUBLISHED: 'Đã công bố tạm',
  FACULTY_RETURNED: 'CTSV trả lại', NOT_SUBMITTED_RECORDED: 'Đã ghi nhận không nộp',
};
export type EvaluationRow = { studentId: string; student?: { fullName: string; studentCode: string }; classId: string; class?: { id: string; code: string }; facultyId: string; faculty?: { id: string; name: string }; state: string; ready: boolean; blockers: string[]; finalizedCriteria: number; totalCriteria: number; pendingAppeals: number; pendingEvidence: number; returnReason?: string; notSubmittedReason?: string; revision: number; officialScore?: number | null; classification?: string; publicationRevision?: number | null };
export type EvaluationData = { items: EvaluationRow[]; summary: Record<string, number>; updatedAt: string; total: number; page: number; pageSize: number; facultyProgress: { id: string; name: string; total: number; sent: number; published: number; pendingAppeals: number }[]; filters: { classes: { id: string; code: string }[]; faculties: { id: string; name: string }[] }; term: { id: string; name: string; status: string; workflowEnabled: boolean; submissionDeadline: string; appealDeadline: string } };
export type PublicationConditions = { canPublish: boolean; canClose: boolean; publishBlockers: string[]; closeBlockers: string[] };
export const errorMessage = (err: any) => err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Không thực hiện được thao tác';
export function saveEvaluationExcel(items: EvaluationRow[], termId: string) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(items.map(r => ({ 'MSSV': r.student?.studentCode, 'Họ tên': r.student?.fullName, 'Lớp': r.class?.code, 'Khoa': r.faculty?.name, 'Trạng thái': evaluationStateLabels[r.state], 'Tiêu chí hoàn tất': `${r.finalizedCriteria}/${r.totalCriteria}`, 'Minh chứng chờ': r.pendingEvidence, 'Phúc khảo chờ': r.pendingAppeals, ...(r.officialScore !== undefined ? { 'Điểm đã công bố': r.officialScore ?? '', 'Xếp loại': r.classification, 'Phiên bản công bố': r.publicationRevision ?? '' } : {}) }))), 'Ren-luyen');
  XLSX.writeFile(book, `Ren-luyen-${termId}.xlsx`);
}

export const EvaluationBoard: React.FC<{ admin?: boolean; compact?: boolean }> = ({ admin = false, compact = false }) => {
  const { activeTerm } = useAuth();
  const [params, setParams] = useSearchParams();
  const termId = params.get('termId') || activeTerm.id;
  const [data, setData] = useState<EvaluationData | null>(null);
  const [conditions, setConditions] = useState<PublicationConditions | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [reasonAction, setReasonAction] = useState<{ row: EvaluationRow; type: 'return' | 'not-submitted' } | null>(null);
  const [reason, setReason] = useState('');
  const [refresh, setRefresh] = useState(0);
  const state = params.get('state') || '';
  const classId = params.get('classId') || '';
  const facultyId = params.get('facultyId') || '';
  const query = params.get('q') || '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const pageSize = Number(params.get('pageSize')) || 25;
  const filters = { ...(state ? { state } : {}), ...(classId ? { classId } : {}), ...(facultyId ? { facultyId } : {}), ...(query ? { q: query } : {}), page: compact ? 1 : page, pageSize: compact ? 6 : pageSize };
  const filterKey = JSON.stringify(filters);
  useEffect(() => {
    let cancelled = false;
    setConditions(null); setSelected([]); setError('');
    if (!termId) { setLoading(false); return; }
    setLoading(true);
    Promise.all([apiClient.getEvaluationWorkflow(termId, filters), admin ? apiClient.getPublicationConditions(termId) : Promise.resolve(null)])
      .then(([result, policy]) => { if (!cancelled) { setData(result); setConditions(policy); } })
      .catch(err => { if (!cancelled) { setError(errorMessage(err)); setData(null); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [termId, filterKey, admin, refresh]);
  useEffect(() => {
    if (!reasonAction) return;
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) setReasonAction(null); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [reasonAction, busy]);
  const setFilter = (key: string, value: string) => setParams(current => { const next = new URLSearchParams(current); value ? next.set(key, value) : next.delete(key); if (key !== 'page') next.delete('page'); next.set('termId', termId); return next; });
  const act = async (operation: () => Promise<unknown>, message: string) => {
    setBusy(true); setError(''); setNotice('');
    try { await operation(); setReasonAction(null); setReason(''); setRefresh(v => v + 1); setNotice(message); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  };
  const exportRows = () => void act(async () => { const result = await apiClient.exportEvaluationWorkflow(termId, filters); saveEvaluationExcel(result.items, termId); }, 'Đã xuất toàn bộ dữ liệu phù hợp bộ lọc.');
  const closed = data?.term.status === 'CLOSED' || !data?.term.workflowEnabled;
  const base = admin ? '/admin/results' : '/officer/students';
  const cards = [['Chưa nộp','notSubmitted','NOT_SUBMITTED'], ['Đang chấm','reviewing','REVIEWING'], ['Cần chỉnh sửa','returned','RETURNED'], ['Hoàn tất chấm','ready','READY'], ['Đã gửi CTSV','sent','SENT'], ['Phúc khảo chờ','pendingAppeals','APPEALS']];
  return <div className="space-y-4">
    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}<button onClick={() => setRefresh(v => v + 1)} className="ml-3 underline">Thử lại</button></div>}
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {!termId && <p className="rounded-xl border bg-white p-5 text-sm">Chưa có kỳ đánh giá. {admin && <Link className="text-blue-700" to="/admin/terms">Thiết lập kỳ đánh giá</Link>}</p>}
    {loading && <p role="status" className="p-6 text-sm text-slate-500">Đang tải tiến độ đánh giá…</p>}
    {data && data.term.id === termId && <>
      <p className="text-sm text-slate-600">{data.term.name} · {data.total} sinh viên phù hợp · Cập nhật {new Date(data.updatedAt).toLocaleString('vi-VN')}{closed ? ' · Chỉ xem' : ''}</p>
      {!data.term.workflowEnabled && <p className="rounded-xl bg-slate-100 p-3 text-sm">Kỳ lịch sử: tra cứu phiếu và báo cáo theo bộ tiêu chí của kỳ; không áp dụng bàn giao mới.</p>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">{cards.map(([title,key,filter]) => <Link key={key} to={(filter === 'APPEALS' && !admin ? '/officer/appeals' : base) + '?termId=' + termId + '&state=' + filter} className="rounded-xl border border-slate-200 bg-white p-4"><span className="block text-xs text-slate-600">{title}</span><strong className="mt-2 block text-2xl">{data.summary[key]}</strong></Link>)}</div>
      {admin && <div className="overflow-x-auto rounded-xl border bg-white p-4"><h2 className="mb-3 font-semibold">Tiến độ theo Khoa</h2><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-2">Khoa</th><th>Sinh viên</th><th>Đã gửi</th><th>Đã công bố</th><th>Phúc khảo</th></tr></thead><tbody>{data.facultyProgress.map(f => <tr key={f.id} className="border-b"><td className="p-2"><Link className="text-blue-700" to={`${base}?termId=${termId}&facultyId=${f.id}`}>{f.name}</Link></td><td>{f.total}</td><td>{f.sent}/{f.total}</td><td>{f.published}</td><td>{f.pendingAppeals}</td></tr>)}</tbody></table></div>}
      {admin && conditions && <div className="rounded-xl border bg-white p-4 text-sm"><h2 className="font-semibold">Điều kiện công bố và chốt kỳ</h2><p className="mt-2">Công bố: {conditions.canPublish ? 'Đủ điều kiện' : conditions.publishBlockers.join('; ')}</p><p className="mt-2">Chốt kỳ: {conditions.canClose ? 'Đủ điều kiện' : conditions.closeBlockers.join('; ')}</p>{!compact && <div className="mt-3 flex gap-3"><button disabled={loading || busy || !conditions.canPublish} onClick={() => { if (window.confirm('Công bố phiên bản kết quả mới nhất và thông báo cho sinh viên?')) void act(() => apiClient.publishResults(termId), 'Đã công bố kết quả.'); }} className="rounded-lg bg-blue-700 px-4 py-2 text-white disabled:opacity-40">Công bố tạm</button><button disabled={loading || busy || !conditions.canClose} onClick={() => { if (window.confirm('Chốt kỳ đánh giá và khóa thay đổi kết quả?')) void act(() => apiClient.closeWorkflowTerm(termId), 'Đã chốt kỳ.'); }} className="rounded-lg border px-4 py-2 disabled:opacity-40">Chốt kỳ</button></div>}</div>}
      {!compact && <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3">
        <input aria-label="Tìm sinh viên" placeholder="MSSV hoặc họ tên" value={query} onChange={e => setFilter('q',e.target.value)} className="rounded-lg border px-3 py-2 text-sm" />
        <select aria-label="Trạng thái phiếu" value={state} onChange={e => setFilter('state',e.target.value)} className="rounded-lg border px-3 py-2 text-sm"><option value="">Tất cả trạng thái</option>{Object.entries(evaluationStateLabels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}<option value="RETURNED">Cần chỉnh sửa (tất cả)</option><option value="APPEALS">Có phúc khảo chờ</option></select>
        {admin && <select aria-label="Khoa" value={facultyId} onChange={e => setFilter('facultyId',e.target.value)} className="rounded-lg border px-3 py-2 text-sm"><option value="">Tất cả Khoa</option>{data.filters.faculties.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select>}
        <select aria-label="Lớp" value={classId} onChange={e => setFilter('classId',e.target.value)} className="rounded-lg border px-3 py-2 text-sm"><option value="">Tất cả lớp</option>{data.filters.classes.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}</select>
        <button disabled={loading || busy} onClick={exportRows} className="rounded-lg border px-3 py-2 text-sm">Xuất Excel</button>
        <button onClick={() => window.print()} className="rounded-lg border px-3 py-2 text-sm print:hidden">In</button>
        {!admin && !closed && <button disabled={loading || busy || !selected.length} onClick={() => { if (window.confirm(`Gửi ${selected.length} phiếu đến CTSV? Các phiếu sẽ được khóa sửa.`)) void act(() => apiClient.sendFacultyResults(termId,selected), 'Đã gửi kết quả đến CTSV.'); }} className="rounded-lg bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-40">Gửi CTSV ({selected.length})</button>}
      </div>}
      <div className="overflow-x-auto rounded-xl border bg-white p-3"><table className="w-full text-left text-sm"><thead><tr className="border-b bg-slate-50 text-slate-600">{!compact && !admin && <th className="p-2"><input type="checkbox" aria-label="Chọn phiếu đủ điều kiện trên trang" checked={data.items.some(r => r.ready) && data.items.filter(r => r.ready).every(r => selected.includes(r.studentId))} onChange={e => setSelected(e.target.checked ? data.items.filter(r => r.ready).map(r => r.studentId) : [])} /></th>}<th className="p-2">Sinh viên</th><th className="p-2">Lớp</th><th className="p-2">Trạng thái</th><th className="p-2">Tiêu chí</th><th className="p-2">Thao tác</th></tr></thead><tbody>{data.items.map(r => <tr key={r.studentId} className="border-b align-top">{!compact && !admin && <td className="p-2"><input type="checkbox" aria-label={'Chọn ' + r.student?.fullName} disabled={!r.ready || closed || busy} checked={selected.includes(r.studentId)} onChange={e => setSelected(old => e.target.checked ? [...old,r.studentId] : old.filter(id => id !== r.studentId))} /></td>}<td className="p-2"><strong className="block">{r.student?.fullName}</strong><span className="text-slate-500">{r.student?.studentCode}</span></td><td className="p-2">{r.class?.code}</td><td className="p-2">{data.term.status === 'CLOSED' && r.state === 'PUBLISHED' ? 'Đã chốt chính thức' : evaluationStateLabels[r.state]}{r.returnReason && <p className="text-xs text-amber-800">{r.returnReason}</p>}{r.notSubmittedReason && <p className="text-xs">{r.notSubmittedReason}</p>}{r.pendingAppeals > 0 && <p className="text-xs text-amber-800">{r.pendingAppeals} phúc khảo chờ</p>}</td><td className="p-2">{r.finalizedCriteria}/{r.totalCriteria}<p className="text-xs text-slate-500">{r.pendingEvidence} minh chứng chờ</p></td><td className="space-y-2 p-2"><Link className="block font-semibold text-blue-700" to={(admin ? '/admin/results/' : '/officer/students/') + r.studentId + (admin ? '' : '/assessment') + '?termId=' + termId + '&returnTo=' + encodeURIComponent(base + '?' + params.toString())}>Xem phiếu</Link>{!compact && !closed && admin && ['SENT','PUBLISHED'].includes(r.state) && <button className="block text-amber-800" onClick={() => { setReasonAction({row:r,type:'return'}); setReason(''); }}>Trả Khoa</button>}{!compact && !closed && !admin && r.state === 'NOT_SUBMITTED' && new Date() > new Date(data.term.submissionDeadline) && <button className="block text-slate-600" onClick={() => { setReasonAction({row:r,type:'not-submitted'}); setReason(''); }}>Ghi nhận không nộp</button>}</td></tr>)}</tbody></table>{!data.items.length && <p className="p-6 text-center text-sm text-slate-500">Không có phiếu phù hợp bộ lọc.</p>}</div>
      {compact ? <Link className="inline-block text-sm font-semibold text-blue-700" to={base + '?termId=' + termId}>Xem toàn bộ phiếu →</Link> : <div className="flex items-center justify-between gap-3 text-sm"><select aria-label="Số dòng mỗi trang" value={pageSize} onChange={e => setFilter('pageSize',e.target.value)} className="rounded-lg border p-2">{[25,50,100].map(n => <option key={n} value={n}>{n} dòng/trang</option>)}</select><span>Trang {page}/{Math.max(1,Math.ceil(data.total/pageSize))} · {data.total} phiếu</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setFilter('page',String(page-1))} className="rounded border px-3 py-2 disabled:opacity-40">Trước</button><button disabled={page*pageSize >= data.total} onClick={() => setFilter('page',String(page+1))} className="rounded border px-3 py-2 disabled:opacity-40">Tiếp</button></div></div>}
    </>}
    {reasonAction && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"><form onSubmit={e => { e.preventDefault(); void act(() => reasonAction.type === 'return' ? apiClient.returnFacultyResult(termId,reasonAction.row.studentId,reason) : apiClient.recordNonSubmission(termId,reasonAction.row.studentId,reason), 'Đã ghi nhận và lưu lịch sử.'); }} role="dialog" aria-modal="true" aria-label="Nhập lý do" className="w-full max-w-lg space-y-4 rounded-xl bg-white p-5"><h2 className="font-semibold">{reasonAction.type === 'return' ? 'Trả kết quả cho Khoa' : 'Ghi nhận không nộp'} · {reasonAction.row.student?.fullName}</h2><textarea autoFocus required value={reason} onChange={e => setReason(e.target.value)} aria-label="Lý do bắt buộc" rows={3} className="w-full rounded-lg border p-3 text-sm" /><div className="flex justify-end gap-3"><button type="button" disabled={loading || busy} onClick={() => setReasonAction(null)}>Hủy</button><button disabled={loading || busy || !reason.trim()} className="rounded-lg bg-blue-700 px-4 py-2 text-white disabled:opacity-40">Xác nhận</button></div></form></div>}
  </div>;
};
