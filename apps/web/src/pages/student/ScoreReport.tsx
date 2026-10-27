import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiClient, API_BASE_URL } from '../../lib/apiClient';
import { Criterion, Evidence, RubricCategory, RubricPayload } from '../../types';
import { Check, FilePlus2, Printer, Save, Search, Trash2, X } from 'lucide-react';

interface CategoryView extends RubricCategory {
  confirmedScore: number | null;
  finalizedCount: number;
}

const evidenceStatusLabels: Record<string, string> = {
  DRAFT: 'Bản nháp', PROCESSING: 'Đang xử lý AI', VERIFIED: 'Đã xác minh', PLAUSIBLE: 'Đang đối chiếu',
  NEEDS_SUPPLEMENT: 'Cần bổ sung', NEEDS_HUMAN_REVIEW: 'Chờ cán bộ duyệt', INVALID: 'Không hợp lệ',
  APPROVED: 'Đã duyệt', REJECTED: 'Bị từ chối', APPEALING: 'Đang khiếu nại', WITHDRAWN: 'Đã rút',
};

export const ScoreReport: React.FC = () => {
  const { user, activeTerm } = useAuth();
  const [rubric, setRubric] = useState<RubricPayload | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [draftScores, setDraftScores] = useState<Record<string, string>>({});
  const [evidenceCriterion, setEvidenceCriterion] = useState<Criterion | null>(null);
  const [editingEvidence, setEditingEvidence] = useState<Evidence | null>(null);
  const [evidenceForm, setEvidenceForm] = useState({ declaredActivityName: '', description: '', declaredRole: 'PARTICIPANT', evidenceType: 'GIAY_XAC_NHAN', participationDate: new Date().toISOString().slice(0, 10) });
  const [evidenceFormFiles, setEvidenceFormFiles] = useState<File[]>([]);
  const [evidenceBusy, setEvidenceBusy] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [submittingAll, setSubmittingAll] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async (quiet = false) => {
    if (!user?.id || !activeTerm.id) return;
    if (!quiet) setLoading(true);
    setLoadError('');
    let loadingStep = 'rubric và điểm tự đánh giá';
    try {
      const rubricData = await apiClient.getMyAssessments(activeTerm.id);
      loadingStep = 'bảng điểm';
      const scoreData = await apiClient.getConductDashboard(activeTerm.id);
      const evidenceList: Evidence[] = [];
      for (let page = 1; ; page += 1) {
        loadingStep = 'danh sách minh chứng';
        const items = await apiClient.getEvidences({ studentId: user.id, termId: activeTerm.id, page, pageSize: 200 });
        evidenceList.push(...items);
        if (items.length < 200) break;
      }
      setRubric(rubricData);
      setSummary(scoreData);
      setEvidences(evidenceList);
      const criteria = rubricData.categories.flatMap((category) => category.criteria);
      const scores: Record<string, string> = {};
      criteria.forEach((criterion) => {
        if (criterion.assessment?.selfScore != null) scores[criterion.id] = String(criterion.assessment.selfScore);
      });
      setDraftScores(scores);
    } catch (error: any) {
      const status = error.response?.status;
      const backendMessage = error.response?.data?.message || error.response?.data?.error?.message;
      if (!error.response) {
        setLoadError(`Không kết nối được Backend khi tải ${loadingStep} tại ${API_BASE_URL}. Kiểm tra Backend có đang chạy và VITE_API_URL có đúng địa chỉ không. (${error.message || 'Lỗi mạng'})`);
      } else {
        setLoadError(`Không tải được ${loadingStep} từ Backend${status ? ` (HTTP ${status})` : ''}.${backendMessage ? ` ${backendMessage}` : ' Kiểm tra log Backend và migration cơ sở dữ liệu đã được áp dụng.'}`);
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [user?.id, activeTerm.id]);

  const categories: CategoryView[] = useMemo(() => (rubric?.categories || []).map((category) => ({
    ...category,
    finalizedCount: category.criteria.filter((criterion) => criterion.assessment?.status === 'FINALIZED').length,
    confirmedScore: category.criteria.some((criterion) => criterion.assessment?.status === 'FINALIZED')
      ? summary?.categories?.find((item: any) => item.key === category.key)?.score ?? null
      : null,
  })), [rubric, summary]);

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('vi');
    if (!query) return categories;
    return categories.map((category) => ({
      ...category,
      criteria: category.criteria.filter((criterion) =>
        criterion.code.toLocaleLowerCase('vi').includes(query) ||
        criterion.name.toLocaleLowerCase('vi').includes(query) ||
        criterion.description?.toLocaleLowerCase('vi').includes(query),
      ),
    })).filter((category) => category.criteria.length > 0);
  }, [categories, search]);

  const canWrite = Boolean(
    rubric?.rubricVersion && activeTerm.status === 'ACTIVE' &&
    rubric.submission?.status !== 'SUBMITTED' &&
    (!activeTerm.submissionDeadline || new Date() <= new Date(activeTerm.submissionDeadline)),
  );
  const officialScore = summary?.officialScore;

  const scoreValue = (criterion: Criterion) => {
    const raw = draftScores[criterion.id] ?? '';
    if (!raw.trim()) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 && value <= criterion.maxScore ? value : null;
  };
  const selfTotal = categories.reduce((total, category) => total + category.criteria.reduce((subtotal, criterion) => subtotal + (scoreValue(criterion) ?? 0), 0), 0);
  const selfEnteredCount = categories.flatMap((category) => category.criteria).filter((criterion) => scoreValue(criterion) !== null).length;

  const evidenceFor = (criterion: Criterion) => evidences.filter((evidence) =>
    evidence.criterionId === criterion.id || evidence.criterion?.id === criterion.id ||
    evidence.criterion?.code === criterion.code || evidence.reviews?.some((review) => review.criterionId === criterion.id),
  );

  const saveAllScores = async () => {
    if (!rubric?.categories) return;
    const scores = rubric.categories.flatMap((category) => category.criteria.map((criterion) => ({
      criterionId: criterion.id,
      score: (draftScores[criterion.id] ?? '').trim() === '' ? null : Number(draftScores[criterion.id]),
    })));
    for (const item of scores) {
      const criterion = rubric.categories.flatMap((category) => category.criteria).find((entry) => entry.id === item.criterionId)!;
      if (item.score !== null && (!Number.isFinite(item.score) || item.score < 0 || item.score > criterion.maxScore)) {
        setLoadError(`Điểm mục ${criterion.code} phải nằm trong khoảng 0–${criterion.maxScore}.`);
        return false;
      }
    }
    setSavingAll(true); setLoadError(''); setNotice('');
    try {
      const updated = await apiClient.saveSelfAssessments(activeTerm.id, scores);
      setRubric(updated);
      setNotice('Đã lưu toàn bộ điểm tự đánh giá. Đây chưa phải điểm chính thức.');
      return true;
    } catch (error: any) {
      const message = error.response?.data?.message || 'Không lưu được phiếu tự đánh giá.';
      setLoadError(Array.isArray(message) ? message.join(' ') : message);
      return false;
    } finally { setSavingAll(false); }
  };

  const submitAll = async () => {
    if (!await saveAllScores()) return;
    setSubmittingAll(true); setLoadError(''); setNotice('');
    try {
      const result = await apiClient.submitSelfAssessment(activeTerm.id);
      await load(true);
      setNotice(`Đã nộp phiếu và ${result.submittedEvidenceCount} minh chứng. Phiếu hiện đang chờ xử lý.`);
    } catch (error: any) {
      const message = error.response?.data?.message || 'Không nộp được phiếu.';
      setLoadError(Array.isArray(message) ? message.join(' ') : message);
    } finally { setSubmittingAll(false); }
  };

  const openEvidenceManager = (criterion: Criterion) => {
    setEvidenceCriterion(criterion);
    setEditingEvidence(null);
    setEvidenceForm({ declaredActivityName: '', description: '', declaredRole: 'PARTICIPANT', evidenceType: 'GIAY_XAC_NHAN', participationDate: new Date().toISOString().slice(0, 10) });
    setEvidenceFormFiles([]);
  };

  const editEvidence = (evidence: Evidence) => {
    setEditingEvidence(evidence);
    setEvidenceForm({
      declaredActivityName: evidence.declaredActivityName || '', description: evidence.description || '',
      declaredRole: evidence.declaredRole || 'PARTICIPANT', evidenceType: evidence.evidenceType || 'GIAY_XAC_NHAN',
      participationDate: evidence.participationDate ? new Date(evidence.participationDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    });
    setEvidenceFormFiles([]);
  };

  const fileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Không đọc được tệp.'));
    reader.onerror = () => reject(new Error(`Không đọc được tệp ${file.name}.`));
    reader.readAsDataURL(file);
  });

  const saveEvidenceDraft = async () => {
    if (!evidenceCriterion || !evidenceForm.declaredActivityName.trim()) { setLoadError('Vui lòng nhập tên hoạt động minh chứng.'); return; }
    if (evidenceFormFiles.some((file) => file.size > 8 * 1024 * 1024)) { setLoadError('Mỗi tệp minh chứng phải nhỏ hơn 8 MB.'); return; }
    setEvidenceBusy(true); setLoadError(''); setNotice('');
    const payload = {
      termId: activeTerm.id, criterionId: evidenceCriterion.id, criterionCode: evidenceCriterion.code,
      declaredActivityName: evidenceForm.declaredActivityName.trim(), description: evidenceForm.description.trim(),
      declaredRole: evidenceForm.declaredRole, evidenceType: evidenceForm.evidenceType,
      participationDate: evidenceForm.participationDate ? new Date(`${evidenceForm.participationDate}T00:00:00`).toISOString() : new Date().toISOString(),
      draft: true,
    };
    try {
      const record = editingEvidence ? await apiClient.updateEvidence(editingEvidence.id, payload) : await apiClient.createEvidence(payload);
      setEditingEvidence(record);
      for (const file of evidenceFormFiles) await apiClient.uploadEvidenceDraftFile(record.id, await fileAsDataUrl(file), file.name, file.type || 'application/octet-stream');
      setEditingEvidence(null); setEvidenceFormFiles([]);
      await load(true);
      setNotice('Đã lưu hồ sơ minh chứng nháp. Hồ sơ sẽ được gửi xử lý khi bạn nộp phiếu.');
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Không lưu được hồ sơ minh chứng.';
      setLoadError(Array.isArray(message) ? message.join(' ') : message);
    } finally { setEvidenceBusy(false); }
  };

  const removeEvidence = async (evidence: Evidence) => {
    if (!window.confirm(`Xóa hồ sơ “${evidence.declaredActivityName || 'Minh chứng'}”?`)) return;
    try { await apiClient.deleteEvidenceDraft(evidence.id); await load(true); setNotice('Đã xóa hồ sơ minh chứng.'); }
    catch (error: any) { setLoadError(error.response?.data?.message || 'Không xóa được hồ sơ minh chứng.'); }
  };

  const removeEvidenceFile = async (evidence: Evidence, fileId: string) => {
    try { await apiClient.deleteEvidenceDraftFile(evidence.id, fileId); await load(true); }
    catch (error: any) { setLoadError(error.response?.data?.message || 'Không xóa được tệp minh chứng.'); }
  };

  const writeLockMessage = !rubric?.rubricVersion
    ? 'Kỳ này chưa có rubric được ban hành.'
    : activeTerm.status === 'CLOSED'
      ? 'Kỳ đã chốt sổ; phiếu chỉ còn chế độ xem.'
      : activeTerm.status !== 'ACTIVE'
        ? 'Kỳ chưa mở nhận đánh giá.'
        : 'Đã hết hạn nộp đánh giá và minh chứng.';

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{activeTerm.name}</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Phiếu đánh giá rèn luyện</h1>
          <p className="mt-1 text-sm text-slate-600">Tự đánh giá theo từng tiêu chí và nộp minh chứng để cán bộ xác minh, chốt điểm.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={!canWrite || savingAll || submittingAll} onClick={() => void saveAllScores()} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3.5 py-2 text-sm font-semibold text-blue-800 disabled:opacity-50"><Save className="h-4 w-4" />{savingAll ? 'Đang lưu…' : 'Lưu'}</button>
          <button type="button" disabled={!canWrite || savingAll || submittingAll} onClick={() => void submitAll()} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"><Check className="h-4 w-4" />{submittingAll ? 'Đang nộp…' : 'Nộp phiếu'}</button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700"><Printer className="h-4 w-4" /> In phiếu</button>
        </div>
      </header>

      {loadError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{loadError}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}
      {!canWrite && !loading && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{rubric?.submission?.status === 'SUBMITTED' ? `Phiếu đã nộp ngày ${rubric.submission.submittedAt ? new Date(rubric.submission.submittedAt).toLocaleString('vi-VN') : ''} và đang chờ cán bộ xử lý.` : writeLockMessage}</div>}
      {rubric?.submission?.status === 'RETURNED' && <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900"><strong>Cán bộ yêu cầu chỉnh sửa:</strong> {rubric.submission.returnReason || 'Vui lòng rà soát lại phiếu.'}</div>}

      <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div><span className="block text-xs text-slate-500">Sinh viên</span><strong className="text-sm text-slate-900">{user?.fullName || '—'}</strong></div>
        <div><span className="block text-xs text-slate-500">MSSV</span><strong className="text-sm text-slate-900">{user?.studentCode || '—'}</strong></div>
        <div><span className="block text-xs text-slate-500">Tự đánh giá tạm tính</span><strong className="text-sm text-slate-900">{selfTotal} / 100 · {selfEnteredCount}/{categories.reduce((sum, category) => sum + category.criteria.length, 0)} mục đã nhập</strong></div>
        <div><span className="block text-xs text-slate-500">Điểm chính thức</span><strong className="text-sm text-slate-900">{officialScore == null ? 'Chưa có' : `${officialScore} / 100 · ${summary?.classification || 'Đã chốt'}`}</strong></div>
      </section>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Đang tải phiếu và minh chứng từ Backend…</div>
      ) : !rubric?.rubricVersion ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Kỳ này chưa có bộ tiêu chí được ban hành. Khi quản trị viên thiết lập rubric, phiếu 5 khung sẽ hiển thị tại đây.</div>
      ) : categories.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Backend chưa trả về tiêu chí cho rubric của kỳ này.</div>
      ) : (
        <>
          <label className="relative block max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo mã, tên hoặc nội dung tiêu chí" className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm" />
          </label>

          <div className="w-full overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
            <table className="w-full table-fixed border-collapse text-left text-xs sm:text-sm">
              <colgroup><col className="w-[4%]" /><col className="w-[33%]" /><col className="w-[7%]" /><col className="w-[11%]" /><col className="w-[18%]" /><col className="w-[13%]" /><col className="w-[14%]" /></colgroup>
              <thead className="bg-slate-100 font-bold text-slate-700">
                <tr><th rowSpan={2} className="border border-slate-300 px-1 py-3 text-center">STT</th><th rowSpan={2} className="border border-slate-300 px-2 py-3">Nội dung tiêu chí chấm điểm rèn luyện</th><th rowSpan={2} className="border border-slate-300 px-1 py-3 text-center">Điểm tối đa</th><th rowSpan={2} className="border border-slate-300 px-1 py-3 text-center">Sinh viên tự đánh giá</th><th rowSpan={2} className="border border-slate-300 px-2 py-3">Minh chứng</th><th className="border border-slate-300 px-1 py-2 text-center">AI</th><th className="border border-slate-300 px-1 py-2 text-center">Cán bộ đánh giá</th></tr>
                <tr><th className="border border-slate-300 px-1 py-1 text-center text-[10px] font-medium">Phân tích hồ sơ</th><th className="border border-slate-300 px-1 py-1 text-center text-[10px] font-medium">Xác minh, chốt điểm</th></tr>
              </thead>
              <tbody>
                {filteredCategories.map((category, index) => <React.Fragment key={category.key}>
                  <tr className="bg-[#f0f0c9] font-bold text-slate-900"><td className="border border-slate-300 px-1 py-2 text-center">{['I', 'II', 'III', 'IV', 'V'][Math.max(0, (category.position || index + 1) - 1)] || category.position || index + 1}</td><td className="border border-slate-300 px-2 py-2">{category.name}</td><td className="border border-slate-300 px-1 py-2 text-center">{category.maxScore}</td><td className="border border-slate-300 px-1 py-2 text-center">{category.criteria.reduce((sum, criterion) => sum + (scoreValue(criterion) ?? 0), 0)} / {category.maxScore}</td><td className="border border-slate-300 px-2 py-2 text-center text-[10px] font-medium">{category.criteria.reduce((count, criterion) => count + evidenceFor(criterion).length, 0)} minh chứng</td><td className="border border-slate-300 px-1 py-2 text-center text-[10px]">Kết quả theo hồ sơ</td><td className="border border-slate-300 px-1 py-2 text-center text-[10px]">Điểm chính thức: {category.confirmedScore == null ? '—' : `${category.confirmedScore}/${category.maxScore}`}</td></tr>
                  {category.criteria.map((criterion) => {
                    const criterionEvidences = evidenceFor(criterion);
                    const assessment = criterion.assessment;
                    return <tr key={criterion.id} className="align-top hover:bg-slate-50">
                      <td className="border border-slate-300 px-1 py-2 text-center font-semibold">{criterion.code}</td>
                      <td className="border border-slate-300 px-2 py-2"><strong className="font-semibold text-slate-900">{criterion.name}</strong>{criterion.description && <p className="mt-1 whitespace-pre-line break-words text-[10px] leading-4 text-slate-600 sm:text-xs">{criterion.description}</p>}</td>
                      <td className="border border-slate-300 px-1 py-2 text-center font-semibold">{criterion.maxScore}</td>
                      <td className="border border-slate-300 px-1 py-2 text-center"><input aria-label={`Điểm tự đánh giá tiêu chí ${criterion.code}`} type="number" min="0" max={criterion.maxScore} step="0.5" value={draftScores[criterion.id] ?? ''} disabled={!canWrite} onChange={(event) => setDraftScores((current) => ({ ...current, [criterion.id]: event.target.value }))} className="w-full min-w-0 rounded border border-slate-300 px-1 py-1.5 text-center font-semibold disabled:bg-slate-100" />{(draftScores[criterion.id] ?? '').trim() !== '' && scoreValue(criterion) === null && <span className="mt-1 block text-[9px] text-rose-600">Vượt điểm tối đa</span>}</td>
                      <td className="border border-slate-300 px-1.5 py-2"><button type="button" disabled={!canWrite} onClick={() => openEvidenceManager(criterion)} className="inline-flex w-full items-center justify-center gap-1 rounded border border-blue-200 bg-blue-50 px-1 py-2 text-[10px] font-semibold text-blue-800 disabled:opacity-50"><FilePlus2 className="h-3.5 w-3.5" />Minh chứng ({criterionEvidences.length})</button>{criterionEvidences.map((evidence) => <div key={evidence.id} className="mt-1 break-words text-[9px] leading-3 text-slate-600"><strong>{evidence.declaredActivityName || 'Hồ sơ'}</strong><br />{evidenceStatusLabels[evidence.status] || evidence.status}</div>)}</td>
                      <td className="border border-slate-300 px-1.5 py-2 text-[10px] leading-4">{criterionEvidences.length ? criterionEvidences.map((evidence) => { const suggestion = evidence.aiSuggestions?.find((item) => item.criterionId === criterion.id || item.criterion?.id === criterion.id) || evidence.aiSuggestions?.[0]; const job = evidence.aiProcessingJobs?.[0]; return <div key={evidence.id} className="mb-2 break-words border-b border-slate-100 pb-1 last:border-0"><strong className="text-violet-800">{suggestion ? `Đề xuất ${suggestion.suggestedScore ?? '—'}đ` : job?.status === 'PROCESSING' || job?.status === 'QUEUED' ? 'Đang phân tích' : job?.status === 'UNAVAILABLE' || job?.status === 'FAILED' ? 'AI chưa khả dụng · cán bộ sẽ xử lý' : evidence.status === 'PROCESSING' ? 'Đang phân tích' : 'Chưa có kết quả AI'}</strong>{suggestion?.reasoning && <p className="mt-1 line-clamp-3 text-slate-600">{suggestion.reasoning}</p>}</div>; }) : <span className="text-slate-400">Chưa có minh chứng</span>}</td>
                      <td className="border border-slate-300 px-1.5 py-2 text-[10px] leading-4">{assessment?.officialScore != null ? <><strong className="text-emerald-700">{assessment.officialScore}/{criterion.maxScore} điểm</strong>{assessment.officialReason && <p className="mt-1 break-words text-slate-600">{assessment.officialReason}</p>}</> : <><strong className="text-slate-700">{assessment?.status === 'READY_FOR_REVIEW' ? 'Chờ chốt điểm' : assessment?.status === 'NEEDS_VERIFICATION' || criterionEvidences.length ? 'Chờ xác minh' : 'Chưa đánh giá'}</strong>{assessment?.suggestedScore != null && <p className="mt-1 text-amber-800">Theo quy chế: {assessment.suggestedScore}đ</p>}</>}</td>
                    </tr>;
                  })}
                </React.Fragment>)}
                <tr className="bg-blue-50 font-bold text-slate-900"><td colSpan={2} className="border border-slate-300 px-2 py-3">Tổng điểm tự đánh giá tạm tính</td><td className="border border-slate-300 px-1 py-3 text-center">100</td><td className="border border-slate-300 px-1 py-3 text-center text-base">{selfTotal} / 100<div className="text-[9px] font-normal">{selfEnteredCount} mục đã nhập</div></td><td colSpan={3} className="border border-slate-300 px-2 py-3 text-xs font-medium">Đây là điểm tự đánh giá, chưa phải kết quả chính thức.</td></tr>
              </tbody>
            </table>
          </div>
          {evidenceCriterion && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="evidence-modal-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setEvidenceCriterion(null); }}>
            <section className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
              <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-4 sm:p-5"><div><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Tiêu chí {evidenceCriterion.code} · tối đa {evidenceCriterion.maxScore} điểm</p><h2 id="evidence-modal-title" className="mt-1 text-lg font-bold text-slate-900">Quản lý minh chứng</h2><p className="mt-1 text-sm text-slate-600">{evidenceCriterion.name}</p></div><button type="button" aria-label="Đóng popup" onClick={() => { setEvidenceCriterion(null); setEditingEvidence(null); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></header>
              <div className="space-y-5 p-4 sm:p-5">
                <div className="space-y-2"><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-bold text-slate-800">Danh sách minh chứng ({evidenceFor(evidenceCriterion).length})</h3><button type="button" disabled={!canWrite} onClick={() => { setEditingEvidence(null); setEvidenceForm({ declaredActivityName: '', description: '', declaredRole: 'PARTICIPANT', evidenceType: 'GIAY_XAC_NHAN', participationDate: new Date().toISOString().slice(0, 10) }); setEvidenceFormFiles([]); }} className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><FilePlus2 className="h-4 w-4" />Thêm minh chứng</button></div>
                  {evidenceFor(evidenceCriterion).length ? evidenceFor(evidenceCriterion).map((evidence, index) => <article key={evidence.id} className="rounded-xl border border-slate-200 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><h4 className="font-semibold text-slate-900">Minh chứng {index + 1}: {evidence.declaredActivityName || 'Chưa đặt tên'}</h4><p className="mt-1 text-xs text-slate-500">{evidenceStatusLabels[evidence.status] || evidence.status} · {evidence.evidenceType} · {evidence.participationDate ? new Date(evidence.participationDate).toLocaleDateString('vi-VN') : 'Chưa có ngày'}</p>{evidence.description && <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{evidence.description}</p>}</div><div className="flex gap-1"><button type="button" disabled={!canWrite || evidence.status === 'APPROVED'} onClick={() => editEvidence(evidence)} className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40">Sửa</button><button type="button" disabled={!canWrite || evidence.status === 'APPROVED'} onClick={() => void removeEvidence(evidence)} className="rounded-md border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /></button></div></div>
                    {evidence.files?.length > 0 && <ul className="mt-2 space-y-1">{evidence.files.map((file) => <li key={file.id} className="flex min-w-0 items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs"><a href={file.fileUrl} target="_blank" rel="noreferrer" className="min-w-0 truncate text-blue-700 hover:underline">{file.fileName || 'Tệp minh chứng'}</a><span className="shrink-0 text-slate-500">{file.fileSize ? `${(file.fileSize / 1024 / 1024).toFixed(1)} MB` : file.fileType}</span>{canWrite && evidence.status !== 'APPROVED' && <button type="button" onClick={() => void removeEvidenceFile(evidence, file.id)} className="shrink-0 text-rose-700" aria-label="Xóa tệp"><X className="h-4 w-4" /></button>}</li>)}</ul>}
                  </article>) : <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Chưa có minh chứng cho tiêu chí này.</p>}
                </div>
                {canWrite && <form className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-3 sm:p-4" onSubmit={(event) => { event.preventDefault(); void saveEvidenceDraft(); }}>
                  <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-slate-900">{editingEvidence ? 'Chỉnh sửa hồ sơ' : 'Thêm hồ sơ minh chứng'}</h3>{editingEvidence && <button type="button" onClick={() => { setEditingEvidence(null); setEvidenceFormFiles([]); }} className="text-xs font-semibold text-slate-600">Hủy sửa</button>}</div>
                  <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-700">Tên hoạt động / thành tích<input required value={evidenceForm.declaredActivityName} onChange={(event) => setEvidenceForm((current) => ({ ...current, declaredActivityName: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" placeholder="Ví dụ: Ngày Chủ nhật xanh" /></label><label className="text-xs font-semibold text-slate-700">Ngày tham gia<input type="date" value={evidenceForm.participationDate} onChange={(event) => setEvidenceForm((current) => ({ ...current, participationDate: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" /></label><label className="text-xs font-semibold text-slate-700">Vai trò<select value={evidenceForm.declaredRole} onChange={(event) => setEvidenceForm((current) => ({ ...current, declaredRole: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="PARTICIPANT">Người tham gia</option><option value="ORGANIZER">Ban tổ chức / tình nguyện viên</option><option value="CHEERLEADER">Cổ vũ</option></select></label><label className="text-xs font-semibold text-slate-700">Loại minh chứng<select value={evidenceForm.evidenceType} onChange={(event) => setEvidenceForm((current) => ({ ...current, evidenceType: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="GIAY_CHUNG_NHAN">Giấy chứng nhận / bằng khen</option><option value="GIAY_XAC_NHAN">Giấy xác nhận có đóng dấu</option><option value="VE_CHECKIN">Vé điện tử / check-in QR</option><option value="DANH_SACH">Danh sách kết quả</option></select></label></div>
                  <label className="block text-xs font-semibold text-slate-700">Mô tả / căn cứ<textarea rows={3} value={evidenceForm.description} onChange={(event) => setEvidenceForm((current) => ({ ...current, description: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" placeholder="Mô tả nội dung, đơn vị xác nhận hoặc thông tin cần đối chiếu" /></label>
                  <label className="block text-xs font-semibold text-slate-700">Tệp minh chứng (có thể chọn nhiều tệp)<input type="file" multiple accept="image/*,application/pdf" onChange={(event) => setEvidenceFormFiles(Array.from(event.target.files || []))} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-xs file:mr-2 file:rounded file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-semibold file:text-blue-700" /><span className="mt-1 block font-normal text-slate-500">Ảnh/PDF, tối đa 8 MB mỗi tệp; lưu nháp đến khi nộp phiếu.</span></label>
                  {evidenceFormFiles.length > 0 && <p className="text-xs text-blue-800">Tệp mới: {evidenceFormFiles.map((file) => file.name).join(', ')}</p>}
                  <button type="submit" disabled={evidenceBusy} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{evidenceBusy ? 'Đang lưu…' : 'Lưu hồ sơ nháp'}</button>
                </form>}
                <p className="text-xs leading-5 text-slate-500">Hồ sơ nháp được lưu thật vào hệ thống. Khi bấm Nộp phiếu, các hồ sơ có tệp sẽ chuyển sang xử lý AI và hàng đợi cán bộ.</p>
              </div>
            </section>
          </div>}
          {!filteredCategories.length && <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">Không tìm thấy tiêu chí phù hợp.</div>}
        </>
      )}
    </div>
  );
};
