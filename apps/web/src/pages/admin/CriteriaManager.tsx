import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiClient } from '../../lib/apiClient';
import { RubricDefinition, RubricTemplate, RubricTemplateVersionSummary, Term } from '../../types';

type TermWithVersions = Term & { rubricVersions?: RubricTemplateVersionSummary[] };
type TermRubricPayload = { term: Term; rubricVersion: any; definition: RubricDefinition | null };

const statusLabel: Record<string, string> = { DRAFT: 'Nháp', PUBLISHED: 'Đã ban hành', ARCHIVED: 'Đã lưu trữ' };
const termStatusLabel: Record<string, string> = { UPCOMING: 'Sắp diễn ra', ACTIVE: 'Đang mở', REVIEWING: 'Đang chấm duyệt', CLOSED: 'Đã chốt sổ' };

const formatRubricSource = (source?: string) => {
  if (!source) return 'Nguồn chưa ghi nhận';
  if (source.startsWith('DUT_DEFAULT')) return `Sao chép từ bộ chuẩn ${source.replace('DUT_DEFAULT ', '')}`;
  if (source.startsWith('Kế thừa kỳ')) return source;
  return source;
};

const RubricEditor: React.FC<{ definition: RubricDefinition; onSave: (definition: RubricDefinition, changeNote?: string) => Promise<unknown>; disabled?: boolean; showChangeNote?: boolean }> = ({ definition: initialDefinition, onSave, disabled = false, showChangeNote = false }) => {
  const [definition, setDefinition] = useState(initialDefinition);
  const [configTexts, setConfigTexts] = useState<Record<string, string>>({});
  const [changeNote, setChangeNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setDefinition(initialDefinition);
  }, [initialDefinition]);

  useEffect(() => {
    const next: Record<string, string> = {};
    definition.categories.forEach((category, categoryIndex) => category.criteria.forEach((criterion, criterionIndex) => {
      next[`${categoryIndex}-${criterionIndex}`] = JSON.stringify(criterion.scoringConfig, null, 2);
    }));
    setConfigTexts(next);
  }, [definition]);

  const total = useMemo(() => definition.categories.reduce((sum, category) => sum + Number(category.maxScore || 0), 0), [definition]);
  const changeCategory = (index: number, key: string, value: string | number) => setDefinition((current) => ({ ...current, categories: current.categories.map((category, i) => i === index ? { ...category, [key]: value } : category) }));
  const changeCriterion = (categoryIndex: number, criterionIndex: number, key: string, value: string | number) => setDefinition((current) => ({ ...current, categories: current.categories.map((category, ci) => ci === categoryIndex ? { ...category, criteria: category.criteria.map((criterion, i) => i === criterionIndex ? { ...criterion, [key]: value } : criterion) } : category) }));
  const removeCriterion = (categoryIndex: number, criterionIndex: number) => setDefinition((current) => ({ ...current, categories: current.categories.map((category, ci) => ci === categoryIndex ? { ...category, criteria: category.criteria.filter((_, i) => i !== criterionIndex) } : category) }));
  const addCriterion = (categoryIndex: number) => setDefinition((current) => ({ ...current, categories: current.categories.map((category, ci) => ci === categoryIndex ? { ...category, criteria: [...category.criteria, { code: `M${category.criteria.length + 1}`, name: '', description: '', maxScore: 0, scoringConfig: { kind: 'manual_verified', requiredData: ['officialScore'] } }] } : category) }));
  const removeCategory = (categoryIndex: number) => setDefinition((current) => ({ ...current, categories: current.categories.filter((_, i) => i !== categoryIndex) }));
  const addCategory = () => setDefinition((current) => ({ ...current, categories: [...current.categories, { code: `KHUNG_${current.categories.length + 1}`, name: '', maxScore: 0, position: current.categories.length + 1, criteria: [] }] }));

  const save = async () => {
    setSaving(true); setError(''); setNotice('');
    try {
      const parsed = { ...definition, categories: definition.categories.map((category, ci) => ({ ...category, criteria: category.criteria.map((criterion, ki) => ({ ...criterion, scoringConfig: JSON.parse(configTexts[`${ci}-${ki}`] || '{}') })) })) };
      await onSave(parsed, changeNote);
      setDefinition(parsed);
      setNotice('Đã lưu bản nháp. Các thay đổi chưa áp dụng cho kỳ cho đến khi ban hành.');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Không lưu được. Kiểm tra cấu hình quy tắc JSON.');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className={`rounded-lg border p-3 text-sm ${Math.abs(total - 100) < 0.001 ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
        Tổng điểm các khung: <strong>{total}</strong> / 100. Mỗi khung phải có tổng điểm tiêu chí bằng điểm tối đa của khung.
      </div>
      {definition.categories.map((category, ci) => {
        const categorySum = category.criteria.reduce((sum, criterion) => sum + Number(criterion.maxScore || 0), 0);
        return <section key={`${ci}-${category.code}`} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="grid gap-2 border-b bg-slate-50 p-3 sm:grid-cols-[1fr_2fr_120px_auto] sm:items-end">
            <label className="text-xs font-semibold text-slate-600">Mã khung<input disabled={disabled} value={category.code} onChange={(event) => changeCategory(ci, 'code', event.target.value)} className="mt-1 w-full rounded border px-2 py-1.5" /></label>
            <label className="text-xs font-semibold text-slate-600">Tên khung<input disabled={disabled} value={category.name} onChange={(event) => changeCategory(ci, 'name', event.target.value)} className="mt-1 w-full rounded border px-2 py-1.5" /></label>
            <label className="text-xs font-semibold text-slate-600">Điểm tối đa<input disabled={disabled} type="number" min="0" step="0.5" value={category.maxScore} onChange={(event) => changeCategory(ci, 'maxScore', Number(event.target.value))} className="mt-1 w-full rounded border px-2 py-1.5" /></label>
            {!disabled && <button onClick={() => removeCategory(ci)} className="rounded border border-rose-200 px-2 py-1.5 text-xs text-rose-700">Xóa khung</button>}
            <p className={`text-xs sm:col-span-4 ${Math.abs(categorySum - category.maxScore) < 0.001 ? 'text-emerald-700' : 'text-amber-700'}`}>Điểm tiêu chí trong khung: {categorySum} / {category.maxScore}</p>
          </div>
          <div className="divide-y divide-slate-100">
            {category.criteria.map((criterion, ki) => <article key={`${ci}-${ki}-${criterion.code}`} className="grid gap-3 p-3 lg:grid-cols-[70px_1fr_120px_auto]">
              <label className="text-xs font-semibold text-slate-600">Mã<input disabled={disabled} value={criterion.code} onChange={(event) => changeCriterion(ci, ki, 'code', event.target.value)} className="mt-1 w-full rounded border px-2 py-1.5" /></label>
              <label className="text-xs font-semibold text-slate-600">Tên tiêu chí<input disabled={disabled} value={criterion.name} onChange={(event) => changeCriterion(ci, ki, 'name', event.target.value)} className="mt-1 w-full rounded border px-2 py-1.5" /></label>
              <label className="text-xs font-semibold text-slate-600">Điểm tối đa<input disabled={disabled} type="number" min="0" step="0.5" value={criterion.maxScore} onChange={(event) => changeCriterion(ci, ki, 'maxScore', Number(event.target.value))} className="mt-1 w-full rounded border px-2 py-1.5" /></label>
              {!disabled && <button onClick={() => removeCriterion(ci, ki)} className="self-end rounded border border-rose-200 px-2 py-1.5 text-xs text-rose-700">Xóa mục</button>}
              <label className="text-xs font-semibold text-slate-600 lg:col-span-4">Mô tả và điều kiện<textarea disabled={disabled} rows={2} value={criterion.description} onChange={(event) => changeCriterion(ci, ki, 'description', event.target.value)} className="mt-1 w-full rounded border px-2 py-1.5" /></label>
              <details className="rounded-lg border border-slate-200 bg-slate-50 p-3 lg:col-span-4">
                <summary className="cursor-pointer text-xs font-semibold text-slate-600">Cấu hình tính điểm nâng cao</summary>
                <p className="mt-2 text-xs text-slate-500">Chỉ chỉnh phần này khi cần thay đổi cách Backend tính điểm. Nội dung phải là JSON hợp lệ và dùng loại quy tắc Backend hỗ trợ.</p>
                <label className="mt-2 block text-xs font-medium text-slate-600">Cấu hình kỹ thuật<textarea disabled={disabled} rows={5} spellCheck={false} value={configTexts[`${ci}-${ki}`] ?? JSON.stringify(criterion.scoringConfig, null, 2)} onChange={(event) => setConfigTexts((current) => ({ ...current, [`${ci}-${ki}`]: event.target.value }))} className="mt-1 w-full rounded border bg-white px-2 py-1.5 font-mono text-[11px]" /></label>
              </details>
            </article>)}
          </div>
          {!disabled && <div className="border-t bg-slate-50 p-2"><button onClick={() => addCriterion(ci)} className="text-xs font-semibold text-blue-700">+ Thêm tiêu chí vào khung</button></div>}
        </section>;
      })}
      {!disabled && <div className="flex flex-wrap items-end justify-between gap-3">
        <button onClick={addCategory} className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700">+ Thêm khung</button>
        <div className="flex flex-wrap items-end gap-2">
          {showChangeNote && <label className="text-xs font-medium text-slate-600">Ghi chú phiên bản<input value={changeNote} onChange={(event) => setChangeNote(event.target.value)} className="mt-1 block rounded border px-2 py-2" placeholder="Ví dụ: cập nhật theo quy chế mới" /></label>}
          <button disabled={saving} onClick={save} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Đang lưu…' : 'Lưu bản nháp'}</button>
        </div>
      </div>}
      {error && <p role="alert" className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {notice && <p role="status" className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    </div>
  );
};

export const CriteriaManager: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<'DEFAULT' | 'TERM'>('DEFAULT');
  const [templates, setTemplates] = useState<RubricTemplate[]>([]);
  const [terms, setTerms] = useState<TermWithVersions[]>([]);
  const [selectedTemplateVersionId, setSelectedTemplateVersionId] = useState('');
  const [selectedTermId, setSelectedTermId] = useState('');
  const [termDraftSourceType, setTermDraftSourceType] = useState<'DEFAULT' | 'TERM'>('DEFAULT');
  const [termDraftSourceId, setTermDraftSourceId] = useState('');
  const [templateDefinition, setTemplateDefinition] = useState<RubricDefinition | null>(null);
  const [termRubric, setTermRubric] = useState<TermRubricPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const reloadLists = async () => {
    const [templateList, termList] = await Promise.all([apiClient.getRubricTemplates(), apiClient.getTerms()]);
    setTemplates(templateList); setTerms(termList as TermWithVersions[]);
    const template = templateList[0];
    const selectedVersion = template?.versions.find((version) => version.status === 'DRAFT') || template?.versions.find((version) => version.status === 'PUBLISHED');
    if (selectedVersion) setSelectedTemplateVersionId(selectedVersion.id);
    const requestedTermId = searchParams.get('termId');
    const requestedTerm = (termList as TermWithVersions[]).find((term) => term.id === requestedTermId);
    const termWithDraft = (termList as TermWithVersions[]).find((term) => term.rubricVersions?.some((version) => version.status === 'DRAFT'));
    setSelectedTermId(requestedTerm?.id || termWithDraft?.id || termList[0]?.id || '');
    if (requestedTerm) setTab('TERM');
  };

  useEffect(() => {
    reloadLists().catch(() => setError('Không tải được bộ chuẩn/kỳ đánh giá từ Backend.')).finally(() => setLoading(false));
  }, [searchParams]);

  useEffect(() => {
    if (!selectedTemplateVersionId) { setTemplateDefinition(null); return; }
    apiClient.getRubricTemplateVersion(selectedTemplateVersionId).then((result: any) => setTemplateDefinition(result.definition as RubricDefinition)).catch(() => setError('Không tải được nội dung phiên bản bộ chuẩn.'));
  }, [selectedTemplateVersionId]);

  useEffect(() => {
    if (!selectedTermId) { setTermRubric(null); return; }
    apiClient.getTermRubric(selectedTermId).then(setTermRubric).catch(() => setError('Không tải được rubric của kỳ.'));
  }, [selectedTermId]);

  const selectedTemplateVersion = templates.flatMap((template) => template.versions).find((version) => version.id === selectedTemplateVersionId);
  const selectedTerm = terms.find((term) => term.id === selectedTermId);
  const run = async (fn: () => Promise<any>, success: string) => {
    setBusy(true); setError(''); setNotice('');
    try { const result = await fn(); await reloadLists(); if (tab === 'TERM' && selectedTermId) setTermRubric(await apiClient.getTermRubric(selectedTermId)); setNotice(success); return result; }
    catch (err: any) { setError(err.response?.data?.message || err.message || 'Không thực hiện được thao tác.'); }
    finally { setBusy(false); }
  };

  const createTemplateDraft = async () => {
    const created = await run(() => apiClient.createRubricTemplateDraft(), 'Đã tạo bản nháp mới từ bộ chuẩn đang ban hành.');
    if (created?.id) setSelectedTemplateVersionId(created.id);
  };
  const publishTemplate = () => selectedTemplateVersionId && window.confirm('Ban hành bản chuẩn này? Bộ chuẩn đang ban hành sẽ được lưu trữ; các kỳ đã tạo không đổi.') && void run(() => apiClient.publishRubricTemplateDraft(selectedTemplateVersionId), 'Đã ban hành phiên bản bộ chuẩn.');
  const publishTerm = () => selectedTermId && window.confirm('Ban hành bộ tiêu chí cho kỳ này? Sau khi ban hành, phiên bản sẽ chỉ đọc.') && void run(() => apiClient.publishTermRubric(selectedTermId), 'Đã ban hành bộ tiêu chí của kỳ.');
  const createTermDraft = () => selectedTermId && void run(() => apiClient.createTermRubricDraft(selectedTermId, { type: termDraftSourceType, sourceTermId: termDraftSourceType === 'TERM' ? termDraftSourceId : undefined }), 'Đã tạo bản nháp rubric cho kỳ.');

  return <div className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-xl font-bold text-slate-900">Bộ tiêu chí đánh giá</h1><p className="mt-1 text-sm text-slate-600">Bộ chuẩn là mẫu; mỗi kỳ dùng một bản sao độc lập. Sửa mẫu không làm đổi lịch sử các kỳ.</p></div>
      <Link to="/admin/terms" className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Quản lý kỳ đánh giá</Link>
    </header>

    <div className="flex gap-2 border-b border-slate-200">
      <button onClick={() => setTab('DEFAULT')} className={`px-4 py-2 text-sm font-semibold ${tab === 'DEFAULT' ? 'border-b-2 border-blue-700 text-blue-800' : 'text-slate-500'}`}>Bộ chuẩn</button>
      <button onClick={() => setTab('TERM')} className={`px-4 py-2 text-sm font-semibold ${tab === 'TERM' ? 'border-b-2 border-blue-700 text-blue-800' : 'text-slate-500'}`}>Theo kỳ</button>
    </div>
    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
    {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}
    {loading ? <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">Đang tải cấu hình…</div> : tab === 'DEFAULT' ? <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4">
        <label className="text-sm font-semibold text-slate-700">Phiên bản bộ chuẩn<select value={selectedTemplateVersionId} onChange={(event) => setSelectedTemplateVersionId(event.target.value)} className="mt-1 block min-w-64 rounded-lg border border-slate-300 bg-white px-3 py-2">
          {templates.flatMap((template) => template.versions.map((version) => <option key={version.id} value={version.id}>{template.name} · v{version.version} · {statusLabel[version.status]}</option>))}
        </select></label>
        <div className="flex gap-2">
          {selectedTemplateVersion?.status === 'PUBLISHED' && <button disabled={busy || templates[0]?.versions.some((version) => version.status === 'DRAFT')} onClick={createTemplateDraft} className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50">Tạo bản nháp từ bản chuẩn</button>}
          {selectedTemplateVersion?.status === 'DRAFT' && <button disabled={busy} onClick={publishTemplate} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Ban hành bộ chuẩn</button>}
        </div>
      </div>
      {selectedTemplateVersion && <div className="rounded-lg border bg-white px-4 py-3 text-sm text-slate-700">Trạng thái: <strong>{statusLabel[selectedTemplateVersion.status]}</strong>{selectedTemplateVersion.sourceDescription && <> · {selectedTemplateVersion.sourceDescription}</>}{selectedTemplateVersion.changeNote && <> · Ghi chú: {selectedTemplateVersion.changeNote}</>}</div>}
      {templateDefinition && selectedTemplateVersion && <RubricEditor key={selectedTemplateVersion.id} definition={templateDefinition} disabled={selectedTemplateVersion.status !== 'DRAFT'} showChangeNote onSave={(definition, changeNote) => apiClient.saveRubricTemplateDraft(selectedTemplateVersion.id, definition, changeNote || '')} />}
    </> : <>
      <label className="block max-w-xl text-sm font-semibold text-slate-700">Kỳ đánh giá<select value={selectedTermId} onChange={(event) => setSelectedTermId(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
        {terms.map((term) => <option key={term.id} value={term.id}>{term.name} · {termStatusLabel[term.status] || term.status}</option>)}
      </select></label>
      {!terms.length ? <div className="rounded-xl border bg-white p-6 text-sm text-slate-600">Chưa có kỳ. Tạo kỳ mới để sao chép bộ chuẩn.</div> : !termRubric?.rubricVersion ? <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"><p>Kỳ {selectedTerm?.name} chưa có phiên bản tiêu chí.</p>{selectedTerm?.status !== 'CLOSED' && <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs font-semibold">Nguồn<select value={termDraftSourceType} onChange={(event) => setTermDraftSourceType(event.target.value as 'DEFAULT' | 'TERM')} className="mt-1 block rounded-lg border border-amber-300 bg-white px-3 py-2"><option value="DEFAULT">Bộ chuẩn hiện tại</option><option value="TERM">Kỳ đã ban hành</option></select></label>
        {termDraftSourceType === 'TERM' && <label className="text-xs font-semibold">Kỳ nguồn<select value={termDraftSourceId} onChange={(event) => setTermDraftSourceId(event.target.value)} className="mt-1 block min-w-56 rounded-lg border border-amber-300 bg-white px-3 py-2"><option value="">Chọn kỳ</option>{terms.filter((term) => term.id !== selectedTermId && term.rubricVersions?.some((version) => version.status === 'PUBLISHED')).map((term) => <option key={term.id} value={term.id}>{term.name} · {term.code}</option>)}</select></label>}
        <button disabled={busy || (termDraftSourceType === 'TERM' && !termDraftSourceId)} onClick={createTermDraft} className="rounded-lg bg-amber-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Tạo bản nháp</button>
      </div>}</div> : <>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4 text-sm">
          <div><strong>Phiên bản {termRubric.rubricVersion.version}</strong> · {formatRubricSource(termRubric.rubricVersion.source)} · {termRubric.rubricVersion.categories?.flatMap((category: any) => category.criteria).length || 0} tiêu chí</div>
          <span className={`rounded-full px-3 py-1 font-semibold ${termRubric.rubricVersion.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{statusLabel[termRubric.rubricVersion.status]}</span>
        </div>
        {termRubric.definition && <RubricEditor key={termRubric.rubricVersion.id} definition={termRubric.definition} disabled={termRubric.rubricVersion.status !== 'DRAFT' || selectedTerm?.status === 'CLOSED'} showChangeNote onSave={(definition, changeNote) => apiClient.saveTermRubricDraft(selectedTermId, definition, changeNote)} />}
        {termRubric.rubricVersion.status === 'DRAFT' && selectedTerm?.status !== 'CLOSED' && <button disabled={busy} onClick={publishTerm} className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Ban hành bộ tiêu chí cho kỳ</button>}
        {selectedTerm?.status === 'CLOSED' && <p className="text-sm text-slate-600">Kỳ đã chốt nên phiên bản chỉ được xem.</p>}
      </>}
    </>}
  </div>;
};
