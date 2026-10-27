import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { apiClient } from '../../lib/apiClient';
import { Criterion, CriterionAssessment, RubricPayload, User } from '../../types';
import { useAuth } from '../../context/AuthContext';

const booleanFields = new Set([
  'improvedFromPreviousTerm', 'academicWarning', 'eligibleMembership', 'tuitionCompliance',
  'studentWeekParticipation', 'requiredSurveyParticipation', 'disciplinaryViolation', 'healthInsurance',
  'residenceDeclaration', 'organizerConfirmation', 'advisorConfirmation',
  'excellentDutyConfirmation', 'awardEvidence', 'institutionAwardEvidence',
]);

const fieldLabels: Record<string, string> = {
  attendanceViolations: 'Số lần vi phạm chuyên cần',
  classWarnings: 'Số lần bị nhắc nhở/không được vào lớp',
  examBans: 'Số học phần không được thi do vắng',
  unexcusedAbsences: 'Số lần vắng nhóm không lý do',
  excusedAbsences: 'Số lần vắng nhóm có lý do',
  missedGroupDeadlines: 'Số nội dung nhóm không hoàn thành đúng hạn',
  academicTier: 'Xếp loại học tập đã xác minh',
  improvedFromPreviousTerm: 'Điểm học tập cao hơn kỳ trước',
  academicWarning: 'Thuộc diện cảnh báo học tập',
  awardTier: 'Mức thành tích',
  officialAssessment: 'Kết luận xác minh chính thức',
  disciplinaryViolation: 'Có vi phạm điều cấm theo quy chế',
  nonCauseAccountLocks: 'Số lần khóa tài khoản do nguyên nhân khác',
  classTaskFailures: 'Số lần không hoàn thành việc lớp giao',
  unexcusedClassMeetingAbsences: 'Số lần vắng họp lớp không lý do',
  excusedClassMeetingAbsences: 'Số lần vắng họp lớp có lý do',
  requiredSurveyParticipation: 'Đã tham gia khảo sát bắt buộc',
  verifiedActivityCount: 'Số hoạt động có minh chứng đã duyệt (Backend tự đếm)',
  cheerleaderActivityCount: 'Số minh chứng cổ vũ đã duyệt (Backend tự đếm)',
  communityViolations: 'Số vi phạm tại nơi cư trú/cộng đồng',
  convertedCommunityPoints: 'Điểm hoạt động cộng đồng quy đổi',
  collectiveApprovalPercent: 'Tỷ lệ tập thể bình chọn (%)',
};

const isNumberField = (key: string) => /Count|Violations|Bans|Absences|Failures|Percent|Points|Locks/i.test(key);

interface CardProps {
  studentId: string;
  termId: string;
  criterion: Criterion;
  assessment: CriterionAssessment | null;
  readOnly: boolean;
  onSaved: () => Promise<void>;
}

