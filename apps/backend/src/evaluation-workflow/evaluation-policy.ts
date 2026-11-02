// The same policy is used by queue readiness, handoff and publication validation.
export const unresolvedEvidenceStatuses = ['PROCESSING', 'PLAUSIBLE', 'VERIFIED', 'NEEDS_HUMAN_REVIEW', 'NEEDS_SUPPLEMENT', 'APPEALING', 'INVALID'] as const;
export const classification = (score: number) => score >= 90 ? 'Xuất sắc' : score >= 80 ? 'Tốt' : score >= 65 ? 'Khá' : score >= 50 ? 'Trung bình' : 'Yếu';
export function sendBlockers(submitted: boolean, complete: boolean, pendingEvidence: number, pendingAppeals: number) {
  return [!submitted && 'Sinh viên chưa nộp phiếu', !complete && 'Chưa xác minh và chốt đủ tiêu chí', pendingEvidence > 0 && `${pendingEvidence} minh chứng chưa xử lý`, pendingAppeals > 0 && `${pendingAppeals} phúc khảo chờ xử lý`].filter(Boolean) as string[];
}
export function sumCategory(maxScore: number, scores: Array<number | null | undefined>) {
  return Math.min(maxScore, scores.reduce<number>((sum, score) => sum + (score ?? 0), 0));
}
