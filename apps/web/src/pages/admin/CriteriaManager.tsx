import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiClient } from '../../lib/apiClient';
import { RubricDefinition, RubricTemplate, RubricTemplateVersionSummary, Term } from '../../types';
import { PageHeader } from '../../components/shared/PageHeader';
import { Plus, Trash2, Check, ArrowRight, BookOpen, Layers, Save, AlertCircle } from 'lucide-react';

type TermWithVersions = Term & { rubricVersions?: RubricTemplateVersionSummary[] };
type TermRubricPayload = { term: Term; rubricVersion: any; definition: RubricDefinition | null };

const statusLabel: Record<string, string> = { DRAFT: 'Nháp', PUBLISHED: 'Đã ban hành', ARCHIVED: 'Đã lưu trữ' };
const termStatusLabel: Record<string, string> = {
  UPCOMING: 'Sắp diễn ra',
  ACTIVE: 'Đang mở',
  REVIEWING: 'Đang chấm duyệt',
  CLOSED: 'Đã chốt sổ',
};

const formatRubricSource = (source?: string) => {
  if (!source) return 'Nguồn chưa ghi nhận';
  if (source.startsWith('DUT_DEFAULT')) return `Sao chép từ bộ chuẩn ${source.replace('DUT_DEFAULT ', '')}`;
  if (source.startsWith('Kế thừa kỳ')) return source;
  return source;
};

