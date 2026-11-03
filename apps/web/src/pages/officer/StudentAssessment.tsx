import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { apiClient } from '../../lib/apiClient';
import { Criterion, CriterionAssessment, RubricPayload, User } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/shared/PageHeader';
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
    <article className="space-y-4 rounded-[12px] border border-[#E8E8EC] bg-white p-5 shadow-xs">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between border-b border-[#E8E8EC] pb-3">
        <div>
          <span className="inline-block rounded-full bg-[#EBF3FC] px-2.5 py-0.5 text-xs font-semibold text-[#1D6FC2] mb-1">
            Mục {criterion.code}
          </span>
          <h3 className="font-heading font-semibold text-base text-[#0A0A0A]">{criterion.name}</h3>
          <p className="mt-1 whitespace-pre-line text-xs text-[#6B6B6B]">{criterion.description}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-heading font-bold text-sm text-[#0A0A0A]">
            Tối đa {criterion.maxScore} điểm
          </div>
          <div className="text-xs text-[#6B6B6B] mt-0.5">
            {assessment?.status === 'FINALIZED' ? (
              <span className="text-emerald-700 font-medium">Đã xác nhận điểm</span>
            ) : assessment?.status === 'READY_FOR_REVIEW' ? (
              <span className="text-amber-700 font-medium">Chờ duyệt điểm</span>
            ) : (
              <span className="text-[#8A8A8E]">Chờ xác minh căn cứ</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 rounded-[8px] border border-[#E8E8EC] bg-[#FAFAFA] p-3.5 text-xs sm:grid-cols-2">
        <div>
          <span className="font-semibold uppercase tracking-wider text-[#6B6B6B]">Sinh viên tự đánh giá:</span>
          <div className="mt-1 text-sm font-heading font-bold text-[#0A0A0A]">
            {assessment?.selfScore !== null && assessment?.selfScore !== undefined ? `${assessment.selfScore} đ` : 'Chưa nhập điểm'}{' '}
            <span className="text-xs font-normal text-[#6B6B6B]">/ {criterion.maxScore} đ</span>
          </div>
          {assessment?.selfNote && (
            <p className="mt-1 whitespace-pre-line text-xs text-[#6B6B6B] italic">{assessment.selfNote}</p>
          )}
        </div>
        <div>
          <span className="font-semibold uppercase tracking-wider text-[#6B6B6B]">Minh chứng và AI:</span>
          {assessment?.evidences?.length ? (
            <ul className="mt-1.5 space-y-1.5">
              {assessment.evidences.map((evidence) => (
                <li key={evidence.id} className="rounded-[6px] border border-[#E8E8EC] bg-white p-2">
                  <div className="flex items-center justify-between">
                    <Link
                      className="font-medium text-[#1D6FC2] hover:underline flex items-center gap-1"
                      to={`/officer/review/${evidence.id}`}
                    >
                      {evidence.declaredActivityName || 'Hồ sơ minh chứng'}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                    <span className="text-[11px] text-[#6B6B6B]">
                      {({ APPROVED: 'Hợp lệ', REJECTED: 'Từ chối', NEEDS_SUPPLEMENT: 'Cần bổ sung' } as Record<string, string>)[evidence.status] || 'Chờ xác minh'}
                    </span>
                  </div>
                  {evidence.aiSuggestions?.[0] && (
                    <p className="mt-1 text-[11px] text-[#1D6FC2] bg-[#EBF3FC] rounded px-1.5 py-0.5">
                      AI đề xuất: {evidence.aiSuggestions[0].suggestedScore ?? '—'} đ · {evidence.aiSuggestions[0].reasoning}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-[#8A8A8E]">Chưa nộp hồ sơ minh chứng.</p>
          )}
        </div>
      </div>

      {!!assessment?.verifiedData && (
        <div className="rounded-[8px] border border-[#E8E8EC] bg-white p-3.5 text-xs">
          <strong className="font-semibold uppercase tracking-wider text-[#0A0A0A]">Dữ liệu đã xác minh:</strong>
          <dl className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {Object.entries(assessment.verifiedData).map(([key, value]) => (
              <div key={key} className="flex gap-2 text-xs">
                <dt className="text-[#6B6B6B]">{fieldLabels[key] || key}:</dt>
                <dd className="font-medium text-[#0A0A0A]">{String(value)}</dd>
              </div>
            ))}
          </dl>
          {assessment.verificationNote && (
            <p className="mt-2 text-xs text-[#6B6B6B] border-t border-[#E8E8EC] pt-2">
              <strong>Căn cứ:</strong> {assessment.verificationNote}
            </p>
          )}
        </div>
      )}

      {/* Verification Drawer / Accordion */}
      <details className="group rounded-[8px] border border-[#E8E8EC] bg-[#FAFAFA] p-3.5">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-[#0A0A0A] hover:text-[#1D6FC2] transition-colors">
          Thẩm định căn cứ & Cập nhật dữ liệu tiêu chí
        </summary>
        <div className="mt-3.5 space-y-3 pt-3 border-t border-[#E8E8EC]">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map((key) => (
              <label key={key} className="text-xs font-medium text-[#0A0A0A]">
                {fieldLabels[key] || key}
                {booleanFields.has(key) ? (
                  <select
                    value={verifiedDraft[key] ?? ''}
                    disabled={readOnly}
                    onChange={(event) => setVerifiedDraft((current) => ({ ...current, [key]: event.target.value }))}
                    className="mt-1 w-full rounded-[6px] border border-[#E8E8EC] bg-white px-2.5 py-1.5 text-sm disabled:bg-[#F3F4F6] focus:border-[#1D6FC2] focus:outline-none"
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
                    className="mt-1 w-full rounded-[6px] border border-[#E8E8EC] bg-white px-2.5 py-1.5 text-sm disabled:bg-[#F3F4F6] focus:border-[#1D6FC2] focus:outline-none"
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
                    className="mt-1 w-full rounded-[6px] border border-[#E8E8EC] bg-white px-2.5 py-1.5 text-sm disabled:bg-[#F3F4F6] focus:border-[#1D6FC2] focus:outline-none"
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
                        ? 'Được tính từ hồ sơ đã duyệt'
                        : undefined
                    }
                    value={verifiedDraft[key] ?? ''}
                    onChange={(event) => setVerifiedDraft((current) => ({ ...current, [key]: event.target.value }))}
                    className="mt-1 w-full rounded-[6px] border border-[#E8E8EC] bg-white px-2.5 py-1.5 text-sm read-only:bg-[#F3F4F6] focus:border-[#1D6FC2] focus:outline-none"
                  />
                )}
              </label>
            ))}
            {criterion.scoringConfig?.kind === 'manual_verified' && (
              <label className="text-xs font-medium text-[#0A0A0A]">
                Điểm đề xuất theo căn cứ (0–{criterion.maxScore})
                <input
                  type="number"
                  min="0"
                  max={criterion.maxScore}
                  step="0.5"
                  disabled={readOnly}
                  value={verifiedDraft.officialScore ?? ''}
                  onChange={(event) => setVerifiedDraft((current) => ({ ...current, officialScore: event.target.value }))}
                  className="mt-1 w-full rounded-[6px] border border-[#E8E8EC] bg-white px-2.5 py-1.5 text-sm disabled:bg-[#F3F4F6] focus:border-[#1D6FC2] focus:outline-none"
                />
              </label>
            )}
          </div>

          <label className="block text-xs font-medium text-[#0A0A0A]">
            Nguồn / Căn cứ xác minh
            <textarea
              value={verificationNote}
              disabled={readOnly}
              onChange={(event) => setVerificationNote(event.target.value)}
              rows={2}
              className="mt-1 w-full rounded-[6px] border border-[#E8E8EC] bg-white p-2.5 text-sm text-[#0A0A0A] placeholder-[#8A8A8E] disabled:bg-[#F3F4F6] focus:border-[#1D6FC2] focus:outline-none"
              placeholder="Ghi nguồn dữ liệu trường, văn bản hoặc xác nhận đã kiểm tra…"
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
                  'Đã gửi dữ liệu xác minh để tính điểm đề xuất.'
                )
              }
              className="rounded-[6px] bg-[#0A0A0A] px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40 transition-colors"
            >
              Lưu xác minh & Tính điểm đề xuất
            </button>
          </div>
        </div>
      </details>

      {(assessment?.suggestionReason || assessment?.status === 'READY_FOR_REVIEW') && (
        <div className="rounded-[8px] border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950">
          <div>
            <strong>Đề xuất theo quy tắc:</strong>{' '}
            <span className="font-heading font-bold text-sm text-amber-900">
              {assessment?.suggestedScore ?? 'Chưa thể tính'} / {criterion.maxScore} điểm
            </span>
          </div>
          {assessment?.suggestionReason && <p className="mt-1 text-xs text-amber-800">{assessment.suggestionReason}</p>}
        </div>
      )}

      {assessment?.status === 'READY_FOR_REVIEW' && (
        <div className="grid gap-3 rounded-[8px] border border-emerald-200 bg-emerald-50/60 p-3.5 md:grid-cols-[140px_1fr_auto] md:items-end">
          <label className="text-xs font-semibold text-[#0A0A0A]">
            Điểm chính thức
            <input
              type="number"
              min="0"
              max={criterion.maxScore}
              step="0.5"
              value={finalScore}
              disabled={readOnly}
              onChange={(event) => setFinalScore(event.target.value)}
              className="mt-1 w-full rounded-[6px] border border-[#E8E8EC] bg-white px-2.5 py-1.5 text-sm font-heading font-semibold text-[#0A0A0A] disabled:bg-[#F3F4F6]"
            />
          </label>
          <label className="text-xs font-semibold text-[#0A0A0A]">
            Lý do điều chỉnh (bắt buộc nếu khác đề xuất)
            <input
              value={finalReason}
              disabled={readOnly}
              onChange={(event) => setFinalReason(event.target.value)}
              placeholder="Ghi rõ lý do điều chỉnh điểm…"
              className="mt-1 w-full rounded-[6px] border border-[#E8E8EC] bg-white px-2.5 py-1.5 text-sm disabled:bg-[#F3F4F6]"
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
            className="rounded-[6px] bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors shrink-0"
          >
            Xác nhận điểm
          </button>
        </div>
      )}

      {assessment?.status === 'FINALIZED' && (
        <div className="rounded-[8px] bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
          Điểm chính thức:{' '}
          <strong className="font-heading font-bold text-sm text-emerald-900">
            {assessment.officialScore} / {criterion.maxScore} đ
          </strong>
          {assessment.officialReason && <span> · {assessment.officialReason}</span>}
        </div>
      )}

      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      {message && <p role="status" className="text-xs text-emerald-700 font-medium">{message}</p>}
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
    setAppealLoad('loading'); setRelatedAppeals([]);
    (async () => {
      const found: Array<{ id: string; content: string; status: string; page: number }> = [];
      let page = 1, scanned = 0, total = 0;
      do {
        const response = await apiClient.getAppealsPage({ termId, page, pageSize: 100 });
        if (cancelled) return;
        response.items.forEach((appeal, index) => { if (appeal.studentId === studentId) found.push({ ...appeal, page: Math.floor((scanned + index) / 20) + 1 }); });
        scanned += response.items.length; total = response.total; page++;
        if (!response.items.length) break;
      } while (scanned < total);
      if (!cancelled) { setRelatedAppeals(found); setAppealLoad('ready'); }
    })().catch(() => { if (!cancelled) setAppealLoad('error'); });
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
  const count = criteria.filter((c) => c.assessment?.status === 'FINALIZED').length;
  const evidence = criteria.flatMap((c) => (c.assessment?.evidences || []).map((e) => ({ ...e, criterion: c })));

  const requestedReturn = params.get('returnTo') || '';
  const safeStaffReturn = ['/officer/students?', '/officer/queue?', '/officer/appeals?'].some(path => requestedReturn.startsWith(path));
  const returnUrl = isAdmin
    ? requestedReturn.startsWith('/admin/results?') ? requestedReturn : `/admin/results?termId=${termId}`
    : safeStaffReturn ? requestedReturn : `/officer/students?termId=${termId}`;

  return (
    <div className="space-y-6">
      {/* Top Navigation Back */}
      <div className="flex items-center gap-2">
        <Link
          to={returnUrl}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1D6FC2] hover:text-[#175A9E] hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Quay lại danh sách
        </Link>
      </div>

      <PageHeader
        title={`Chi tiết đánh giá · ${student?.fullName || 'Sinh viên'}`}
        description={`${student?.studentCode || '—'} · ${payload?.term?.name || activeTerm.name} · ${
          payload?.rubricVersion ? `Bộ tiêu chí phiên bản ${payload.rubricVersion.version}` : 'Chưa thiết lập bộ tiêu chí'
        }`}
        badge={
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              isReadOnly
                ? 'bg-[#F3F4F6] text-[#6B6B6B] border border-[#E8E8EC]'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}
          >
            {isReadOnly ? 'Chỉ xem' : 'Có quyền thẩm định'}
          </span>
        }
      />

      {error && (
        <div role="alert" className="rounded-[12px] border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {payload?.resultSource === 'HANDOFF_SNAPSHOT' && (
        <div className="rounded-[12px] border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-900">
          Bản bàn giao Khoa gửi · Phiên bản {payload.handoffRevision}. Điểm hiển thị từ bản snapshot đã lưu khi gửi CTSV.
        </div>
      )}

      {payload?.permissions?.sendBlockers?.length && !isReadOnly ? (
        <div className="rounded-[12px] border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
          <strong>Chưa thể gửi CTSV:</strong> {payload.permissions.sendBlockers.join('; ')}
        </div>
      ) : null}

      {payload?.handoff?.returnReason && (
        <div className="rounded-[12px] border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
          <strong>Lý do CTSV trả kết quả:</strong> {payload.handoff.returnReason}
        </div>
      )}

      {payload?.submission?.returnReason && (
        <div className="rounded-[12px] border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
          <strong>Yêu cầu sinh viên sửa:</strong> {payload.submission.returnReason}
        </div>
      )}

      {isReadOnly && (
        <div className="rounded-[12px] border border-[#E8E8EC] bg-[#FAFAFA] p-3.5 text-xs text-[#6B6B6B]">
          {payload?.term?.status === 'CLOSED'
            ? 'Kỳ đã chốt sổ chính thức.'
            : isAdmin
            ? 'CTSV xem căn cứ và tiếp nhận kết quả; Khoa chịu trách nhiệm chấm điểm.'
            : payload?.handoff?.status === 'SENT'
            ? 'Kết quả đã gửi CTSV. Phiếu được khóa cho đến khi được trả lại hoặc mở phúc khảo.'
            : 'Sinh viên chưa nộp hoặc đang chỉnh sửa; phiếu chỉ được xem.'}
        </div>
      )}

      {/* Action Bar for Officer */}
      {!isReadOnly && (
        <div className="flex flex-wrap items-center gap-3 rounded-[12px] border border-[#E8E8EC] bg-white p-3.5 shadow-xs">
          <input
            aria-label="Lý do trả phiếu"
            placeholder="Lý do cần sinh viên sửa / bổ sung minh chứng…"
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
            className="min-w-0 flex-1 rounded-[6px] border border-[#E8E8EC] bg-[#FAFAFA] px-3 py-2 text-sm text-[#0A0A0A] placeholder-[#8A8A8E] focus:bg-white focus:border-[#1D6FC2] focus:outline-none transition-colors"
          />
          <button
            disabled={busy || !returnReason.trim()}
            onClick={() => void act(() => apiClient.returnSelfAssessment(studentId, termId, returnReason))}
            className="inline-flex items-center gap-1.5 rounded-[6px] border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            <CornerUpLeft className="h-4 w-4" />
            Trả sinh viên
          </button>
          <button
            disabled={busy || !payload?.permissions?.canSend}
            onClick={() => {
              if (window.confirm('Gửi kết quả đến CTSV và khóa sửa phiếu?')) {
                void act(() => apiClient.sendFacultyResults(termId, [studentId]));
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#1D6FC2] px-4 py-2 text-xs font-semibold text-white hover:bg-[#175A9E] disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            <Send className="h-4 w-4" />
            Gửi CTSV
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[#E8E8EC]">
        {[
          ['sheet', 'Nội dung đánh giá', FileText],
          ['evidence', `Minh chứng (${evidence.length})`, ShieldCheck],
          ...(!isAdmin ? [['appeals', 'Phúc khảo liên quan', FileText]] : []),
          ['history', `Lịch sử (${history.length})`, History],
        ].map(([key, label, Icon]: any) => (
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
            className={`inline-flex items-center gap-1.5 px-4 py-3 text-xs font-semibold transition-colors border-b-2 -mb-[1px] ${
              tab === key
                ? 'border-[#1D6FC2] text-[#1D6FC2]'
                : 'border-transparent text-[#6B6B6B] hover:text-[#0A0A0A]'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-[12px] border border-[#E8E8EC] bg-white p-12 text-center text-sm text-[#6B6B6B]">
          Đang tải thông tin phiếu rèn luyện…
        </div>
      ) : !payload?.rubricVersion ? (
        <div className="rounded-[12px] border border-[#E8E8EC] bg-white p-6 text-sm text-[#6B6B6B]">
          Kỳ này chưa có bộ tiêu chí đã ban hành. Không thể tạo dữ liệu thay thế.
        </div>
      ) : tab === 'sheet' ? (
        <div className="overflow-hidden rounded-[12px] border border-[#E8E8EC] bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="border-b border-[#E8E8EC] bg-[#FAFAFA] text-xs font-semibold uppercase tracking-wider text-[#6B6B6B]">
                <tr>
                  <th className="py-3 px-4 w-[35%]">Tiêu chí</th>
                  <th className="py-3 px-3 w-[8%] text-center">Tối đa</th>
                  <th className="py-3 px-3 w-[12%] text-center">SV tự chấm</th>
                  <th className="py-3 px-3 w-[12%] text-center">Minh chứng</th>
                  <th className="py-3 px-3 w-[12%] text-center">Quy tắc</th>
                  <th className="py-3 px-3 w-[10%] text-center">Cán bộ</th>
                  <th className="py-3 px-4 w-[11%] text-right">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E8EC]">
                {payload.categories.map((cat) => (
                  <React.Fragment key={cat.key}>
                    <tr className="bg-[#F8FAFC] font-semibold text-[#0A0A0A]">
                      <td colSpan={2} className="py-3 px-4">
                        <span className="font-heading text-sm">{cat.name}</span>
                      </td>
                      <td colSpan={5} className="py-3 px-4 text-right text-xs text-[#6B6B6B]">
                        {cat.criteria.filter((c) => c.assessment?.status === 'FINALIZED').length}/{cat.criteria.length} mục hoàn tất ·{' '}
                        <strong className="text-[#0A0A0A]">
                          {Math.min(
                            cat.maxScore,
                            cat.criteria.reduce((n, c) => n + (c.assessment?.officialScore ?? 0), 0)
                          )}
                          /{cat.maxScore}
                        </strong>{' '}
                        điểm Khoa
                      </td>
                    </tr>
                    {cat.criteria.map((c) => (
                      <tr key={c.id} id={'criterion-' + c.id} className="hover:bg-[#F9FAFB] transition-colors align-top">
                        <td className="py-3 px-4">
                          <button
                            className="text-left font-medium text-[#1D6FC2] hover:text-[#175A9E] hover:underline"
                            onClick={() => setOpened(c.id)}
                          >
                            {c.code}. {c.name}
                          </button>
                          <p className="mt-0.5 text-[11px] text-[#8A8A8E]">Mở để xem căn cứ và xác minh</p>
                        </td>
                        <td className="py-3 px-3 text-center text-xs font-medium text-[#6B6B6B]">{c.maxScore}</td>
                        <td className="py-3 px-3 text-center text-xs font-semibold text-[#0A0A0A]">
                          {c.assessment?.selfScore !== null && c.assessment?.selfScore !== undefined
                            ? `${c.assessment.selfScore} đ`
                            : '—'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            className="inline-flex items-center gap-1 text-xs font-medium text-[#1D6FC2] hover:underline"
                            onClick={() => setOpened(c.id)}
                          >
                            {c.assessment?.evidences?.length || 0} hồ sơ
                          </button>
                        </td>
                        <td className="py-3 px-3 text-center text-xs text-[#6B6B6B]">
                          {c.assessment?.suggestedScore !== null && c.assessment?.suggestedScore !== undefined
                            ? `${c.assessment.suggestedScore} đ`
                            : 'Chờ xác minh'}
                        </td>
                        <td className="py-3 px-3 text-center font-heading font-bold text-xs text-[#0A0A0A]">
                          {c.assessment?.officialScore !== null && c.assessment?.officialScore !== undefined
                            ? `${c.assessment.officialScore} đ`
                            : '—'}
                        </td>
                        <td className="py-3 px-4 text-right text-xs">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              c.assessment?.status === 'FINALIZED'
                                ? 'bg-emerald-50 text-emerald-700'
                                : c.assessment?.status === 'READY_FOR_REVIEW'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-[#F3F4F6] text-[#6B6B6B]'
                            }`}
                          >
                            {c.assessment?.status === 'FINALIZED'
                              ? 'Đã chốt'
                              : c.assessment?.status === 'READY_FOR_REVIEW'
                              ? 'Chờ chốt'
                              : 'Thiếu căn cứ'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#E8E8EC] bg-[#FAFAFA] font-semibold text-[#0A0A0A]">
                  <td colSpan={5} className="py-3.5 px-4 text-xs">
                    Điểm Khoa đang chấm · <strong className="text-[#1D6FC2]">{count}/{criteria.length}</strong> tiêu chí hoàn tất
                  </td>
                  <td colSpan={2} className="py-3.5 px-4 text-right font-heading font-bold text-base text-[#1D6FC2]">
                    {total} / 100 đ
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : tab === 'appeals' && !isAdmin ? (
        <section aria-label="Phúc khảo của sinh viên" className="space-y-3">
          {appealLoad === 'loading' ? <p role="status">Đang tải phúc khảo liên quan…</p> : appealLoad === 'error' ? <p role="alert">Không tải được phúc khảo. <button className="underline" onClick={() => setAppealRetry(n => n + 1)}>Thử lại</button></p> : relatedAppeals.length ? relatedAppeals.map(appeal => <Link key={appeal.id} className="block rounded-xl border bg-white p-4 text-sm hover:border-[#1D6FC2]" to={`/officer/appeals?termId=${encodeURIComponent(termId)}&status=&page=${appeal.page}&appealId=${encodeURIComponent(appeal.id)}`}><p>{appeal.content}</p><span className="text-[#1D6FC2]">{({ PENDING: 'Chờ xử lý', ACCEPTED: 'Đã chấp thuận', REJECTED: 'Đã từ chối' } as Record<string, string>)[appeal.status] || appeal.status} · Xem đơn →</span></Link>) : <p>Không có phúc khảo liên quan trong kỳ này.</p>}
        </section>
      ) : tab === 'evidence' ? (
        <div className="space-y-2">
          {evidence.map((e) => (
            <Link
              key={e.id}
              className="flex items-center justify-between rounded-[12px] border border-[#E8E8EC] bg-white p-4 shadow-xs hover:border-[#1D6FC2] transition-colors"
              to={
                isAdmin
                  ? `/admin/evidence/${e.id}?termId=${termId}&studentId=${studentId}`
                  : `/officer/review/${e.id}?termId=${termId}&studentId=${studentId}`
              }
            >
              <div>
                <span className="text-xs font-semibold text-[#1D6FC2]">Mục {e.criterion.code}</span>
                <p className="font-heading font-semibold text-sm text-[#0A0A0A] mt-0.5">
                  {e.declaredActivityName || 'Minh chứng'}
                </p>
                <p className="text-xs text-[#6B6B6B] mt-0.5">
                  Trạng thái: {({ APPROVED: 'Hợp lệ', REJECTED: 'Từ chối', NEEDS_SUPPLEMENT: 'Cần bổ sung' } as Record<string, string>)[e.status] || 'Chờ xác minh'}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-[#8A8A8E]" />
            </Link>
          ))}
          {!evidence.length && (
            <p className="rounded-[12px] border border-[#E8E8EC] bg-white p-8 text-center text-sm text-[#6B6B6B]">
              Chưa có hồ sơ minh chứng nào được nộp cho phiếu này.
            </p>
          )}
        </div>
      ) : (
        <ol className="space-y-2">
          {history.map((h) => (
            <li
              key={h.id}
              className="rounded-[12px] border border-[#E8E8EC] bg-white p-4 shadow-xs text-xs space-y-1"
            >
              <div className="flex items-center justify-between">
                <strong className="text-sm font-semibold text-[#0A0A0A]">{h.action}</strong>
                <span className="text-[#8A8A8E]">{new Date(h.createdAt).toLocaleString('vi-VN')}</span>
              </div>
              <p className="text-[#6B6B6B]">Thực hiện bởi: {h.user?.fullName || 'Hệ thống'}</p>
              {h.newValue?.reason && (
                <p className="mt-1 rounded bg-[#FAFAFA] p-2 text-[#0A0A0A] border border-[#E8E8EC]">
                  {h.newValue.reason}
                </p>
              )}
            </li>
          ))}
          {!history.length && (
            <p className="rounded-[12px] border border-[#E8E8EC] bg-white p-8 text-center text-sm text-[#6B6B6B]">
              Chưa có lịch sử thay đổi trên phiếu này.
            </p>
          )}
        </ol>
      )}

      {/* Criterion Detail Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
          onClick={() => setOpened(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={'Đánh giá mục ' + selected.code}
            className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[12px] bg-white p-6 shadow-2xl border border-[#E8E8EC] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#E8E8EC] pb-3">
              <h2 className="font-heading font-semibold text-base text-[#0A0A0A]">
                Thẩm định chi tiết · Mục {selected.code}
              </h2>
              <button
                autoFocus
                className="rounded-[6px] p-1 text-[#6B6B6B] hover:bg-[#F3F4F6] hover:text-[#0A0A0A] transition-colors"
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
