import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { ClipboardList, SearchX } from 'lucide-react';
import { TableSkeleton } from './ui/Skeleton';
import { apiClient } from '../lib/apiClient';

export const evaluationStateLabels: Record<string, string> = {
  NOT_SUBMITTED: 'Chưa nộp', STUDENT_RETURNED: 'Chờ sinh viên sửa', REVIEWING: 'Đang chấm',
  READY: 'Hoàn tất chấm', SENT: 'Đã gửi CTSV', PUBLISHED: 'Đã công bố tạm',
  FACULTY_RETURNED: 'CTSV trả lại', NOT_SUBMITTED_RECORDED: 'Đã ghi nhận không nộp',
};
export type EvaluationRow = { studentId: string; student?: { fullName: string; studentCode: string }; classId: string; class?: { id: string; code: string }; facultyId: string; faculty?: { id: string; name: string }; state: string; ready: boolean; blockers: string[]; finalizedCriteria: number; totalCriteria: number; pendingAppeals: number; pendingEvidence: number; returnReason?: string; notSubmittedReason?: string; revision: number; officialScore?: number | null; classification?: string; publicationRevision?: number | null };
export type EvaluationData = { items: EvaluationRow[]; summary: Record<string, number>; updatedAt: string; total: number; page: number; pageSize: number; facultyProgress: { id: string; name: string; total: number; sent: number; published: number; pendingAppeals: number }[]; filters: { classes: { id: string; code: string }[]; faculties: { id: string; name: string }[] }; term: { id: string; name: string; status: string; workflowEnabled: boolean; submissionDeadline: string; appealDeadline: string; reviewDeadline?: string } };
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
  const [response, setResponse] = useState<{ key: string; data: EvaluationData; conditions: PublicationConditions | null; quickSummary: Record<string, number> } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
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
  const requestKey = JSON.stringify({ termId, filters, admin, refresh });
  const data = response?.key === requestKey ? response.data : null;
  const conditions = response?.key === requestKey ? response.conditions : null;
  const loadError = failure?.key === requestKey ? failure.message : '';
  const loading = Boolean(termId && !data && !loadError);
  const options = response?.data.term.id === termId ? response.data.filters : { classes: [], faculties: [] };
  const hasFilters = Boolean(state || classId || facultyId || query.trim() || page > 1);
  useEffect(() => {
    let cancelled = false;
    setSelected([]); setError(''); setReasonAction(null);
    if (!termId) return;
    Promise.all([apiClient.getEvaluationWorkflow(termId, filters), admin ? apiClient.getPublicationConditions(termId) : Promise.resolve(null), state ? apiClient.getEvaluationWorkflow(termId, { ...filters, state: undefined, page: 1, pageSize: 1 }) : Promise.resolve(null)])
      .then(([result, policy, quickCounts]) => { if (!cancelled) setResponse({ key: requestKey, data: result, conditions: policy, quickSummary: quickCounts?.summary || result.summary }); })
      .catch(err => { if (!cancelled) setFailure({ key: requestKey, message: errorMessage(err) }); });
    return () => { cancelled = true; };
  }, [requestKey]);
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
  return <div className="space-y-4 font-sans">
    {error && <div role="alert" className="rounded-[12px] border border-[#FECACA] bg-[#FEF2F2] p-4 text-xs sm:text-sm text-[#991B1B]">{error}<button onClick={() => setRefresh(v => v + 1)} className="ml-3 underline font-semibold">Thử lại</button></div>}
    {notice && <p role="status" className="rounded-[12px] bg-[#ECFDF5] border border-[#A7F3D0] p-3 text-xs sm:text-sm text-[#065F46] font-medium">{notice}</p>}
    {!termId && <p className="rounded-[12px] border border-[#E8E8EC] bg-[#FFFFFF] p-5 text-sm text-[#6B6B6B]">Chưa có kỳ đánh giá. {admin && <Link className="text-[#1D6FC2] font-semibold hover:underline" to="/admin/terms">Thiết lập kỳ đánh giá</Link>}</p>}
      {termId && !compact && <div className="flex flex-wrap items-center gap-2.5 rounded-[12px] border border-[#E8E8EC] bg-[#FFFFFF] p-3">
        <input aria-label="Tìm sinh viên" placeholder="MSSV hoặc họ tên" value={query} onChange={e => setFilter('q',e.target.value)} className="rounded-[6px] border border-[#E8E8EC] bg-[#FFFFFF] px-3 py-2 text-xs sm:text-sm text-[#0A0A0A] placeholder-[#9C9C9C] focus:outline-none focus:border-[#1D6FC2] focus:ring-2 focus:ring-[#1D6FC2]/15" />
        <select aria-label="Trạng thái đánh giá" value={state} onChange={e => setFilter('state',e.target.value)} className="rounded-[6px] border border-[#E8E8EC] bg-[#FFFFFF] px-3 py-2 text-xs sm:text-sm text-[#0A0A0A] focus:outline-none focus:border-[#1D6FC2] cursor-pointer"><option value="">Tất cả trạng thái</option>{Object.entries(evaluationStateLabels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}<option value="RETURNED">Cần chỉnh sửa (tất cả)</option><option value="APPEALS">Có phúc khảo chờ</option></select>
        {admin && <select aria-label="Khoa" value={facultyId} onChange={e => setFilter('facultyId',e.target.value)} className="rounded-[6px] border border-[#E8E8EC] bg-[#FFFFFF] px-3 py-2 text-xs sm:text-sm text-[#0A0A0A] focus:outline-none focus:border-[#1D6FC2] cursor-pointer"><option value="">Tất cả Khoa</option>{options.faculties.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select>}
        <select aria-label="Lớp" value={classId} onChange={e => setFilter('classId',e.target.value)} className="rounded-[6px] border border-[#E8E8EC] bg-[#FFFFFF] px-3 py-2 text-xs sm:text-sm text-[#0A0A0A] focus:outline-none focus:border-[#1D6FC2] cursor-pointer"><option value="">Tất cả lớp</option>{options.classes.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}</select>
        <button disabled={loading || busy || !data?.total} onClick={exportRows} className="rounded-[6px] border border-[#E8E8EC] bg-[#FFFFFF] hover:bg-[#FAFAFA] px-3 py-2 text-xs sm:text-sm font-medium text-[#0A0A0A] disabled:opacity-40 transition-colors">Xuất Excel</button>
        <button onClick={() => window.print()} className="rounded-[6px] border border-[#E8E8EC] bg-[#FFFFFF] hover:bg-[#FAFAFA] px-3 py-2 text-xs sm:text-sm font-medium text-[#0A0A0A] print:hidden transition-colors">In</button>
        {!admin && data && !closed && <button disabled={loading || busy || !selected.length} onClick={() => { if (window.confirm(`Gửi ${selected.length} kết quả đánh giá đến CTSV? Các kết quả sẽ được khóa sửa.`)) void act(() => apiClient.sendFacultyResults(termId,selected), 'Đã gửi kết quả đến CTSV.'); }} className="rounded-[6px] bg-[#1D6FC2] hover:bg-[#175A9E] px-4 py-2 text-xs sm:text-sm font-semibold text-white disabled:opacity-40 transition-colors btn-primary-lift">Gửi CTSV ({selected.length})</button>}
      </div>}
    {data && data.term.id === termId && <>
      <p className="text-xs sm:text-sm text-[#6B6B6B]">{data.term.name} · {data.total} sinh viên phù hợp · Cập nhật {new Date(data.updatedAt).toLocaleString('vi-VN')}{closed ? ' · Chỉ xem' : ''}</p>
      {!data.term.workflowEnabled && <p className="rounded-[12px] bg-[#F4F4F6] p-3 text-xs sm:text-sm text-[#6B6B6B]">Kỳ lịch sử: tra cứu kết quả theo bộ tiêu chí của kỳ; không áp dụng bàn giao mới.</p>}
      <div aria-label="Lọc nhanh trạng thái" className="flex flex-wrap gap-2">{cards.map(([title,key,filter]) => <Link key={key} to={(filter === 'APPEALS' && !admin ? '/officer/appeals' : base) + '?termId=' + termId + '&state=' + filter} className="inline-flex items-center gap-2 rounded-full border border-[#E8E8EC] bg-white px-3 py-1.5 text-xs hover:border-[#1D6FC2]"><span className="block text-xs font-medium text-[#6B6B6B]">{title}</span><strong className="font-semibold text-[#0A0A0A]">{response?.quickSummary[key]}</strong></Link>)}</div>
      {admin && conditions && <details className="rounded-[12px] border border-[#E8E8EC] bg-white p-4 text-sm">
        <summary className="cursor-pointer font-semibold">Công bố: {conditions.canPublish ? 'Đủ điều kiện' : 'Chưa đủ điều kiện'} — Xem điều kiện</summary>
        <p className="mt-3 text-[#6B6B6B]">{conditions.canPublish ? 'Kết quả đủ điều kiện công bố.' : conditions.publishBlockers.join('; ')}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3"><button disabled={loading || busy || !conditions.canPublish || closed} onClick={() => { if (window.confirm('Công bố phiên bản kết quả mới nhất và thông báo cho sinh viên?')) void act(() => apiClient.publishResults(termId), 'Đã công bố kết quả.'); }} className="rounded-[6px] bg-[#1D6FC2] px-4 py-2 font-semibold text-white disabled:opacity-40">Công bố tạm</button><Link className="text-[#1D6FC2] hover:underline" to={'/admin/terms?termId=' + termId}>Đi tới Kỳ đánh giá để chốt kỳ</Link></div>
      </details>}


    </>}
    <section aria-label="Danh sách đánh giá" aria-busy={loading} className="min-h-[180px]">
      {loading ? <div role="status" aria-label="Đang tải danh sách đánh giá" className="rounded-[12px] border border-[#E8E8EC] bg-[#FFFFFF] p-4"><p className="text-xs sm:text-sm text-[#6B6B6B] mb-3">Đang tải danh sách đánh giá…</p><TableSkeleton rows={5} cols={5} /></div>
      : loadError ? <div role="alert" className="rounded-[12px] border border-[#FECACA] bg-[#FEF2F2] p-5 text-xs sm:text-sm text-[#991B1B]"><h2 className="font-bold font-heading text-sm sm:text-base">Không tải được danh sách đánh giá</h2><p className="mt-1">{loadError}</p><button type="button" onClick={() => setRefresh(value => value + 1)} className="mt-3 rounded-[6px] border border-[#FCA5A5] bg-[#FFFFFF] px-3.5 py-1.5 font-semibold text-xs text-[#991B1B] hover:bg-[#FEE2E2] transition-colors">Thử lại</button></div>
      : data && data.items.length > 0 ? <>
      <div className="overflow-x-auto rounded-[12px] border border-[#E8E8EC] bg-[#FFFFFF]"><table className="w-full text-left text-xs sm:text-sm"><thead><tr className="border-b border-[#E8E8EC] bg-[#FAFAFA] text-[#6B6B6B] font-medium">{!compact && !admin && <th className="p-3"><input type="checkbox" aria-label="Chọn kết quả đủ điều kiện trên trang" checked={data.items.some(r => r.ready) && data.items.filter(r => r.ready).every(r => selected.includes(r.studentId))} onChange={e => setSelected(e.target.checked ? data.items.filter(r => r.ready).map(r => r.studentId) : [])} className="rounded cursor-pointer" /></th>}<th className="p-3">Sinh viên</th><th className="p-3">Lớp</th><th className="p-3">Trạng thái</th><th className="p-3">Tiêu chí</th><th className="p-3">Thao tác</th></tr></thead><tbody className="divide-y divide-[#E8E8EC]">{data.items.map(r => <tr key={r.studentId} className="hover:bg-[#FAFAFA] transition-colors align-top">{!compact && !admin && <td className="p-3"><input type="checkbox" aria-label={'Chọn ' + r.student?.fullName} disabled={!r.ready || closed || busy} checked={selected.includes(r.studentId)} onChange={e => setSelected(old => e.target.checked ? [...old,r.studentId] : old.filter(id => id !== r.studentId))} className="rounded cursor-pointer" /></td>}<td className="p-3"><strong className="block text-[#0A0A0A] font-semibold">{r.student?.fullName}</strong><span className="text-[#6B6B6B] text-xs font-mono">{r.student?.studentCode}</span></td><td className="p-3 text-[#0A0A0A]">{r.class?.code}</td><td className="p-3"><span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-[#FAFAFA] border border-[#E8E8EC] text-[#0A0A0A]">{data.term.status === 'CLOSED' && r.state === 'PUBLISHED' ? 'Đã chốt chính thức' : evaluationStateLabels[r.state]}</span>{r.returnReason && <p className="text-xs text-[#DC2626] font-medium mt-1">{r.returnReason}</p>}{r.notSubmittedReason && <p className="text-xs text-[#6B6B6B] mt-1">{r.notSubmittedReason}</p>}{r.pendingAppeals > 0 && <p className="text-xs text-[#D97706] font-medium mt-1">{r.pendingAppeals} phúc khảo chờ</p>}</td><td className="p-3 text-[#0A0A0A] font-medium">{r.finalizedCriteria}/{r.totalCriteria}<p className="text-xs text-[#6B6B6B]">{r.pendingEvidence} minh chứng chờ</p></td><td className="space-y-1.5 p-3"><Link className="block font-semibold text-[#1D6FC2] hover:text-[#175A9E] hover:underline" to={(admin ? '/admin/results/' : '/officer/students/') + r.studentId + (admin ? '' : '/assessment') + '?termId=' + termId + '&returnTo=' + encodeURIComponent(base + '?' + params.toString())}>Xem chi tiết</Link>{!compact && !closed && admin && ['SENT','PUBLISHED'].includes(r.state) && <button className="block text-xs font-medium text-[#D97706] hover:underline" onClick={() => { setReasonAction({row:r,type:'return'}); setReason(''); }}>Trả Khoa</button>}{!compact && !closed && !admin && r.state === 'NOT_SUBMITTED' && new Date() > new Date(data.term.submissionDeadline) && <button className="block text-xs font-medium text-[#6B6B6B] hover:underline" onClick={() => { setReasonAction({row:r,type:'not-submitted'}); setReason(''); }}>Ghi nhận không nộp</button>}</td></tr>)}</tbody></table></div>
      {compact ? <Link className="inline-block text-xs sm:text-sm font-semibold text-[#1D6FC2] hover:text-[#175A9E] hover:underline pt-1" to={base + '?termId=' + termId}>Xem toàn bộ danh sách →</Link> : <div className="flex items-center justify-between gap-3 text-xs sm:text-sm text-[#6B6B6B] pt-2"><select aria-label="Số dòng mỗi trang" value={pageSize} onChange={e => setFilter('pageSize',e.target.value)} className="rounded-[6px] border border-[#E8E8EC] p-2 bg-[#FFFFFF] text-[#0A0A0A] cursor-pointer">{[25,50,100].map(n => <option key={n} value={n}>{n} dòng/trang</option>)}</select><span className="font-medium text-[#0A0A0A]">Trang {page}/{Math.max(1,Math.ceil(data.total/pageSize))} · {data.total} sinh viên</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setFilter('page',String(page-1))} className="rounded-[6px] border border-[#E8E8EC] bg-[#FFFFFF] hover:bg-[#FAFAFA] px-3 py-1.5 disabled:opacity-40 font-medium transition-colors">Trước</button><button disabled={page*pageSize >= data.total} onClick={() => setFilter('page',String(page+1))} className="rounded-[6px] border border-[#E8E8EC] bg-[#FFFFFF] hover:bg-[#FAFAFA] px-3 py-1.5 disabled:opacity-40 font-medium transition-colors">Tiếp</button></div></div>}
      </> : data ? <div role="status" className="flex flex-col items-center rounded-[12px] border border-[#E8E8EC] bg-[#FFFFFF] px-5 py-10 text-center">
        {hasFilters ? <SearchX aria-hidden="true" className="mb-4 h-10 w-10 text-[#9C9C9C]" /> : <ClipboardList aria-hidden="true" className="mb-4 h-10 w-10 text-[#9C9C9C]" />}
        <h2 className="text-base font-bold font-heading text-[#0A0A0A]">{hasFilters ? 'Không tìm thấy đánh giá phù hợp' : 'Chưa có danh sách đánh giá cho kỳ này'}</h2>
        <p className="mt-2 max-w-lg text-xs sm:text-sm leading-6 text-[#6B6B6B]">{hasFilters ? 'Hãy thử từ khóa khác hoặc xóa bộ lọc để xem lại danh sách của kỳ đang chọn.' : admin ? 'Danh sách sinh viên được tạo khi kỳ đánh giá được mở. Hãy kiểm tra thiết lập và trạng thái kỳ.' : 'Vui lòng liên hệ Phòng CTSV để kiểm tra danh sách sinh viên và phân công của Khoa trong kỳ này.'}</p>
        {hasFilters ? <button type="button" onClick={() => setParams(current => { const next = new URLSearchParams(current); ['q','state','classId','facultyId','page'].forEach(key => next.delete(key)); next.set('termId', termId); return next; })} className="mt-4 rounded-[6px] border border-[#C2DBF2] bg-[#E1EDF9] px-4 py-2 text-xs font-semibold text-[#1D6FC2] hover:bg-[#C2DBF2] transition-colors">Xóa bộ lọc</button> : admin && <Link to={`/admin/terms?termId=${encodeURIComponent(termId)}`} className="mt-4 rounded-[6px] bg-[#1D6FC2] hover:bg-[#175A9E] px-4 py-2 text-xs font-semibold text-white btn-primary-lift">Quản lý kỳ đánh giá</Link>}
      </div> : null}
    </section>

    {reasonAction && data && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A0A0A]/40 backdrop-blur-xs p-4"><form onSubmit={e => { e.preventDefault(); void act(() => reasonAction.type === 'return' ? apiClient.returnFacultyResult(termId,reasonAction.row.studentId,reason) : apiClient.recordNonSubmission(termId,reasonAction.row.studentId,reason), 'Đã ghi nhận và lưu lịch sử.'); }} role="dialog" aria-modal="true" aria-label="Nhập lý do" className="w-full max-w-lg space-y-4 rounded-[12px] bg-[#FFFFFF] border border-[#E8E8EC] p-5 shadow-xl"><h2 className="font-bold font-heading text-sm sm:text-base text-[#0A0A0A]">{reasonAction.type === 'return' ? 'Trả kết quả cho Khoa' : 'Ghi nhận không nộp'} · {reasonAction.row.student?.fullName}</h2><textarea autoFocus required value={reason} onChange={e => setReason(e.target.value)} aria-label="Lý do bắt buộc" rows={3} className="w-full rounded-[6px] border border-[#E8E8EC] p-3 text-xs sm:text-sm text-[#0A0A0A] focus:outline-none focus:border-[#1D6FC2] focus:ring-2 focus:ring-[#1D6FC2]/15" /><div className="flex justify-end gap-3"><button type="button" disabled={loading || busy} onClick={() => setReasonAction(null)} className="px-3.5 py-2 text-xs font-medium text-[#6B6B6B] hover:text-[#0A0A0A]">Hủy</button><button disabled={loading || busy || !reason.trim()} className="rounded-[6px] bg-[#1D6FC2] hover:bg-[#175A9E] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40 transition-colors btn-primary-lift">Xác nhận</button></div></form></div>}
  </div>;
};
