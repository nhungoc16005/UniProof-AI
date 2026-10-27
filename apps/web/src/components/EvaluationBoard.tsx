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
type Row = { studentId: string; student?: { fullName: string; studentCode: string }; classId: string; class?: { code: string }; facultyId: string; faculty?: { name: string }; state: string; ready: boolean; finalizedCriteria: number; totalCriteria: number; pendingAppeals: number; pendingEvidence: number; returnReason?: string; notSubmittedReason?: string; revision: number };
type Data = { items: Row[]; summary: Record<string, number>; updatedAt: string; term: { status: string; workflowEnabled: boolean; submissionDeadline: string; appealDeadline: string } };
const errorMessage = (err: any) => err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Không thực hiện được thao tác';

export const EvaluationBoard: React.FC<{ admin?: boolean; compact?: boolean }> = ({ admin = false, compact = false }) => {
  const { activeTerm, user } = useAuth();
  const [params, setParams] = useSearchParams();
  const termId = params.get('termId') || activeTerm.id;
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [reasonAction, setReasonAction] = useState<{ row: Row; type: 'return' | 'not-submitted' } | null>(null);
  const [reason, setReason] = useState('');
  const load = async () => {
    setLoading(true); setError(''); setSelected([]);
    try { setData(await apiClient.getEvaluationWorkflow(termId)); }
    catch (err) { setData(null); setError(errorMessage(err)); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (termId) void load(); }, [termId]);
  const setFilter = (key: string, value: string) => setParams(current => { const next = new URLSearchParams(current); value ? next.set(key, value) : next.delete(key); next.set('termId', termId); return next; });
  const state = params.get('state') || '';
  const classId = params.get('classId') || '';
  const facultyId = params.get('facultyId') || '';
  const query = params.get('q') || '';
  const rows = (data?.items || []).filter(r => (!state || (state === 'APPEALS' ? r.pendingAppeals > 0 : state === 'SENT' ? ['SENT', 'PUBLISHED'].includes(r.state) : r.state === state)) && (!classId || r.classId === classId) && (!facultyId || r.facultyId === facultyId) && (!query || (r.student?.fullName + ' ' + r.student?.studentCode).toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi'))));
  const visible = compact ? rows.slice(0, 6) : rows;
  const closed = data?.term.status === 'CLOSED';
  const act = async (operation: () => Promise<any>, message: string) => {
    setBusy(true); setError(''); setNotice('');
    try { await operation(); setReasonAction(null); setReason(''); await load(); setNotice(message); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  };
  const exportRows = () => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows.map(r => ({ 'MSSV': r.student?.studentCode, 'Họ tên': r.student?.fullName, 'Lớp': r.class?.code, 'Khoa': r.faculty?.name, 'Trạng thái': evaluationStateLabels[r.state], 'Tiêu chí hoàn tất': r.finalizedCriteria + '/' + r.totalCriteria, 'Minh chứng chờ': r.pendingEvidence, 'Phúc khảo chờ': r.pendingAppeals }))), 'Tien do');
    XLSX.writeFile(book, 'Tien-do-ren-luyen-' + termId + '.xlsx');
  };
  const cards = [ ['Chưa nộp', 'notSubmitted', 'NOT_SUBMITTED'], ['Đang chấm', 'reviewing', 'REVIEWING'], ['Cần chỉnh sửa', 'returned', 'STUDENT_RETURNED'], ['Hoàn tất chấm', 'ready', 'READY'], ['Đã gửi CTSV', 'sent', 'SENT'], ['Phúc khảo chờ', 'pendingAppeals', 'APPEALS'] ];
  const groups = [...new Map((data?.items || []).map(r => [r.facultyId, r.faculty])).entries()];
  return <div className="space-y-4">
    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}<button onClick={() => void load()} className="ml-3 underline">Thử lại</button></div>}
    {notice && <div role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}
    {loading ? <p className="p-6 text-sm text-slate-500">Đang tải tiến độ đánh giá…</p> : data && !data.term.workflowEnabled ? <div className="rounded-xl border bg-white p-5 text-sm">Kỳ lịch sử chỉ được xem. <Link to={admin ? "/admin/historical-results" : "/officer/students/legacy"} className="text-blue-700 underline">Tra cứu bảng điểm cũ</Link></div> : data && <>
      <p className="text-sm text-slate-600">{activeTerm.name} · {data.summary.total} sinh viên trong danh sách kỳ · Cập nhật {new Date(data.updatedAt).toLocaleString('vi-VN')}{closed ? ' · Đã chốt chính thức' : ''}</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">{cards.map(([title, key, filter]) => <Link key={key} to={filter === 'APPEALS' && !admin ? '/officer/appeals?termId=' + termId : (admin ? '/admin' : '/officer/students') + '?termId=' + termId + '&state=' + filter} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><span className="block text-xs text-slate-600">{title}</span><strong className="mt-2 block text-2xl text-slate-900">{data.summary[key]}</strong></Link>)}</div>
      {admin && <div className="rounded-xl border bg-white p-4"><h2 className="mb-3 font-semibold">Tiến độ theo Khoa</h2><table className="w-full table-fixed text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-2 w-2/5">Khoa</th><th className="p-2">Sinh viên</th><th className="p-2">Đã gửi</th><th className="p-2">Đã công bố</th><th className="p-2">Phúc khảo</th></tr></thead><tbody>{groups.map(([id, faculty]) => { const group = data.items.filter(r => r.facultyId === id); return <tr key={id} className="border-b"><td className="p-2"><button className="text-blue-700 text-left" onClick={() => setFilter('facultyId', id)}>{faculty?.name}</button></td><td className="p-2">{group.length}</td><td className="p-2">{group.filter(r => ['SENT', 'PUBLISHED'].includes(r.state)).length}/{group.length}</td><td className="p-2">{group.filter(r => r.state === 'PUBLISHED').length}</td><td className="p-2">{group.reduce((n, r) => n + r.pendingAppeals, 0)}</td></tr>; })}</tbody></table></div>}
      {!compact && <div className="flex flex-wrap gap-2 items-center rounded-xl border bg-white p-3">
        <input aria-label="Tìm sinh viên" placeholder="MSSV hoặc họ tên" value={query} onChange={e => setFilter('q', e.target.value)} className="rounded-lg border px-3 py-2 text-sm" />
        <select aria-label="Trạng thái phiếu" value={state} onChange={e => setFilter('state', e.target.value)} className="rounded-lg border px-3 py-2 text-sm"><option value="">Tất cả trạng thái</option>{Object.entries(evaluationStateLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <select aria-label="Lớp" value={classId} onChange={e => setFilter('classId', e.target.value)} className="rounded-lg border px-3 py-2 text-sm"><option value="">Tất cả lớp</option>{[...new Map(data.items.map(r => [r.classId, r.class])).entries()].map(([id, cls]) => <option key={id} value={id}>{cls?.code}</option>)}</select>
        {facultyId && <button className="text-sm text-blue-700" onClick={() => setFilter('facultyId', '')}>Bỏ lọc Khoa</button>}
        <button onClick={exportRows} className="rounded-lg border px-3 py-2 text-sm">Xuất Excel</button><button onClick={() => window.print()} className="rounded-lg border px-3 py-2 text-sm print:hidden">In</button>
        {!admin && !closed && <button disabled={busy || !selected.length} onClick={() => void act(() => apiClient.sendFacultyResults(termId, selected), 'Đã gửi kết quả đến CTSV.')} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Gửi CTSV ({selected.length})</button>}
        {admin && !closed && <button disabled={busy || data.items.some(r => !['SENT', 'PUBLISHED', 'NOT_SUBMITTED_RECORDED'].includes(r.state))} onClick={() => { if (window.confirm('Công bố tạm các kết quả Khoa đã gửi? Sinh viên sẽ thấy điểm và được phúc khảo đến hạn của kỳ.')) void act(() => apiClient.publishResults(termId), 'Đã công bố tạm kết quả.'); }} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Công bố tạm</button>}
      </div>}
      <div className="rounded-xl border bg-white p-2 sm:p-4"><table className="w-full table-fixed text-left text-xs sm:text-sm"><thead><tr className="border-b bg-slate-50 text-slate-600">{!compact && !admin && <th className="w-8 p-2"><input type="checkbox" aria-label="Chọn phiếu đủ điều kiện" checked={rows.some(r => r.ready) && rows.filter(r => r.ready).every(r => selected.includes(r.studentId))} onChange={e => setSelected(e.target.checked ? rows.filter(r => r.ready).slice(0, 100).map(r => r.studentId) : [])} /></th>}<th className="p-2 w-[24%]">Sinh viên</th><th className="p-2 w-[12%]">Lớp</th><th className="p-2 w-[22%]">Trạng thái</th><th className="p-2 w-[14%]">Tiêu chí</th><th className="p-2">Thao tác</th></tr></thead><tbody>{visible.map(r => <tr key={r.studentId} className="border-b align-top">{!compact && !admin && <td className="p-2"><input type="checkbox" aria-label={'Chọn ' + r.student?.fullName} disabled={!r.ready || closed || busy} checked={selected.includes(r.studentId)} onChange={e => setSelected(old => e.target.checked ? [...old, r.studentId].slice(0, 100) : old.filter(id => id !== r.studentId))} /></td>}<td className="break-words p-2"><strong className="block">{r.student?.fullName}</strong><span className="text-slate-500">{r.student?.studentCode}</span></td><td className="break-words p-2">{r.class?.code}</td><td className="break-words p-2">{closed && r.state === 'PUBLISHED' ? 'Đã chốt chính thức' : evaluationStateLabels[r.state]}{r.returnReason && <p className="mt-1 text-xs text-amber-800">{r.returnReason}</p>}{r.notSubmittedReason && <p className="mt-1 text-xs text-slate-500">{r.notSubmittedReason}</p>}{r.pendingAppeals > 0 && <p className="text-xs text-amber-800">{r.pendingAppeals} phúc khảo chờ</p>}</td><td className="p-2">{r.finalizedCriteria}/{r.totalCriteria}<p className="text-xs text-slate-500">{r.pendingEvidence} minh chứng chờ</p></td><td className="space-y-2 p-2"><Link className="block font-semibold text-blue-700" to={(admin ? '/admin/results/' : '/officer/students/') + r.studentId + (admin ? '' : '/assessment') + '?termId=' + termId}>Xem phiếu</Link>{!compact && !closed && admin && ['SENT', 'PUBLISHED'].includes(r.state) && <button className="block text-amber-800" onClick={() => { setReasonAction({ row: r, type: 'return' }); setReason(''); }}>Trả Khoa</button>}{!compact && !closed && !admin && r.state === 'NOT_SUBMITTED' && new Date() > new Date(data.term.submissionDeadline) && <button className="block text-slate-600" onClick={() => { setReasonAction({ row: r, type: 'not-submitted' }); setReason(''); }}>Ghi nhận không nộp</button>}</td></tr>)}</tbody></table>{!visible.length && <p className="p-6 text-center text-sm text-slate-500">Không có phiếu phù hợp bộ lọc.</p>}</div>
      {compact && <Link className="inline-block text-sm font-semibold text-blue-700" to="/officer/students">Xem toàn bộ phiếu →</Link>}
    </>}
    {reasonAction && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"><div role="dialog" aria-modal="true" aria-label="Nhập lý do" className="w-full max-w-lg space-y-4 rounded-xl bg-white p-5"><h2 className="font-semibold">{reasonAction.type === 'return' ? 'Trả kết quả cho Khoa' : 'Ghi nhận sinh viên không nộp phiếu'} · {reasonAction.row.student?.fullName}</h2><textarea autoFocus value={reason} onChange={e => setReason(e.target.value)} placeholder="Lý do bắt buộc" rows={3} className="w-full rounded-lg border p-3 text-sm" /><div className="flex justify-end gap-3"><button disabled={busy} onClick={() => setReasonAction(null)}>Hủy</button><button disabled={busy || !reason.trim()} className="rounded-lg bg-blue-700 px-4 py-2 text-white disabled:opacity-40" onClick={() => void act(() => reasonAction.type === 'return' ? apiClient.returnFacultyResult(termId, reasonAction.row.studentId, reason) : apiClient.recordNonSubmission(termId, reasonAction.row.studentId, reason), 'Đã ghi nhận và lưu lịch sử.')}>Xác nhận</button></div></div></div>}
  </div>;
};