const RubricEditor: React.FC<{
  definition: RubricDefinition;
  onSave: (definition: RubricDefinition, changeNote?: string) => Promise<unknown>;
  disabled?: boolean;
  showChangeNote?: boolean;
}> = ({ definition: initialDefinition, onSave, disabled = false, showChangeNote = false }) => {
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
    definition.categories.forEach((category, categoryIndex) =>
      category.criteria.forEach((criterion, criterionIndex) => {
        next[`${categoryIndex}-${criterionIndex}`] = JSON.stringify(criterion.scoringConfig, null, 2);
      })
    );
    setConfigTexts(next);
  }, [definition]);

  const total = useMemo(
    () => definition.categories.reduce((sum, category) => sum + Number(category.maxScore || 0), 0),
    [definition]
  );

  const changeCategory = (index: number, key: string, value: string | number) =>
    setDefinition((current) => ({
      ...current,
      categories: current.categories.map((category, i) => (i === index ? { ...category, [key]: value } : category)),
    }));

  const changeCriterion = (categoryIndex: number, criterionIndex: number, key: string, value: string | number) =>
    setDefinition((current) => ({
      ...current,
      categories: current.categories.map((category, ci) =>
        ci === categoryIndex
          ? {
              ...category,
              criteria: category.criteria.map((criterion, i) =>
                i === criterionIndex ? { ...criterion, [key]: value } : criterion
              ),
            }
          : category
      ),
    }));

  const removeCriterion = (categoryIndex: number, criterionIndex: number) =>
    setDefinition((current) => ({
      ...current,
      categories: current.categories.map((category, ci) =>
        ci === categoryIndex
          ? { ...category, criteria: category.criteria.filter((_, i) => i !== criterionIndex) }
          : category
      ),
    }));

  const addCriterion = (categoryIndex: number) =>
    setDefinition((current) => ({
      ...current,
      categories: current.categories.map((category, ci) =>
        ci === categoryIndex
          ? {
              ...category,
              criteria: [
                ...category.criteria,
                {
                  code: `M${category.criteria.length + 1}`,
                  name: '',
                  description: '',
                  maxScore: 0,
                  scoringConfig: { kind: 'manual_verified', requiredData: ['officialScore'] },
                },
              ],
            }
          : category
      ),
    }));

  const removeCategory = (categoryIndex: number) =>
    setDefinition((current) => ({
      ...current,
      categories: current.categories.filter((_, i) => i !== categoryIndex),
    }));

  const addCategory = () =>
    setDefinition((current) => ({
      ...current,
      categories: [
        ...current.categories,
        {
          code: `KHUNG_${current.categories.length + 1}`,
          name: '',
          maxScore: 0,
          position: current.categories.length + 1,
          criteria: [],
        },
      ],
    }));

  const save = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const parsed = {
        ...definition,
        categories: definition.categories.map((category, ci) => ({
          ...category,
          criteria: category.criteria.map((criterion, ki) => ({
            ...criterion,
            scoringConfig: JSON.parse(configTexts[`${ci}-${ki}`] || '{}'),
          })),
        })),
      };
      await onSave(parsed, changeNote);
      setDefinition(parsed);
      setNotice('Đã lưu bản nháp. Các thay đổi chưa áp dụng cho kỳ cho đến khi ban hành.');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Không lưu được. Kiểm tra cấu hình quy tắc JSON.');
    } finally {
      setSaving(false);
    }
  };

  const isBalanced = Math.abs(total - 100) < 0.001;

  return (
    <div className="space-y-4">
      <div
        className={`flex items-center justify-between rounded-[8px] border p-3.5 text-xs ${
          isBalanced
            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
            : 'border-amber-200 bg-amber-50 text-amber-900'
        }`}
      >
        <span>
          Tổng điểm các khung:{' '}
          <strong className="font-heading font-bold text-sm">{total}</strong> / 100 điểm. Mỗi khung phải có tổng điểm tiêu chí bằng điểm tối đa của khung.
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            isBalanced ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
          }`}
        >
          {isBalanced ? 'Cân đối (100đ)' : 'Chưa cân đối'}
        </span>
      </div>

      {definition.categories.map((category, ci) => {
        const categorySum = category.criteria.reduce(
          (sum, criterion) => sum + Number(criterion.maxScore || 0),
          0
        );
        const isCatBalanced = Math.abs(categorySum - category.maxScore) < 0.001;
        return (
          <section
            key={`${ci}-${category.code}`}
            className="overflow-hidden rounded-[12px] border border-[#E8E8EC] bg-white shadow-xs"
          >
            <div className="grid gap-2.5 border-b border-[#E8E8EC] bg-[#FAFAFA] p-3.5 sm:grid-cols-[140px_1fr_120px_auto] sm:items-end">
              <label className="text-xs font-semibold text-[#6B6B6B]">
                Mã khung
                <input
                  disabled={disabled}
                  value={category.code}
                  onChange={(event) => changeCategory(ci, 'code', event.target.value)}
                  className="mt-1 w-full rounded-[6px] border border-[#E8E8EC] bg-white px-2.5 py-1.5 text-sm text-[#0A0A0A] disabled:bg-[#F3F4F6] focus:border-[#1D6FC2] focus:outline-none"
                />
              </label>
              <label className="text-xs font-semibold text-[#6B6B6B]">
                Tên khung
                <input
                  disabled={disabled}
                  value={category.name}
                  onChange={(event) => changeCategory(ci, 'name', event.target.value)}
                  className="mt-1 w-full rounded-[6px] border border-[#E8E8EC] bg-white px-2.5 py-1.5 text-sm text-[#0A0A0A] disabled:bg-[#F3F4F6] focus:border-[#1D6FC2] focus:outline-none"
                />
              </label>
              <label className="text-xs font-semibold text-[#6B6B6B]">
                Điểm tối đa
                <input
                  disabled={disabled}
                  type="number"
                  min="0"
                  step="0.5"
                  value={category.maxScore}
                  onChange={(event) => changeCategory(ci, 'maxScore', Number(event.target.value))}
                  className="mt-1 w-full rounded-[6px] border border-[#E8E8EC] bg-white px-2.5 py-1.5 text-sm font-semibold text-[#0A0A0A] disabled:bg-[#F3F4F6] focus:border-[#1D6FC2] focus:outline-none"
                />
              </label>
              {!disabled && (
                <button
                  onClick={() => removeCategory(ci)}
                  className="rounded-[6px] border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  Xóa khung
                </button>
              )}
              <div
                className={`text-xs sm:col-span-4 ${
                  isCatBalanced ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'
                }`}
              >
                Tổng điểm các tiêu chí trong khung: {categorySum} / {category.maxScore} đ
              </div>
            </div>

            <div className="divide-y divide-[#E8E8EC]">
              {category.criteria.map((criterion, ki) => (
                <article
                  key={`${ci}-${ki}-${criterion.code}`}
                  className="grid gap-3 p-3.5 lg:grid-cols-[90px_1fr_120px_auto] hover:bg-[#FAFAFA] transition-colors"
                >
                  <label className="text-xs font-semibold text-[#6B6B6B]">
                    Mã
                    <input
                      disabled={disabled}
                      value={criterion.code}
                      onChange={(event) => changeCriterion(ci, ki, 'code', event.target.value)}
                      className="mt-1 w-full rounded-[6px] border border-[#E8E8EC] bg-white px-2.5 py-1.5 text-sm font-mono text-[#0A0A0A] disabled:bg-[#F3F4F6] focus:border-[#1D6FC2] focus:outline-none"
                    />
                  </label>
                  <label className="text-xs font-semibold text-[#6B6B6B]">
                    Tên tiêu chí
                    <input
                      disabled={disabled}
                      value={criterion.name}
                      onChange={(event) => changeCriterion(ci, ki, 'name', event.target.value)}
                      className="mt-1 w-full rounded-[6px] border border-[#E8E8EC] bg-white px-2.5 py-1.5 text-sm text-[#0A0A0A] disabled:bg-[#F3F4F6] focus:border-[#1D6FC2] focus:outline-none"
                    />
                  </label>
                  <label className="text-xs font-semibold text-[#6B6B6B]">
                    Điểm tối đa
                    <input
                      disabled={disabled}
                      type="number"
                      min="0"
                      step="0.5"
                      value={criterion.maxScore}
                      onChange={(event) => changeCriterion(ci, ki, 'maxScore', Number(event.target.value))}
                      className="mt-1 w-full rounded-[6px] border border-[#E8E8EC] bg-white px-2.5 py-1.5 text-sm font-semibold text-[#0A0A0A] disabled:bg-[#F3F4F6] focus:border-[#1D6FC2] focus:outline-none"
                    />
                  </label>
                  {!disabled && (
                    <button
                      onClick={() => removeCriterion(ci, ki)}
                      className="self-end rounded-[6px] border border-red-200 p-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors"
                      title="Xóa mục"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  <label className="text-xs font-semibold text-[#6B6B6B] lg:col-span-4">
                    Mô tả và điều kiện minh chứng
                    <textarea
                      disabled={disabled}
                      rows={2}
                      value={criterion.description}
                      onChange={(event) => changeCriterion(ci, ki, 'description', event.target.value)}
                      className="mt-1 w-full rounded-[6px] border border-[#E8E8EC] bg-white px-2.5 py-1.5 text-xs text-[#0A0A0A] disabled:bg-[#F3F4F6] focus:border-[#1D6FC2] focus:outline-none"
                    />
                  </label>
                  <details className="rounded-[6px] border border-[#E8E8EC] bg-[#FAFAFA] p-3 lg:col-span-4">
                    <summary className="cursor-pointer text-xs font-semibold text-[#6B6B6B] hover:text-[#0A0A0A]">
                      Cấu hình tính điểm nâng cao (JSON)
                    </summary>
                    <p className="mt-1.5 text-xs text-[#8A8A8E]">
                      Chỉ chỉnh phần này khi cần cấu hình loại quy tắc tính điểm Backend hỗ trợ (manual_verified, binary, count_bounded, academic_tier).
                    </p>
                    <textarea
                      disabled={disabled}
                      rows={5}
                      spellCheck={false}
                      value={configTexts[`${ci}-${ki}`] ?? JSON.stringify(criterion.scoringConfig, null, 2)}
                      onChange={(event) =>
                        setConfigTexts((current) => ({ ...current, [`${ci}-${ki}`]: event.target.value }))
                      }
                      className="mt-2 w-full rounded-[6px] border border-[#E8E8EC] bg-white px-2.5 py-1.5 font-mono text-xs text-[#0A0A0A] focus:border-[#1D6FC2] focus:outline-none"
                    />
                  </details>
                </article>
              ))}
            </div>
            {!disabled && (
              <div className="border-t border-[#E8E8EC] bg-[#FAFAFA] p-2.5">
                <button
                  onClick={() => addCriterion(ci)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#1D6FC2] hover:text-[#175A9E]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Thêm tiêu chí vào khung
                </button>
              </div>
            )}
          </section>
        );
      })}

      {!disabled && (
        <div className="flex flex-wrap items-end justify-between gap-3 pt-2">
          <button
            onClick={addCategory}
            className="inline-flex items-center gap-1.5 rounded-[6px] border border-[#1D6FC2] bg-white px-3.5 py-2 text-xs font-semibold text-[#1D6FC2] hover:bg-[#EBF3FC] transition-colors"
          >
            <Plus className="h-4 w-4" />
            Thêm khung
          </button>
          <div className="flex flex-wrap items-end gap-2.5">
            {showChangeNote && (
              <label className="text-xs font-medium text-[#6B6B6B]">
                Ghi chú phiên bản
                <input
                  value={changeNote}
                  onChange={(event) => setChangeNote(event.target.value)}
                  className="mt-1 block rounded-[6px] border border-[#E8E8EC] bg-white px-2.5 py-1.5 text-sm text-[#0A0A0A] focus:border-[#1D6FC2] focus:outline-none"
                  placeholder="Ví dụ: Cập nhật theo Quyết định mới…"
                />
              </label>
            )}
            <button
              disabled={saving}
              onClick={save}
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#1D6FC2] px-4 py-2 text-xs font-semibold text-white hover:bg-[#175A9E] disabled:opacity-50 transition-colors"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Đang lưu…' : 'Lưu bản nháp'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-[8px] border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-[8px] border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          {notice}
        </div>
      )}
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
    setTemplates(templateList);
    setTerms(termList as TermWithVersions[]);
    const template = templateList[0];
    const selectedVersion =
      template?.versions.find((version) => version.status === 'DRAFT') ||
      template?.versions.find((version) => version.status === 'PUBLISHED');
    if (selectedVersion) setSelectedTemplateVersionId(selectedVersion.id);
    const requestedTermId = searchParams.get('termId');
    const requestedTerm = (termList as TermWithVersions[]).find((term) => term.id === requestedTermId);
    const termWithDraft = (termList as TermWithVersions[]).find((term) =>
      term.rubricVersions?.some((version) => version.status === 'DRAFT')
    );
    setSelectedTermId(requestedTerm?.id || termWithDraft?.id || termList[0]?.id || '');
    if (requestedTerm) setTab('TERM');
  };

  useEffect(() => {
    reloadLists()
      .catch(() => setError('Không tải được bộ chuẩn / kỳ đánh giá từ Backend.'))
      .finally(() => setLoading(false));
  }, [searchParams]);

  useEffect(() => {
    if (!selectedTemplateVersionId) {
      setTemplateDefinition(null);
      return;
    }
    apiClient
      .getRubricTemplateVersion(selectedTemplateVersionId)
      .then((result: any) => setTemplateDefinition(result.definition as RubricDefinition))
      .catch(() => setError('Không tải được nội dung phiên bản bộ chuẩn.'));
  }, [selectedTemplateVersionId]);

  useEffect(() => {
    if (!selectedTermId) {
      setTermRubric(null);
      return;
    }
    apiClient
      .getTermRubric(selectedTermId)
      .then(setTermRubric)
      .catch(() => setError('Không tải được rubric của kỳ.'));
  }, [selectedTermId]);

  const selectedTemplateVersion = templates
    .flatMap((template) => template.versions)
    .find((version) => version.id === selectedTemplateVersionId);
  const selectedTerm = terms.find((term) => term.id === selectedTermId);

  const run = async (fn: () => Promise<any>, success: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await fn();
      await reloadLists();
      if (tab === 'TERM' && selectedTermId) setTermRubric(await apiClient.getTermRubric(selectedTermId));
      setNotice(success);
      return result;
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Không thực hiện được thao tác.');
    } finally {
      setBusy(false);
    }
  };

  const createTemplateDraft = async () => {
    const created = await run(
      () => apiClient.createRubricTemplateDraft(),
      'Đã tạo bản nháp mới từ bộ chuẩn đang ban hành.'
    );
    if (created?.id) setSelectedTemplateVersionId(created.id);
  };

  const publishTemplate = () =>
    selectedTemplateVersionId &&
    window.confirm('Ban hành bản chuẩn này? Bộ chuẩn đang ban hành sẽ được lưu trữ; các kỳ đã tạo không đổi.') &&
    void run(() => apiClient.publishRubricTemplateDraft(selectedTemplateVersionId), 'Đã ban hành phiên bản bộ chuẩn.');

  const publishTerm = () =>
    selectedTermId &&
    window.confirm('Ban hành bộ tiêu chí cho kỳ này? Sau khi ban hành, phiên bản sẽ chỉ đọc.') &&
    void run(() => apiClient.publishTermRubric(selectedTermId), 'Đã ban hành bộ tiêu chí của kỳ.');

  const createTermDraft = () =>
    selectedTermId &&
    void run(
      () =>
        apiClient.createTermRubricDraft(selectedTermId, {
          type: termDraftSourceType,
          sourceTermId: termDraftSourceType === 'TERM' ? termDraftSourceId : undefined,
        }),
      'Đã tạo bản nháp rubric cho kỳ.'
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bộ tiêu chí đánh giá"
        action={
          <Link
            to="/admin/terms"
            className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#1D6FC2] px-4 py-2 text-xs font-semibold text-white hover:bg-[#175A9E] transition-colors shadow-xs"
          >
            Quản lý kỳ đánh giá
          </Link>
        }
      />

      {/* Tabs */}
      <div className="flex border-b border-[#E8E8EC]">
        <button
          onClick={() => setTab('DEFAULT')}
          className={`px-4 py-3 text-xs font-semibold transition-colors border-b-2 -mb-[1px] ${
            tab === 'DEFAULT'
              ? 'border-[#1D6FC2] text-[#1D6FC2]'
              : 'border-transparent text-[#6B6B6B] hover:text-[#0A0A0A]'
          }`}
        >
          Bộ chuẩn toàn trường
        </button>
        <button
          onClick={() => setTab('TERM')}
          className={`px-4 py-3 text-xs font-semibold transition-colors border-b-2 -mb-[1px] ${
            tab === 'TERM'
              ? 'border-[#1D6FC2] text-[#1D6FC2]'
              : 'border-transparent text-[#6B6B6B] hover:text-[#0A0A0A]'
          }`}
        >
          Bộ tiêu chí theo kỳ
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-[12px] border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-[12px] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      {loading ? (
        <div className="rounded-[12px] border border-[#E8E8EC] bg-white p-12 text-center text-sm text-[#6B6B6B]">
          Đang tải cấu hình bộ tiêu chí…
        </div>
      ) : tab === 'DEFAULT' ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[#E8E8EC] bg-white p-4 shadow-xs">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#6B6B6B]">
              Phiên bản bộ chuẩn
              <select
                value={selectedTemplateVersionId}
                onChange={(event) => setSelectedTemplateVersionId(event.target.value)}
                className="mt-1 block min-w-64 rounded-[6px] border border-[#E8E8EC] bg-[#FAFAFA] px-3 py-2 text-sm font-medium text-[#0A0A0A] focus:bg-white focus:border-[#1D6FC2] focus:outline-none transition-colors"
              >
                {templates.flatMap((template) =>
                  template.versions.map((version) => (
                    <option key={version.id} value={version.id}>
                      {template.name} · v{version.version} · {statusLabel[version.status]}
                    </option>
                  ))
                )}
              </select>
            </label>
            <div className="flex gap-2">
              {selectedTemplateVersion?.status === 'PUBLISHED' && (
                <button
                  disabled={busy || templates[0]?.versions.some((version) => version.status === 'DRAFT')}
                  onClick={createTemplateDraft}
                  className="rounded-[6px] border border-[#1D6FC2] bg-white px-3.5 py-2 text-xs font-semibold text-[#1D6FC2] hover:bg-[#EBF3FC] disabled:opacity-40 transition-colors"
                >
                  Tạo bản nháp từ bản chuẩn
                </button>
              )}
              {selectedTemplateVersion?.status === 'DRAFT' && (
                <button
                  disabled={busy}
                  onClick={publishTemplate}
                  className="rounded-[6px] bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors"
                >
                  Ban hành bộ chuẩn
                </button>
              )}
            </div>
          </div>

          {selectedTemplateVersion && (
            <div className="rounded-[8px] border border-[#E8E8EC] bg-white px-4 py-3 text-xs text-[#6B6B6B]">
              Trạng thái:{' '}
              <strong className="text-[#0A0A0A]">{statusLabel[selectedTemplateVersion.status]}</strong>
              {selectedTemplateVersion.sourceDescription && <> · {selectedTemplateVersion.sourceDescription}</>}
              {selectedTemplateVersion.changeNote && <> · Ghi chú: {selectedTemplateVersion.changeNote}</>}
            </div>
          )}

          {templateDefinition && selectedTemplateVersion && (
            <RubricEditor
              key={selectedTemplateVersion.id}
              definition={templateDefinition}
              disabled={selectedTemplateVersion.status !== 'DRAFT'}
              showChangeNote
              onSave={(definition, changeNote) =>
                apiClient.saveRubricTemplateDraft(selectedTemplateVersion.id, definition, changeNote || '')
              }
            />
          )}
        </>
      ) : (
        <>
          <div className="rounded-[12px] border border-[#E8E8EC] bg-white p-4 shadow-xs">
            <label className="block max-w-xl text-xs font-semibold uppercase tracking-wider text-[#6B6B6B]">
              Kỳ đánh giá
              <select
                value={selectedTermId}
                onChange={(event) => setSelectedTermId(event.target.value)}
                className="mt-1 block w-full rounded-[6px] border border-[#E8E8EC] bg-[#FAFAFA] px-3 py-2 text-sm font-medium text-[#0A0A0A] focus:bg-white focus:border-[#1D6FC2] focus:outline-none transition-colors"
              >
                {terms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.name} · {termStatusLabel[term.status] || term.status}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {!terms.length ? (
            <div className="rounded-[12px] border border-[#E8E8EC] bg-white p-8 text-center text-sm text-[#6B6B6B]">
              Chưa có kỳ đánh giá. Tạo kỳ mới để sao chép bộ chuẩn.
            </div>
          ) : !termRubric?.rubricVersion ? (
            <div className="space-y-3 rounded-[12px] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
              <p className="font-medium">Kỳ {selectedTerm?.name} chưa có phiên bản bộ tiêu chí.</p>
              {selectedTerm?.status !== 'CLOSED' && (
                <div className="flex flex-wrap items-end gap-3 pt-2">
                  <label className="text-xs font-semibold">
                    Nguồn khởi tạo
                    <select
                      value={termDraftSourceType}
                      onChange={(event) => setTermDraftSourceType(event.target.value as 'DEFAULT' | 'TERM')}
                      className="mt-1 block rounded-[6px] border border-amber-300 bg-white px-3 py-2 text-xs"
                    >
                      <option value="DEFAULT">Bộ chuẩn hiện tại</option>
                      <option value="TERM">Kỳ đã ban hành</option>
                    </select>
                  </label>
                  {termDraftSourceType === 'TERM' && (
                    <label className="text-xs font-semibold">
                      Kỳ nguồn
                      <select
                        value={termDraftSourceId}
                        onChange={(event) => setTermDraftSourceId(event.target.value)}
                        className="mt-1 block min-w-56 rounded-[6px] border border-amber-300 bg-white px-3 py-2 text-xs"
                      >
                        <option value="">Chọn kỳ nguồn</option>
                        {terms
                          .filter(
                            (term) =>
                              term.id !== selectedTermId &&
                              term.rubricVersions?.some((version) => version.status === 'PUBLISHED')
                          )
                          .map((term) => (
                            <option key={term.id} value={term.id}>
                              {term.name} · {term.code}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                  <button
                    disabled={busy || (termDraftSourceType === 'TERM' && !termDraftSourceId)}
                    onClick={createTermDraft}
                    className="rounded-[6px] bg-amber-800 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-900 disabled:opacity-40 transition-colors"
                  >
                    Tạo bản nháp
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[#E8E8EC] bg-white p-4 shadow-xs text-xs">
                <div>
                  <strong className="text-sm font-semibold text-[#0A0A0A]">
                    Phiên bản {termRubric.rubricVersion.version}
                  </strong>{' '}
                  · {formatRubricSource(termRubric.rubricVersion.source)} ·{' '}
                  {termRubric.rubricVersion.categories?.flatMap((category: any) => category.criteria).length || 0} tiêu chí
                </div>
                <span
                  className={`rounded-full px-3 py-1 font-semibold ${
                    termRubric.rubricVersion.status === 'PUBLISHED'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  {statusLabel[termRubric.rubricVersion.status]}
                </span>
              </div>

              {termRubric.definition && (
                <RubricEditor
                  key={termRubric.rubricVersion.id}
                  definition={termRubric.definition}
                  disabled={termRubric.rubricVersion.status !== 'DRAFT' || selectedTerm?.status === 'CLOSED'}
                  showChangeNote
                  onSave={(definition, changeNote) =>
                    apiClient.saveTermRubricDraft(selectedTermId, definition, changeNote)
                  }
                />
              )}

              {termRubric.rubricVersion.status === 'DRAFT' && selectedTerm?.status !== 'CLOSED' && (
                <div className="flex justify-end pt-2">
                  <button
                    disabled={busy}
                    onClick={publishTerm}
                    className="rounded-[6px] bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors"
                  >
                    Ban hành bộ tiêu chí cho kỳ
                  </button>
                </div>
              )}

              {selectedTerm?.status === 'CLOSED' && (
                <p className="rounded-[8px] bg-[#FAFAFA] border border-[#E8E8EC] p-3 text-xs text-[#6B6B6B]">
                  Kỳ đánh giá đã chốt sổ, phiên bản bộ tiêu chí chuyển sang chế độ lưu trữ chỉ xem.
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};