const CriterionCard: React.FC<CardProps> = ({ studentId, termId, criterion, assessment, readOnly, onSaved }) => {
  const fields: string[] = criterion.scoringConfig?.requiredData || [];
  const [verifiedDraft, setVerifiedDraft] = useState<Record<string, string>>({});
  const [verificationNote, setVerificationNote] = useState(assessment?.verificationNote || '');
  const [finalScore, setFinalScore] = useState(String(assessment?.officialScore ?? assessment?.suggestedScore ?? ''));
  const [finalReason, setFinalReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const initial: Record<string, string> = {};
    for (const [key, value] of Object.entries(assessment?.verifiedData || {})) {
      initial[key] = typeof value === 'boolean' ? String(value) : String(value ?? '');
    }
    setVerifiedDraft(initial);
    setVerificationNote(assessment?.verificationNote || '');
    setFinalScore(String(assessment?.officialScore ?? assessment?.suggestedScore ?? ''));
  }, [assessment?.id, assessment?.updatedAt]);

  const action = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true); setError(''); setMessage('');
    try { await fn(); await onSaved(); setMessage(success); }
    catch (err: any) { setError(err.response?.data?.message || err.message || 'Không lưu được dữ liệu.'); }
    finally { setBusy(false); }
  };

  const toVerifiedData = () => {
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(verifiedDraft)) {
      if (value === '') continue;
      if (booleanFields.has(key)) data[key] = value === 'true';
      else if (key === 'academicTier' || key === 'awardTier' || key === 'officialAssessment') data[key] = value;
      else if (isNumberField(key) || key === 'officialScore') data[key] = Number(value);
      else data[key] = value;
    }
    return data;
  };

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-bold text-slate-900">Mục {criterion.code}. {criterion.name}</h3>
          <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{criterion.description}</p>
        </div>
        <div className="shrink-0 text-right text-sm"><span className="font-semibold">Tối đa {criterion.maxScore} điểm</span><div className="text-xs text-slate-500">{assessment?.status === 'FINALIZED' ? 'Đã xác nhận' : assessment?.status === 'READY_FOR_REVIEW' ? 'Chờ cán bộ duyệt' : 'Chờ xác minh'}</div></div>
      </div>

      <div className="grid gap-3 rounded-lg border border-violet-100 bg-violet-50/60 p-3 text-sm sm:grid-cols-2">
        <div><strong className="text-violet-950">Sinh viên tự đánh giá:</strong> {assessment?.selfScore ?? 'Chưa nhập điểm'} / {criterion.maxScore}
          {assessment?.selfNote && <p className="mt-1 whitespace-pre-line text-xs text-slate-700">{assessment.selfNote}</p>}
        </div>
        <div><strong className="text-violet-950">Minh chứng và AI:</strong>
          {assessment?.evidences?.length ? <ul className="mt-1 space-y-1 text-xs">{assessment.evidences.map((evidence) => <li key={evidence.id} className="rounded bg-white p-2"><Link className="font-medium text-blue-700 hover:underline" to={`/officer/review/${evidence.id}`}>{evidence.declaredActivityName || 'Hồ sơ minh chứng'}</Link><span className="ml-1 text-slate-500">· {({ APPROVED: 'Hợp lệ', REJECTED: 'Từ chối', NEEDS_SUPPLEMENT: 'Cần bổ sung' } as Record<string, string>)[evidence.status] || 'Chờ xác minh'}</span>{evidence.aiSuggestions?.[0] && <p className="mt-1 text-violet-800">AI đề xuất: {evidence.aiSuggestions[0].suggestedScore ?? 'Chưa có điểm'} · {evidence.aiSuggestions[0].reasoning}</p>}</li>)}</ul> : <span className="ml-1 text-xs text-slate-600">Chưa có hồ sơ.</span>}
        </div>
      </div>

      {!!assessment?.verifiedData && <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs"><strong className="text-slate-800">Dữ liệu đã xác minh:</strong><dl className="mt-2 grid gap-1 sm:grid-cols-2">{Object.entries(assessment.verifiedData).map(([key, value]) => <div key={key} className="flex gap-2"><dt className="text-slate-500">{fieldLabels[key] || key}:</dt><dd className="font-medium text-slate-800">{String(value)}</dd></div>)}</dl>{assessment.verificationNote && <p className="mt-2 text-slate-600">Căn cứ: {assessment.verificationNote}</p>}</div>}

      <details className="rounded-lg border border-slate-200 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">Dữ liệu chính thức cần xác minh</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map((key) => (
            <label key={key} className="text-xs font-medium text-slate-700">{fieldLabels[key] || key}
              {booleanFields.has(key) ? (
              <select value={verifiedDraft[key] ?? ''} disabled={readOnly} onChange={(event) => setVerifiedDraft((current) => ({ ...current, [key]: event.target.value }))} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm disabled:bg-slate-100">
                  <option value="">Chưa xác minh</option><option value="true">Có</option><option value="false">Không</option>
                </select>
              ) : key === 'academicTier' ? (
              <select value={verifiedDraft[key] ?? ''} disabled={readOnly} onChange={(event) => setVerifiedDraft((current) => ({ ...current, [key]: event.target.value }))} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm disabled:bg-slate-100">
                  <option value="">Chưa xác minh</option><option value="BELOW_AVERAGE">Yếu trở xuống</option><option value="AVERAGE">Trung bình</option><option value="ABOVE_AVERAGE">Khá</option><option value="GOOD">Giỏi</option><option value="EXCELLENT">Xuất sắc</option>
                </select>
              ) : key === 'awardTier' ? (
              <select value={verifiedDraft[key] ?? ''} disabled={readOnly} onChange={(event) => setVerifiedDraft((current) => ({ ...current, [key]: event.target.value }))} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm disabled:bg-slate-100">
                  <option value="">Chưa xác minh</option><option value="PARTICIPATED">Có tham gia, chưa đạt giải</option><option value="CONSOLATION_OR_HIGHER">Từ giải khuyến khích trở lên</option>
                </select>
              ) : (
                <input type={isNumberField(key) ? 'number' : 'text'} min={isNumberField(key) ? 0 : undefined} readOnly={readOnly || key === 'verifiedActivityCount' || key === 'cheerleaderActivityCount'} placeholder={key === 'verifiedActivityCount' || key === 'cheerleaderActivityCount' ? 'Được tính từ hồ sơ đã duyệt' : undefined} value={verifiedDraft[key] ?? ''} onChange={(event) => setVerifiedDraft((current) => ({ ...current, [key]: event.target.value }))} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm read-only:bg-slate-100" />
              )}
            </label>
          ))}
          {criterion.scoringConfig?.kind === 'manual_verified' && <label className="text-xs font-medium text-slate-700">Điểm đề xuất theo căn cứ (0–{criterion.maxScore})<input type="number" min="0" max={criterion.maxScore} step="0.5" disabled={readOnly} value={verifiedDraft.officialScore ?? ''} onChange={(event) => setVerifiedDraft((current) => ({ ...current, officialScore: event.target.value }))} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm disabled:bg-slate-100" /></label>}
        </div>
        <label className="mt-3 block text-xs font-medium text-slate-700">Nguồn/căn cứ xác minh
          <textarea value={verificationNote} disabled={readOnly} onChange={(event) => setVerificationNote(event.target.value)} rows={2} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100" placeholder="Ghi nguồn dữ liệu trường, văn bản hoặc xác nhận đã kiểm tra" />
        </label>
        <button disabled={readOnly || busy} onClick={() => action(() => apiClient.verifyCriterion(studentId, termId, criterion.id, { data: toVerifiedData(), note: verificationNote }), 'Đã gửi dữ liệu xác minh để tính điểm đề xuất.')} className="mt-3 rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Lưu xác minh & tính điểm đề xuất</button>
      </details>

      {(assessment?.suggestionReason || assessment?.status === 'READY_FOR_REVIEW') && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <div><strong>Đề xuất theo quy tắc:</strong> {assessment?.suggestedScore ?? 'Chưa thể tính'} / {criterion.maxScore} điểm</div>
          {assessment?.suggestionReason && <p className="mt-1 text-xs">{assessment.suggestionReason}</p>}
        </div>
      )}

      {assessment?.status === 'READY_FOR_REVIEW' && (
        <div className="grid gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 md:grid-cols-[140px_1fr_auto] md:items-end">
          <label className="text-xs font-semibold text-slate-700">Điểm chính thức
            <input type="number" min="0" max={criterion.maxScore} step="0.5" value={finalScore} disabled={readOnly} onChange={(event) => setFinalScore(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm disabled:bg-slate-100" />
          </label>
          <label className="text-xs font-semibold text-slate-700">Lý do điều chỉnh (bắt buộc nếu khác đề xuất)
            <input value={finalReason} disabled={readOnly} onChange={(event) => setFinalReason(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm disabled:bg-slate-100" />
          </label>
          <button disabled={readOnly || busy || finalScore === '' || (Number(finalScore) !== assessment?.suggestedScore && !finalReason.trim())} onClick={() => action(() => apiClient.finalizeCriterion(studentId, termId, criterion.id, { score: Number(finalScore), reason: finalReason }), 'Đã xác nhận điểm chính thức.')} className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Xác nhận điểm</button>
        </div>
      )}

      {assessment?.status === 'FINALIZED' && <p className="text-sm text-emerald-800">Điểm chính thức: <strong>{assessment.officialScore} / {criterion.maxScore}</strong> · {assessment.officialReason}</p>}
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
    </article>
  );
};

export const StudentAssessment: React.FC = () => {
  const { studentId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { activeTerm, user } = useAuth();
  const termId = params.get('termId') || activeTerm.id;
  const tab = params.get('tab') || 'sheet';
  const [student, setStudent] = useState<User | null>(null);
  const [payload, setPayload] = useState<RubricPayload | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState<string | null>(null);
  const isAdmin = user.role === 'ADMIN';
  const isReadOnly = isAdmin || !payload?.permissions?.canReview;
  const load = async () => {
    setLoading(true); setError('');
    try {
      const [u, result, events] = await Promise.all([apiClient.getUserById(studentId), apiClient.getStudentAssessments(studentId, termId), apiClient.getAssessmentHistory(termId, studentId)]);
      setStudent(u); setPayload(result); setHistory(events);
    } catch (err: any) { setError(err.response?.data?.error?.message || err.response?.data?.message || 'Không tải được phiếu.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (studentId && termId) void load(); }, [studentId, termId]);
  useEffect(() => {
    if (!opened) return;
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpened(null); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [opened]);
  const act = async (fn: () => Promise<any>) => {
    setBusy(true); setError('');
    try { await fn(); setReturnReason(''); await load(); } catch (err: any) { setError(err.response?.data?.error?.message || err.response?.data?.message || 'Không lưu được.'); } finally { setBusy(false); }
  };
  const criteria = payload?.categories.flatMap(c => c.criteria) || [];
  const selected = criteria.find(c => c.id === opened);
  const total = payload?.categories.reduce((sum, cat) => sum + Math.min(cat.maxScore, cat.criteria.reduce((n, c) => n + (c.assessment?.officialScore ?? 0), 0)), 0) ?? 0;
  const count = criteria.filter(c => c.assessment?.status === 'FINALIZED').length;
  const evidence = criteria.flatMap(c => (c.assessment?.evidences || []).map(e => ({ ...e, criterion: c })));
  return <div className="space-y-4">
    <header className="space-y-2"><Link className="text-sm text-blue-700" to={(isAdmin ? '/admin' : '/officer/students') + '?termId=' + termId}>← Danh sách phiếu</Link><h1 className="text-xl font-bold">Phiếu rèn luyện · {student?.fullName}</h1><p className="text-sm text-slate-600">{student?.studentCode} · {payload?.term?.name || activeTerm.name} · {payload?.rubricVersion ? 'Bộ tiêu chí phiên bản ' + payload.rubricVersion.version : 'Chưa thiết lập bộ tiêu chí'}</p></header>
    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
    {payload?.handoff?.returnReason && <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Lý do trả kết quả: {payload.handoff.returnReason}</div>}
    {payload?.submission?.returnReason && <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Yêu cầu sinh viên sửa: {payload.submission.returnReason}</div>}
    {isReadOnly && <div className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">{payload?.term?.status === 'CLOSED' ? 'Kỳ đã chốt chính thức.' : isAdmin ? 'CTSV xem căn cứ và tiếp nhận kết quả; Khoa chịu trách nhiệm chấm điểm.' : payload?.handoff?.status === 'SENT' ? 'Kết quả đã gửi CTSV. Phiếu được khóa cho đến khi được trả lại hoặc mở phúc khảo.' : 'Sinh viên chưa nộp hoặc đang chỉnh sửa; phiếu chỉ được xem.'}</div>}
    {!isReadOnly && <div className="flex flex-wrap gap-2 rounded-xl border bg-white p-3"><input aria-label="Lý do trả phiếu" placeholder="Lý do cần sinh viên sửa/bổ sung" value={returnReason} onChange={e => setReturnReason(e.target.value)} className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm" /><button disabled={busy || !returnReason.trim()} onClick={() => void act(() => apiClient.returnSelfAssessment(studentId, termId, returnReason))} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">Trả sinh viên</button><button disabled={busy || count !== criteria.length || !count} onClick={() => void act(() => apiClient.sendFacultyResults(termId, [studentId]))} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Gửi CTSV</button></div>}
    <div className="flex flex-wrap gap-2 border-b">{[['sheet','Phiếu đánh giá'],['evidence','Minh chứng'],['history','Lịch sử']].map(([key,label]) => <button key={key} onClick={() => setParams(p => { const n = new URLSearchParams(p); n.set('tab',key); n.set('termId',termId); return n; })} className={'px-4 py-3 text-sm font-semibold ' + (tab === key ? 'border-b-2 border-blue-700 text-blue-700' : 'text-slate-500')}>{label}</button>)}</div>
    {loading ? <p className="p-6 text-sm text-slate-500">Đang tải phiếu…</p> : !payload?.rubricVersion ? <p className="rounded-xl border bg-white p-5 text-sm">Kỳ này chưa có bộ tiêu chí đã ban hành. Không tạo dữ liệu thay thế.</p> : tab === 'sheet' ? <div className="rounded-xl border bg-white p-2 sm:p-4"><table className="w-full table-fixed border-collapse text-left text-xs sm:text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-2 w-[35%]">Tiêu chí</th><th className="p-2 w-[8%]">Tối đa</th><th className="p-2 w-[10%]">SV tự đánh giá</th><th className="p-2 w-[11%]">Minh chứng</th><th className="p-2 w-[12%]">Đề xuất quy tắc</th><th className="p-2 w-[10%]">Cán bộ</th><th className="p-2">Trạng thái</th></tr></thead><tbody>{payload.categories.map(cat => <React.Fragment key={cat.key}><tr className="bg-amber-50 font-semibold"><td colSpan={2} className="break-words p-3">{cat.name}</td><td colSpan={5} className="p-3 text-right">{cat.criteria.filter(c => c.assessment?.status === 'FINALIZED').length}/{cat.criteria.length} mục hoàn tất · {Math.min(cat.maxScore, cat.criteria.reduce((n,c) => n + (c.assessment?.officialScore ?? 0),0))}/{cat.maxScore} điểm Khoa</td></tr>{cat.criteria.map(c => <tr key={c.id} id={'criterion-' + c.id} className="border-b align-top"><td className="break-words p-2"><button className="text-left font-semibold text-blue-700" onClick={() => setOpened(c.id)}>{c.code}. {c.name}</button><p className="mt-1 text-xs text-slate-500">Mở để xem căn cứ và xác minh</p></td><td className="p-2">{c.maxScore}</td><td className="p-2">{c.assessment?.selfScore ?? '—'}</td><td className="p-2"><button className="text-blue-700" onClick={() => setOpened(c.id)}>{c.assessment?.evidences?.length || 0} hồ sơ</button></td><td className="p-2">{c.assessment?.suggestedScore ?? 'Chờ xác minh'}</td><td className="p-2 font-semibold">{c.assessment?.officialScore ?? '—'}</td><td className="break-words p-2 text-xs">{c.assessment?.status === 'FINALIZED' ? 'Đã xác nhận' : c.assessment?.status === 'READY_FOR_REVIEW' ? 'Chờ xác nhận' : 'Thiếu căn cứ'}</td></tr>)}</React.Fragment>)}</tbody><tfoot><tr className="bg-slate-50 font-semibold"><td colSpan={5} className="p-3">Điểm Khoa đang chấm · {count}/{criteria.length} tiêu chí hoàn tất</td><td colSpan={2} className="p-3">{total}/100</td></tr></tfoot></table></div> : tab === 'evidence' ? <div className="space-y-2">{evidence.map(e => <Link key={e.id} className="block rounded-xl border bg-white p-4 text-sm text-blue-700" to={'/officer/review/' + e.id + '?termId=' + termId + '&studentId=' + studentId}>Mục {e.criterion.code} · {e.declaredActivityName || 'Minh chứng'} →</Link>)}{!evidence.length && <p className="p-5 text-sm text-slate-500">Chưa có minh chứng.</p>}</div> : <ol className="space-y-2">{history.map(h => <li key={h.id} className="rounded-xl border bg-white p-4 text-sm"><strong>{h.action}</strong><p className="text-xs text-slate-500">{h.user?.fullName} · {new Date(h.createdAt).toLocaleString('vi-VN')}</p>{h.newValue?.reason && <p className="mt-2">{h.newValue.reason}</p>}</li>)}{!history.length && <p className="p-5 text-sm text-slate-500">Chưa có lịch sử quyết định.</p>}</ol>}
    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3" onClick={() => setOpened(null)}><div role="dialog" aria-modal="true" aria-label={'Đánh giá mục ' + selected.code} className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-white p-4" onClick={e => e.stopPropagation()}><button autoFocus className="mb-3 rounded-lg border px-4 py-2 text-sm" onClick={() => setOpened(null)}>Đóng</button><CriterionCard key={selected.id} studentId={studentId} termId={termId} criterion={selected} assessment={selected.assessment || null} readOnly={isReadOnly} onSaved={load} /></div></div>}
  </div>;
};
