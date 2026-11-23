import { Criterion } from '../types';

export interface EvidenceRequirementPolicy {
  kind: 'AUTO_SYNC' | 'DEFAULT_PASS' | 'REQUIRED';
  badgeLabel: string;
  hint: string;
  officerHint: string;
  required: boolean;
}

const AUTO_SYNC_SCORING_KINDS = new Set([
  'attendance_penalty',
  'academic_effort',
  'conduct_penalty',
  'all_conditions',
]);

const DEFAULT_PASS_SCORING_KINDS = new Set([
  'group_penalty',
  'manual_verified',
]);

const AUTO_SYNC_FALLBACK_CODES = new Set(['1', '3', '7', '11']);
const DEFAULT_PASS_FALLBACK_CODES = new Set(['2', '6']);

export function getCriterionEvidencePolicy(
  criterion: Pick<Criterion, 'code' | 'scoringConfig'>,
): EvidenceRequirementPolicy {
  const kind = typeof criterion.scoringConfig?.kind === 'string' ? criterion.scoringConfig.kind : '';
  const code = String(criterion.code ?? '').trim();

  if (AUTO_SYNC_SCORING_KINDS.has(kind) || (!kind && AUTO_SYNC_FALLBACK_CODES.has(code))) {
    return {
      kind: 'AUTO_SYNC',
      badgeLabel: 'Học vụ tự động',
      hint: 'Dữ liệu nhà trường đồng bộ, không cần nộp file',
      officerHint: 'Tiêu chí miễn nộp minh chứng — đối chiếu từ dữ liệu học vụ / CTSV.',
      required: false,
    };
  }
  if (DEFAULT_PASS_SCORING_KINDS.has(kind) || (!kind && DEFAULT_PASS_FALLBACK_CODES.has(code))) {
    return {
      kind: 'DEFAULT_PASS',
      badgeLabel: 'Mặc định đạt',
      hint: 'Lớp tự quản / mặc định, không cần nộp file',
      officerHint: 'Tiêu chí miễn nộp minh chứng — đánh giá mặc định / lớp sinh hoạt tự quản.',
      required: false,
    };
  }
  return {
    kind: 'REQUIRED',
    badgeLabel: 'Bắt buộc minh chứng',
    hint: 'Tiêu chí này bắt buộc phải nộp minh chứng hoặc có xác nhận hoạt động để được xét duyệt',
    officerHint: 'Chưa có hồ sơ minh chứng đính kèm (cần minh chứng hoặc điểm danh xác nhận).',
    required: true,
  };
}
