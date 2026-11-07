import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { apiClient } from '../../lib/apiClient';
import { Criterion, CriterionAssessment, RubricPayload, User } from '../../types';
import { useAuth } from '../../context/AuthContext';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  History,
  Send,
  CornerUpLeft,
  X,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  User as UserIcon,
  Award,
  Sparkles,
  Check,
  Info,
  ChevronDown,
  Building,
  GraduationCap,
} from 'lucide-react';

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
  verifiedActivityCount: 'Số hoạt động có minh chứng đã duyệt (Tự động tính)',
  cheerleaderActivityCount: 'Số minh chứng cổ vũ đã duyệt (Tự động tính)',
  communityViolations: 'Số vi phạm tại nơi cư trú/cộng đồng',
  convertedCommunityPoints: 'Điểm hoạt động cộng đồng quy đổi',
  collectiveApprovalPercent: 'Tỷ lệ tập thể bình chọn (%)',
};

const isNumberField = (key: string) => /Count|Violations|Bans|Absences|Failures|Percent|Points|Locks/i.test(key);

const getGradeClassification = (score: number) => {
  if (score >= 90) return { label: 'Xuất sắc', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
  if (score >= 80) return { label: 'Tốt', color: 'bg-blue-50 text-blue-800 border-blue-200' };
  if (score >= 65) return { label: 'Khá', color: 'bg-sky-50 text-sky-800 border-sky-200' };
  if (score >= 50) return { label: 'Trung bình', color: 'bg-amber-50 text-amber-800 border-amber-200' };
  return { label: 'Yếu', color: 'bg-rose-50 text-rose-800 border-rose-200' };
};

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
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await fn();
      await onSaved();
      setMessage(success);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Không lưu được dữ liệu.');
    } finally {
      setBusy(false);
    }
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
    <article className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      {/* Criterion Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-[#1D6FC2] border border-blue-100">
              Mục {criterion.code}
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs font-semibold text-slate-500">Tối đa {criterion.maxScore} điểm</span>
          </div>
          <h3 className="font-heading font-bold text-base text-slate-900 leading-snug">{criterion.name}</h3>
          {criterion.description && (
            <p className="mt-1 text-xs text-slate-600 leading-relaxed max-w-2xl">{criterion.description}</p>
          )}
        </div>
        <div className="shrink-0 sm:text-right">
          {assessment?.status === 'FINALIZED' ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
              Đã xác nhận: {assessment.officialScore} đ
            </span>
          ) : assessment?.status === 'READY_FOR_REVIEW' ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 border border-amber-200">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
              Chờ duyệt: {assessment.suggestedScore ?? '—'} đ
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 border border-slate-200">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              Chờ xác minh căn cứ
            </span>
          )}
        </div>
      </div>

      {/* Comparison Grid: Student Self-Score vs Evidences & AI */}
      <div className="grid gap-3.5 sm:grid-cols-2">
        {/* Left: Student Declaration */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Sinh viên tự đánh giá
            </span>
            <span className="text-xs text-slate-400">Tối đa {criterion.maxScore} đ</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-heading text-2xl font-extrabold text-slate-900 tabular-nums">
              {assessment?.selfScore !== null && assessment?.selfScore !== undefined ? assessment.selfScore : '—'}
            </span>
            <span className="text-xs font-medium text-slate-500">điểm</span>
          </div>
          {assessment?.selfNote ? (
            <div className="mt-2.5 rounded-lg border border-slate-200/80 bg-white p-2.5 text-xs text-slate-700 italic">
              "{assessment.selfNote}"
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-400 italic">Không có ghi chú thêm từ sinh viên.</p>
          )}
        </div>

        {/* Right: Evidences & AI Suggestions */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Hồ sơ minh chứng ({assessment?.evidences?.length || 0})
            </span>
            <ShieldCheck className="h-4 w-4 text-slate-400" />
          </div>

          {assessment?.evidences?.length ? (
            <ul className="mt-2 space-y-2">
              {assessment.evidences.map((evidence) => (
                <li key={evidence.id} className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-2xs">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      className="font-medium text-xs text-[#1D6FC2] hover:text-[#175A9E] hover:underline flex items-center gap-1 truncate"
                      to={`/officer/review/${evidence.id}`}
                    >
                      <span className="truncate">{evidence.declaredActivityName || 'Hồ sơ minh chứng'}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </Link>
                    <span className="shrink-0 inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium bg-slate-100 text-slate-700">
                      {({ APPROVED: 'Hợp lệ', REJECTED: 'Từ chối', NEEDS_SUPPLEMENT: 'Cần bổ sung' } as Record<string, string>)[evidence.status] || 'Chờ xác minh'}
                    </span>
                  </div>
                  {evidence.aiSuggestions?.[0] && (
                    <div className="mt-2 flex items-start gap-1.5 rounded-md bg-purple-50/80 border border-purple-100 p-2 text-[11px] text-purple-800">
                      <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5 text-purple-600" />
                      <p className="leading-snug">
                        <strong>AI chấm {evidence.aiSuggestions[0].suggestedScore ?? '—'} đ:</strong>{' '}
                        {evidence.aiSuggestions[0].reasoning}
                      </p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-slate-400 italic">Chưa nộp hồ sơ minh chứng độc lập.</p>
          )}
        </div>
      </div>

      {/* Verified Data Summary if exists */}
      {!!assessment?.verifiedData && Object.keys(assessment.verifiedData).length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-1.5 mb-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Dữ liệu căn cứ đã lưu</span>
          </div>
          <dl className="grid gap-2 sm:grid-cols-2 text-xs">
            {Object.entries(assessment.verifiedData).map(([key, value]) => (
              <div key={key} className="flex justify-between sm:justify-start sm:gap-2 border-b border-slate-50 pb-1">
                <dt className="text-slate-500">{fieldLabels[key] || key}:</dt>
                <dd className="font-semibold text-slate-900">{String(value)}</dd>
              </div>
            ))}
          </dl>
          {assessment.verificationNote && (
            <div className="mt-2.5 pt-2 border-t border-slate-100 text-xs text-slate-600">
              <strong className="text-slate-700">Ghi chú nguồn căn cứ:</strong> {assessment.verificationNote}
            </div>
          )}
        </div>
      )}

      {/* Verification Drawer / Accordion */}
      <details className="group rounded-xl border border-slate-200 bg-slate-50/60 overflow-hidden" open={!readOnly && (!assessment?.officialScore && assessment?.officialScore !== 0)}>
        <summary className="flex cursor-pointer items-center justify-between p-3.5 text-xs font-bold uppercase tracking-wider text-slate-700 hover:text-[#1D6FC2] transition-colors select-none">
          <span className="flex items-center gap-2">
            <span>Thẩm định căn cứ & Cập nhật dữ liệu tiêu chí</span>
            {fields.length > 0 && (
              <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-bold text-slate-600 lowercase">
                {fields.length} trường dữ liệu
              </span>
            )}
          </span>
          <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-slate-200 bg-white p-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map((key) => (
              <label key={key} className="block text-xs font-semibold text-slate-700">
                <span className="mb-1 block">{fieldLabels[key] || key}</span>
                {booleanFields.has(key) ? (
                  <select
                    value={verifiedDraft[key] ?? ''}
                    disabled={readOnly}
                    onChange={(event) => setVerifiedDraft((current) => ({ ...current, [key]: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 disabled:bg-slate-50 focus:border-[#1D6FC2] focus:ring-1 focus:ring-[#1D6FC2] focus:outline-none transition-colors"
                  >
                    <option value="">Chưa xác minh</option>
                    <option value="true">Có</option>
                    <option value="false">Không</option>
                  </select>
                ) : key === 'academicTier' ? (
                  <select
                    value={verifiedDraft[key] ?? ''}
                    disabled={readOnly}
                    onChange={(event) => setVerifiedDraft((current) => ({ ...current, [key]: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 disabled:bg-slate-50 focus:border-[#1D6FC2] focus:ring-1 focus:ring-[#1D6FC2] focus:outline-none transition-colors"
                  >
                    <option value="">Chưa xác minh</option>
                    <option value="BELOW_AVERAGE">Yếu trở xuống</option>
                    <option value="AVERAGE">Trung bình</option>
                    <option value="ABOVE_AVERAGE">Khá</option>
                    <option value="GOOD">Giỏi</option>
                    <option value="EXCELLENT">Xuất sắc</option>
                  </select>
                ) : key === 'awardTier' ? (
                  <select
                    value={verifiedDraft[key] ?? ''}
                    disabled={readOnly}
                    onChange={(event) => setVerifiedDraft((current) => ({ ...current, [key]: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 disabled:bg-slate-50 focus:border-[#1D6FC2] focus:ring-1 focus:ring-[#1D6FC2] focus:outline-none transition-colors"
                  >
                    <option value="">Chưa xác minh</option>
                    <option value="PARTICIPATED">Có tham gia, chưa đạt giải</option>
                    <option value="CONSOLATION_OR_HIGHER">Từ giải khuyến khích trở lên</option>
                  </select>
                ) : (
                  <input
                    type={isNumberField(key) ? 'number' : 'text'}
                    min={isNumberField(key) ? 0 : undefined}
                    readOnly={readOnly || key === 'verifiedActivityCount' || key === 'cheerleaderActivityCount'}
                    placeholder={
                      key === 'verifiedActivityCount' || key === 'cheerleaderActivityCount'
                        ? 'Tự động tính từ hồ sơ đã duyệt'
                        : 'Nhập giá trị...'
                    }
                    value={verifiedDraft[key] ?? ''}
                    onChange={(event) => setVerifiedDraft((current) => ({ ...current, [key]: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 read-only:bg-slate-50 focus:border-[#1D6FC2] focus:ring-1 focus:ring-[#1D6FC2] focus:outline-none transition-colors"
                  />
                )}
              </label>
            ))}
            {criterion.scoringConfig?.kind === 'manual_verified' && (
              <label className="block text-xs font-semibold text-slate-700">
                <span className="mb-1 block">Điểm AI chấm theo căn cứ (0–{criterion.maxScore})</span>
                <input
                  type="number"
                  min="0"
                  max={criterion.maxScore}
                  step="0.5"
                  disabled={readOnly}
                  value={verifiedDraft.officialScore ?? ''}
                  onChange={(event) => setVerifiedDraft((current) => ({ ...current, officialScore: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 disabled:bg-slate-50 focus:border-[#1D6FC2] focus:ring-1 focus:ring-[#1D6FC2] focus:outline-none transition-colors"
                />
              </label>
            )}
          </div>

          <label className="block text-xs font-semibold text-slate-700">
            <span className="mb-1 block">Nguồn / Căn cứ xác minh (Biên bản, danh sách, quyết định...)</span>
            <textarea
              value={verificationNote}
              disabled={readOnly}
              onChange={(event) => setVerificationNote(event.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-900 placeholder-slate-400 disabled:bg-slate-50 focus:border-[#1D6FC2] focus:ring-1 focus:ring-[#1D6FC2] focus:outline-none transition-colors"
              placeholder="Ghi rõ nguồn dữ liệu trường, văn bản hoặc xác nhận đã kiểm tra thực tế..."
            />
          </label>

          <div className="flex justify-end">
            <button
              disabled={readOnly || busy}
              onClick={() =>
                action(
                  () =>
                    apiClient.verifyCriterion(studentId, termId, criterion.id, {
                      data: toVerifiedData(),
                      note: verificationNote,
                    }),
                  'Đã gửi dữ liệu xác minh để tính điểm AI chấm.'
                )
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40 transition-colors shadow-xs"
            >
              Lưu xác minh & Tính điểm AI chấm
            </button>
          </div>
        </div>
      </details>

      {/* Suggestion Banner */}
      {(assessment?.suggestionReason || assessment?.status === 'READY_FOR_REVIEW') && (
        <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-4 text-xs text-purple-950">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-600" />
              <span className="font-bold uppercase tracking-wider text-purple-800">Điểm AI chấm:</span>
              <span className="font-heading font-extrabold text-base text-purple-900 tabular-nums">
                {assessment?.suggestedScore ?? 'Chưa thể tính'} / {criterion.maxScore} điểm
              </span>
            </div>
            {assessment?.status === 'READY_FOR_REVIEW' && (
              <span className="rounded-full bg-purple-200/80 px-2 py-0.5 text-[10px] font-bold text-purple-900">
                Sẵn sàng chốt điểm
              </span>
            )}
          </div>
          {assessment?.suggestionReason && (
            <p className="mt-1.5 text-xs text-purple-900/90 leading-relaxed">{assessment.suggestionReason}</p>
          )}
        </div>
      )}

      {/* Officer Finalize Box */}
      {assessment?.status === 'READY_FOR_REVIEW' && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-900">
            Xác nhận điểm chính thức
          </div>
          <div className="grid gap-3 sm:grid-cols-[140px_1fr_auto] sm:items-end">
            <label className="text-xs font-semibold text-slate-700">
              Điểm chính thức
              <input
                type="number"
                min="0"
                max={criterion.maxScore}
                step="0.5"
                value={finalScore}
                disabled={readOnly}
                onChange={(event) => setFinalScore(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-heading font-bold text-slate-900 tabular-nums disabled:bg-slate-50 focus:border-emerald-600 focus:outline-none"
              />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Lý do điều chỉnh (nếu khác điểm AI chấm)
              <input
                value={finalReason}
                disabled={readOnly}
                onChange={(event) => setFinalReason(event.target.value)}
                placeholder="Ghi rõ lý do nếu điều chỉnh khác điểm AI chấm..."
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 disabled:bg-slate-50 focus:border-emerald-600 focus:outline-none"
              />
            </label>
            <button
              disabled={
                readOnly ||
                busy ||
                finalScore === '' ||
                (Number(finalScore) !== assessment?.suggestedScore && !finalReason.trim())
              }
              onClick={() =>
                action(
                  () =>
                    apiClient.finalizeCriterion(studentId, termId, criterion.id, {
                      score: Number(finalScore),
                      reason: finalReason,
                    }),
                  'Đã xác nhận điểm chính thức.'
                )
              }
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors shrink-0 shadow-xs"
            >
              <Check className="h-4 w-4" />
              Xác nhận điểm
            </button>
          </div>
        </div>
      )}

      {/* Finalized Status Info */}
      {assessment?.status === 'FINALIZED' && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>
              Điểm chính thức đã chốt:{' '}
              <strong className="font-heading font-extrabold text-sm text-emerald-950 tabular-nums">
                {assessment.officialScore} / {criterion.maxScore} đ
              </strong>
              {assessment.officialReason && <span className="text-emerald-800"> · {assessment.officialReason}</span>}
            </span>
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {message && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{message}</span>
        </div>
      )}
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
  const [relatedAppeals, setRelatedAppeals] = useState<Array<{ id: string; content: string; status: string; page: number }>>([]);
  const [appealLoad, setAppealLoad] = useState<'loading' | 'ready' | 'error'>('loading');
  const [appealRetry, setAppealRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (tab !== 'appeals' || user.role !== 'STAFF') return;
    setAppealLoad('loading');
    setRelatedAppeals([]);
    (async () => {
      const found: Array<{ id: string; content: string; status: string; page: number }> = [];
      let page = 1, scanned = 0, total = 0;
      do {
        const response = await apiClient.getAppealsPage({ termId, page, pageSize: 100 });
        if (cancelled) return;
        response.items.forEach((appeal, index) => {
          if (appeal.studentId === studentId) {
            found.push({ ...appeal, page: Math.floor((scanned + index) / 20) + 1 });
          }
        });
        scanned += response.items.length;
        total = response.total;
        page++;
        if (!response.items.length) break;
      } while (scanned < total);
      if (!cancelled) {
        setRelatedAppeals(found);
        setAppealLoad('ready');
      }
    })().catch(() => {
      if (!cancelled) setAppealLoad('error');
    });
    return () => { cancelled = true; };
  }, [tab, user.role, studentId, termId, appealRetry]);

  const isAdmin = user.role === 'ADMIN';
  const isReadOnly = isAdmin || !payload?.permissions?.canReview;

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [u, result, events] = await Promise.all([
        apiClient.getUserById(studentId, termId),
        apiClient.getStudentAssessments(studentId, termId),
        apiClient.getAssessmentHistory(termId, studentId),
      ]);
      setStudent(u);
      setPayload(result);
      setHistory(events);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || 'Không tải được phiếu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (studentId && termId) void load();
  }, [studentId, termId]);

  useEffect(() => {
    if (!opened) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpened(null);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [opened]);

  const act = async (fn: () => Promise<any>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      setReturnReason('');
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || 'Không lưu được.');
    } finally {
      setBusy(false);
    }
  };

  const criteria = payload?.categories.flatMap((c) => c.criteria) || [];
  const selected = criteria.find((c) => c.id === opened);
  const total =
    payload?.categories.reduce(
      (sum, cat) =>
        sum +
        Math.min(
          cat.maxScore,
          cat.criteria.reduce((n, c) => n + (c.assessment?.officialScore ?? 0), 0)
        ),
      0
    ) ?? 0;

  const selfTotal =
    payload?.categories.reduce(
      (sum, cat) =>
        sum +
        Math.min(
          cat.maxScore,
          cat.criteria.reduce((n, c) => n + (c.assessment?.selfScore ?? 0), 0)
        ),
      0
    ) ?? 0;

  const suggestedTotal =
    payload?.categories.reduce(
      (sum, cat) =>
        sum +
        Math.min(
          cat.maxScore,
          cat.criteria.reduce((n, c) => n + (c.assessment?.suggestedScore ?? 0), 0)
        ),
      0
    ) ?? 0;
  const count = criteria.filter((c) => c.assessment?.status === 'FINALIZED').length;
  const evidence = criteria.flatMap((c) => (c.assessment?.evidences || []).map((e) => ({ ...e, criterion: c })));

  const requestedReturn = params.get('returnTo') || '';
  const safeStaffReturn = ['/officer/students?', '/officer/queue?', '/officer/appeals?'].some((path) =>
    requestedReturn.startsWith(path)
  );
  const returnUrl = isAdmin
    ? requestedReturn.startsWith('/admin/results?')
      ? requestedReturn
      : `/admin/results?termId=${termId}`
    : safeStaffReturn
    ? requestedReturn
    : `/officer/students?termId=${termId}`;

  const progressPercent = criteria.length ? Math.round((count / criteria.length) * 100) : 0;
  const gradeInfo = getGradeClassification(total);

  return (
    <div className="space-y-6">
      {/* Top Navigation Back */}
      <div className="flex items-center justify-between">
        <Link
          to={returnUrl}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#1D6FC2] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Quay lại danh sách</span>
        </Link>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
              isReadOnly
                ? 'bg-slate-100 text-slate-600 border-slate-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${isReadOnly ? 'bg-slate-400' : 'bg-emerald-500'}`}
            />
            {isReadOnly ? 'Chế độ chỉ xem' : 'Có quyền thẩm định'}
          </span>
        </div>
      </div>

      {/* Executive Student Score Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: Student Identity Details */}
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-[#1D6FC2] border border-blue-100 font-heading text-xl font-bold shadow-2xs">
              {student?.fullName ? student.fullName.split(' ').slice(-1)[0][0] : <UserIcon className="h-6 w-6" />}
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-heading text-xl font-bold text-slate-900 tracking-tight">
                  {student?.fullName || 'Đang tải thông tin sinh viên...'}
                </h1>
                {student?.studentCode && (
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700 border border-slate-200">
                    {student.studentCode}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-slate-600">
                <div className="flex items-center gap-1">
                  <GraduationCap className="h-3.5 w-3.5 text-slate-400" />
                  <span>Lớp: <strong className="font-semibold text-slate-800">{student?.class?.code || '—'}</strong></span>
                </div>
                <span className="text-slate-300">·</span>
                <div className="flex items-center gap-1">
                  <Building className="h-3.5 w-3.5 text-slate-400" />
                  <span>{student?.faculty?.name || student?.class?.faculty?.name || 'Khoa CNTT'}</span>
                </div>
                <span className="text-slate-300">·</span>
                <div className="flex items-center gap-1 text-slate-500">
                  <span>{payload?.term?.name || activeTerm.name}</span>
                </div>
              </div>
              <div className="pt-0.5 flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-slate-500">
                  {payload?.rubricVersion ? `Bộ tiêu chí v${payload.rubricVersion.version}` : 'Chưa có bộ tiêu chí'}
                </span>
                {payload?.handoff?.status === 'SENT' && (
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-semibold text-[#1D6FC2] border border-blue-200">
                    Đã bàn giao CTSV
                  </span>
                )}
                {payload?.resultSource === 'HANDOFF_SNAPSHOT' && (
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-semibold text-[#1D6FC2] border border-blue-200">
                    Bản lưu v{payload.handoffRevision}
                  </span>
                )}
                {payload?.submission?.status === 'RETURNED' && (
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200">
                    Đã yêu cầu sinh viên sửa
                  </span>
                )}
                {evidence.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-[10px] font-semibold text-purple-700 border border-purple-200">
                    <Sparkles className="h-3 w-3 text-purple-600" />
                    {evidence.length} hồ sơ minh chứng
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: 3-Score Matrix & Progress */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 border-t border-slate-100 pt-4 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
            {/* Unified 3-Score Comparison Card */}
            <div className="flex items-center rounded-xl border border-slate-200/90 bg-slate-50/70 p-1.5 shadow-2xs divide-x divide-slate-200">
              {/* 1. SV tự chấm */}
              <div className="px-3.5 py-1.5 text-center min-w-[84px]">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                  SV tự chấm
                </div>
                <div className="mt-1 font-heading text-base font-bold text-slate-700 tabular-nums">
                  {selfTotal} <span className="text-xs font-normal text-slate-400">đ</span>
                </div>
              </div>

              {/* 2. Điểm AI chấm */}
              <div className="px-3.5 py-1.5 text-center bg-white rounded-lg border border-purple-100 shadow-2xs min-w-[96px]">
                <div className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-purple-700 whitespace-nowrap">
                  <Sparkles className="h-3 w-3 text-purple-600 shrink-0" />
                  <span>AI chấm</span>
                </div>
                <div className="mt-1 font-heading text-base font-extrabold text-purple-900 tabular-nums">
                  {suggestedTotal} <span className="text-xs font-normal text-purple-500">đ</span>
                </div>
              </div>

              {/* 3. Điểm Khoa chính thức */}
              <div className="px-4 py-1.5 text-center min-w-[125px]">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#1D6FC2] whitespace-nowrap">
                  Khoa chính thức
                </div>
                <div className="mt-1 flex items-baseline justify-center gap-1.5">
                  <span className="font-heading text-xl font-extrabold text-[#1D6FC2] tabular-nums">
                    {total}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">/ 100 đ</span>
                  <span className={`inline-flex items-center rounded-md px-1.5 py-0.2 text-[10px] font-bold border ${gradeInfo.color}`}>
                    {gradeInfo.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Progress Bar & Finalized Count */}
            <div className="w-full sm:w-44 border-t border-slate-100 pt-3 sm:border-t-0 sm:pt-0 sm:border-l sm:border-slate-100 sm:pl-4">
              <div className="flex items-center justify-between text-[11px] text-slate-600 mb-1.5">
                <span className="font-medium whitespace-nowrap">Tiến độ thẩm định</span>
                <span className="font-bold tabular-nums text-slate-800">{count}/{criteria.length}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden border border-slate-200/50">
                <div
                  className={`h-full transition-all duration-300 ${
                    progressPercent === 100 ? 'bg-emerald-500' : 'bg-[#1D6FC2]'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="mt-1 text-right text-[10px] text-slate-400 tabular-nums">
                {progressPercent}% hoàn tất
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Global Alerts / Notices */}
      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold">Đã xảy ra lỗi:</strong> {error}
          </div>
        </div>
      )}

      {payload?.permissions?.sendBlockers?.length && !isReadOnly ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold">Chưa thể gửi CTSV:</strong> {payload.permissions.sendBlockers.join('; ')}
          </div>
        </div>
      ) : null}

      {payload?.handoff?.returnReason && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
          <CornerUpLeft className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold">Lý do CTSV trả kết quả:</strong> {payload.handoff.returnReason}
          </div>
        </div>
      )}

      {payload?.submission?.returnReason && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
          <CornerUpLeft className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold">Yêu cầu sinh viên sửa:</strong> {payload.submission.returnReason}
          </div>
        </div>
      )}

      {/* Action Bar for Officer */}
      {!isReadOnly && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <div className="relative min-w-0 flex-1">
            <input
              aria-label="Lý do trả phiếu"
              placeholder="Nhập lý do cần sinh viên sửa / bổ sung minh chứng..."
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#1D6FC2] focus:ring-1 focus:ring-[#1D6FC2] focus:outline-none transition-colors"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              disabled={busy || !returnReason.trim()}
              onClick={() => void act(() => apiClient.returnSelfAssessment(studentId, termId, returnReason))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <CornerUpLeft className="h-3.5 w-3.5" />
              <span>Trả sinh viên</span>
            </button>
            <button
              disabled={busy || !payload?.permissions?.canSend}
              onClick={() => {
                if (window.confirm('Gửi kết quả đến CTSV và khóa sửa phiếu?')) {
                  void act(() => apiClient.sendFacultyResults(termId, [studentId]));
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D6FC2] px-4 py-2 text-xs font-semibold text-white hover:bg-[#175A9E] disabled:opacity-40 disabled:pointer-events-none transition-colors shadow-xs"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Gửi CTSV</span>
            </button>
          </div>
        </div>
      )}

      {/* Modern Segmented Navigation Tabs */}
      <div className="flex border-b border-slate-200">
        {[
          ['sheet', 'Nội dung đánh giá', FileText, null],
          ['evidence', 'Hồ sơ minh chứng', ShieldCheck, evidence.length],
          ...(!isAdmin ? [['appeals', 'Phúc khảo liên quan', AlertCircle, relatedAppeals.length]] : []),
          ['history', 'Lịch sử đánh giá', History, history.length],
        ].map(([key, label, Icon, badgeCount]: any) => {
          const isActive = tab === key;
          return (
            <button
              key={key}
              onClick={() =>
                setParams((p) => {
                  const n = new URLSearchParams(p);
                  n.set('tab', key);
                  n.set('termId', termId);
                  return n;
                })
              }
              className={`inline-flex items-center gap-2 px-4 py-3 text-xs font-semibold transition-all border-b-2 -mb-[1px] ${
                isActive
                  ? 'border-[#1D6FC2] text-[#1D6FC2]'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
              {badgeCount !== null && (
                <span
                  className={`rounded-full px-2 py-0.2 text-[10px] font-bold ${
                    isActive ? 'bg-blue-100 text-[#1D6FC2]' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-16 text-center text-xs text-slate-500">
          Đang tải thông tin chi tiết phiếu rèn luyện...
        </div>
      ) : !payload?.rubricVersion ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
          Kỳ này chưa có bộ tiêu chí đã ban hành. Không thể tạo dữ liệu thay thế.
        </div>
      ) : tab === 'sheet' ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[850px]">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3 px-4 w-[32%]">Tiêu chí đánh giá</th>
                  <th className="py-3 px-3 w-[7%] text-center">Tối đa</th>
                  <th className="py-3 px-3 w-[10%] text-center">SV tự chấm</th>
                  <th className="py-3 px-3 w-[11%] text-center">Minh chứng</th>
                  <th className="py-3 px-3 w-[14%] text-center">
                    <span className="inline-flex items-center gap-1 text-purple-700 font-bold">
                      <Sparkles className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                      <span>Điểm AI chấm</span>
                    </span>
                  </th>
                  <th className="py-3 px-3 w-[10%] text-center">Điểm Khoa</th>
                  <th className="py-3 px-3 w-[11%] text-center whitespace-nowrap min-w-[110px]">Trạng thái</th>
                  <th className="py-3 px-4 w-[5%] text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payload.categories.map((cat) => {
                  const catFinalized = cat.criteria.filter((c) => c.assessment?.status === 'FINALIZED').length;
                  const catOfficialTotal = Math.min(
                    cat.maxScore,
                    cat.criteria.reduce((n, c) => n + (c.assessment?.officialScore ?? 0), 0)
                  );
                  const catSuggestedTotal = Math.min(
                    cat.maxScore,
                    cat.criteria.reduce((n, c) => n + (c.assessment?.suggestedScore ?? 0), 0)
                  );
                  return (
                    <React.Fragment key={cat.key}>
                      <tr className="bg-slate-100/70 font-semibold text-slate-900 border-t border-b border-slate-200/80">
                        <td colSpan={2} className="py-2.5 px-4">
                          <span className="font-heading text-xs font-bold uppercase tracking-wide text-slate-800">
                            {cat.name}
                          </span>
                        </td>
                        <td colSpan={6} className="py-2.5 px-4 text-right text-xs text-slate-600">
                          <span className="inline-flex flex-wrap items-center justify-end gap-3">
                            <span className="text-slate-500">
                              {catFinalized}/{cat.criteria.length} tiêu chí hoàn tất
                            </span>
                            <span className="text-slate-300">·</span>
                            <span className="text-purple-700 font-bold inline-flex items-center gap-1">
                              <Sparkles className="h-3 w-3" />
                              AI chấm: {catSuggestedTotal} đ
                            </span>
                            <span className="text-slate-300">·</span>
                            <strong className="font-bold text-[#1D6FC2] tabular-nums">
                              Khoa chấm: {catOfficialTotal} / {cat.maxScore} đ
                            </strong>
                          </span>
                        </td>
                      </tr>
                      {cat.criteria.map((c) => {
                        const isFinalized = c.assessment?.status === 'FINALIZED';
                        const isReady = c.assessment?.status === 'READY_FOR_REVIEW';
                        return (
                          <tr
                            key={c.id}
                            id={'criterion-' + c.id}
                            className="hover:bg-blue-50/20 transition-colors align-top group"
                          >
                            <td className="py-3 px-4">
                              <button
                                className="text-left font-semibold text-xs text-slate-900 group-hover:text-[#1D6FC2] hover:underline flex items-start gap-1.5"
                                onClick={() => setOpened(c.id)}
                              >
                                <span className="font-mono text-[11px] font-bold text-[#1D6FC2] shrink-0 mt-0.5">
                                  {c.code}.
                                </span>
                                <span>{c.name}</span>
                              </button>
                              <div className="mt-0.5 pl-4 text-[11px] text-slate-400">
                                Nhấp để xem căn cứ và thẩm định
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center text-xs font-medium text-slate-500 tabular-nums">
                              {c.maxScore}
                            </td>
                            <td className="py-3 px-3 text-center text-xs font-semibold text-slate-800 tabular-nums">
                              {c.assessment?.selfScore !== null && c.assessment?.selfScore !== undefined
                                ? `${c.assessment.selfScore} đ`
                                : '—'}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <button
                                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-colors ${
                                  (c.assessment?.evidences?.length || 0) > 0
                                    ? 'bg-blue-50 text-[#1D6FC2] border border-blue-200 hover:bg-blue-100'
                                    : 'text-slate-400 hover:text-slate-600'
                                }`}
                                onClick={() => setOpened(c.id)}
                              >
                                <ShieldCheck className="h-3 w-3" />
                                <span>{c.assessment?.evidences?.length || 0} hồ sơ</span>
                              </button>
                            </td>
                            <td className="py-3 px-3 text-center text-xs tabular-nums">
                              {c.assessment?.suggestedScore !== null && c.assessment?.suggestedScore !== undefined ? (
                                <span className="inline-flex items-center gap-1 font-bold text-purple-700 bg-purple-50 border border-purple-200/90 rounded px-2 py-0.5">
                                  <Sparkles className="h-3 w-3 text-purple-600 shrink-0" />
                                  <span>{c.assessment.suggestedScore} đ</span>
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[11px] italic">Chờ căn cứ</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center font-heading font-extrabold text-xs text-slate-900 tabular-nums">
                              {c.assessment?.officialScore !== null && c.assessment?.officialScore !== undefined ? (
                                <span className="inline-flex items-center rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5">
                                  {c.assessment.officialScore} đ
                                </span>
                              ) : (
                                <span className="text-slate-300 font-normal">—</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center text-xs whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap shrink-0 border ${
                                  isFinalized
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : isReady
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                                    isFinalized ? 'bg-emerald-500' : isReady ? 'bg-amber-500' : 'bg-slate-400'
                                  }`}
                                />
                                {isFinalized ? 'Đã chốt' : isReady ? 'Chờ chốt' : 'Chưa có căn cứ'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => setOpened(c.id)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-[#1D6FC2] hover:text-[#1D6FC2] hover:bg-blue-50/50 transition-colors shadow-2xs"
                              >
                                <span>Thẩm định</span>
                                <ChevronRight className="h-3 w-3" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-900">
                  <td colSpan={4} className="py-3.5 px-4 text-xs text-slate-600">
                    Tổng kết điểm Khoa đang chấm ·{' '}
                    <strong className="text-[#1D6FC2] font-bold tabular-nums">
                      {count}/{criteria.length}
                    </strong>{' '}
                    tiêu chí đã chốt
                  </td>
                  <td className="py-3.5 px-3 text-center text-xs">
                    <span className="inline-flex items-center gap-1 font-bold text-purple-700 tabular-nums">
                      <Sparkles className="h-3.5 w-3.5" />
                      AI chấm: {suggestedTotal} đ
                    </span>
                  </td>
                  <td colSpan={3} className="py-3.5 px-4 text-right">
                    <span className="text-xs text-slate-500 mr-2">Tổng điểm Khoa:</span>
                    <span className="font-heading font-extrabold text-xl text-[#1D6FC2] tabular-nums">
                      {total}
                    </span>
                    <span className="text-xs font-semibold text-slate-500"> / 100 đ</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : tab === 'appeals' && !isAdmin ? (
        <section aria-label="Phúc khảo của sinh viên" className="space-y-3">
          {appealLoad === 'loading' ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-500">
              Đang tải danh sách phúc khảo liên quan...
            </div>
          ) : appealLoad === 'error' ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-xs text-red-800">
              Không tải được phúc khảo.{' '}
              <button className="underline font-semibold" onClick={() => setAppealRetry((n) => n + 1)}>
                Thử lại
              </button>
            </div>
          ) : relatedAppeals.length ? (
            relatedAppeals.map((appeal) => (
              <Link
                key={appeal.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 text-xs hover:border-[#1D6FC2] shadow-xs transition-colors"
                to={`/officer/appeals?termId=${encodeURIComponent(termId)}&status=&page=${appeal.page}&appealId=${encodeURIComponent(
                  appeal.id
                )}`}
              >
                <div>
                  <p className="font-medium text-slate-900">{appeal.content}</p>
                  <span className="mt-1 inline-block text-[11px] text-slate-500">
                    Trạng thái:{' '}
                    {({ PENDING: 'Chờ xử lý', ACCEPTED: 'Đã chấp thuận', REJECTED: 'Đã từ chối' } as Record<
                      string,
                      string
                    >)[appeal.status] || appeal.status}
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#1D6FC2]">
                  Xem đơn <ChevronRight className="h-4 w-4" />
                </span>
              </Link>
            ))
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-500">
              Không có đơn phúc khảo nào trong kỳ này đối với sinh viên này.
            </div>
          )}
        </section>
      ) : tab === 'evidence' ? (
        <div className="space-y-2.5">
          {evidence.map((e) => (
            <Link
              key={e.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-[#1D6FC2] transition-colors"
              to={
                isAdmin
                  ? `/admin/evidence/${e.id}?termId=${termId}&studentId=${studentId}`
                  : `/officer/review/${e.id}?termId=${termId}&studentId=${studentId}`
              }
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[#1D6FC2]">Mục {e.criterion.code}</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-xs text-slate-600">{e.criterion.name}</span>
                </div>
                <p className="font-heading font-bold text-sm text-slate-900">
                  {e.declaredActivityName || 'Hồ sơ minh chứng'}
                </p>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Trạng thái:</span>
                  <span className="font-medium text-slate-800">
                    {({ APPROVED: 'Hợp lệ', REJECTED: 'Từ chối', NEEDS_SUPPLEMENT: 'Cần bổ sung' } as Record<
                      string,
                      string
                    >)[e.status] || 'Chờ xác minh'}
                  </span>
                  {e.aiSuggestions?.[0] && (
                    <span className="text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-purple-600" />
                      AI chấm: {e.aiSuggestions[0].suggestedScore ?? '—'} đ
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-400" />
            </Link>
          ))}
          {!evidence.length && (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-500">
              Chưa có hồ sơ minh chứng nào được nộp cho phiếu này.
            </div>
          )}
        </div>
      ) : (
        <ol className="space-y-2.5">
          {history.map((h) => (
            <li key={h.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <strong className="text-xs font-bold text-slate-900">{h.action}</strong>
                <span className="text-slate-400 text-[11px]">{new Date(h.createdAt).toLocaleString('vi-VN')}</span>
              </div>
              <p className="text-slate-600">Thực hiện bởi: {h.user?.fullName || 'Hệ thống'}</p>
              {h.newValue?.reason && (
                <div className="mt-1 rounded-lg bg-slate-50 p-2.5 text-slate-800 border border-slate-200 text-xs">
                  {h.newValue.reason}
                </div>
              )}
            </li>
          ))}
          {!history.length && (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-500">
              Chưa có lịch sử thay đổi trên phiếu này.
            </div>
          )}
        </ol>
      )}

      {/* Criterion Detail Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          onClick={() => setOpened(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={'Đánh giá mục ' + selected.code}
            className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Thẩm định chi tiết
                </span>
                <h2 className="font-heading font-bold text-lg text-slate-900">
                  Mục {selected.code}: {selected.name}
                </h2>
              </div>
              <button
                autoFocus
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                onClick={() => setOpened(null)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <CriterionCard
              key={selected.id}
              studentId={studentId}
              termId={termId}
              criterion={selected}
              assessment={selected.assessment || null}
              readOnly={isReadOnly}
              onSaved={load}
            />
          </div>
        </div>
      )}
    </div>
  );
};
