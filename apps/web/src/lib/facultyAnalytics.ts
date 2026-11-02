import type { EvaluationData, EvaluationRow } from '../components/EvaluationBoard';

export const facultyStates = [
  { key: 'NOT_SUBMITTED', label: 'Chưa nộp', color: '#64748B' },
  { key: 'STUDENT_RETURNED', label: 'Sinh viên cần sửa', color: '#EA580C' },
  { key: 'REVIEWING', label: 'Khoa đang chấm', color: '#D97706' },
  { key: 'FACULTY_RETURNED', label: 'CTSV trả Khoa', color: '#DC2626' },
  { key: 'READY', label: 'Sẵn sàng gửi', color: '#0284C7' },
  { key: 'SENT', label: 'Chờ CTSV công bố', color: '#1D6FC2' },
  { key: 'PUBLISHED', label: 'Đã công bố', color: '#059669' },
  { key: 'NOT_SUBMITTED_RECORDED', label: 'Ghi nhận không nộp', color: '#BE123C' },
] as const;
export type FacultyState = typeof facultyStates[number]['key'];
export type StateCounts = Record<FacultyState, number>;
export type FacultyClassProgress = {
  id: string; code: string; total: number; counts: StateCounts;
  notSubmitted: number; processing: number; ready: number;
  sent: number; published: number; handedOver: number;
  recorded: number; remaining: number; rate: number;
};
export type ClassWorkStatus = 'NEEDS_ACTION' | 'WAITING' | 'READY' | 'COMPLETE';
export type ClassWorkflowSummary = FacultyClassProgress & {
  processed: number;
  processedRate: number;
  facultyReturned: number;
  studentReturned: number;
  reviewing: number;
  readyToSend: number;
  waitingPublication: number;
  humanReviewEvidences: number;
  pendingAppeals: number;
  unresolvedEvidences: number;
  openWork: number;
  status: ClassWorkStatus;
};
export type ClassWorkBreakdown = {
  reviewing: number;
  facultyReturned: number;
  humanReviewEvidences: number;
  pendingAppeals: number;
  studentReturned: number;
  supplementEvidences: number;
  processingEvidences: number;
  ready: number;
  sent: number;
  published: number;
  recordedNotSubmitted: number;
};
export type EvidenceQueueSummary = {
  NEEDS_HUMAN_REVIEW: number;
  NEEDS_SUPPLEMENT: number;
  PROCESSING: number;
  APPROVED: number;
  REJECTED: number;
  decided: number;
};
export type FacultyKpi = {
  totalEvidences: number; approvedEvidences: number; rejectedEvidences: number;
  pendingEvidences: number; pendingAppeals: number; updatedAt: string;
};
export type FacultyReport = {
  term: { id: string }; total: number; totalEvaluated: number; pendingStudents: number;
  averageScore: number | null; source: string; updatedAt: string;
};
export const percentage = (value: number, total: number) => total > 0 ? Math.round(value * 1000 / total) / 10 : 0;
export function countFacultyStates(rows: EvaluationRow[]): StateCounts {
  const counts = Object.fromEntries(facultyStates.map(state => [state.key, 0])) as StateCounts;
  for (const row of rows) {
    if (!Object.prototype.hasOwnProperty.call(counts, row.state)) throw new Error('Có trạng thái phiếu chưa được hỗ trợ. Vui lòng tải lại.');
    counts[row.state as FacultyState]++;
  }
  return counts;
}
export function validateFacultyRows(rows: EvaluationRow[], data: EvaluationData) {
  if (rows.length !== data.total || new Set(rows.map(row => row.studentId)).size !== data.total)
    throw new Error('Danh sách sinh viên đã thay đổi hoặc chưa tải đủ. Hãy tải lại thống kê.');
  const counts = countFacultyStates(rows);
  const expected: Record<string, number> = {
    notSubmitted: counts.NOT_SUBMITTED, reviewing: counts.REVIEWING,
    returned: counts.STUDENT_RETURNED + counts.FACULTY_RETURNED, ready: counts.READY,
    sent: counts.SENT + counts.PUBLISHED, published: counts.PUBLISHED,
    recordedNotSubmitted: counts.NOT_SUBMITTED_RECORDED,
  };
  if (Object.entries(expected).some(([key, value]) => data.summary[key] !== value))
    throw new Error('Trạng thái phiếu thay đổi trong lúc tổng hợp. Hãy tải lại thống kê.');
}
export function aggregateFacultyClasses(rows: EvaluationRow[]): FacultyClassProgress[] {
  const groups = new Map<string, EvaluationRow[]>();
  for (const row of rows) {
    if (!groups.has(row.classId)) groups.set(row.classId, []);
    groups.get(row.classId)!.push(row);
  }
  return [...groups].map(([id, items]) => {
    const counts = countFacultyStates(items), total = items.length;
    const sent = counts.SENT;
    const published = counts.PUBLISHED;
    const handedOver = sent + published;
    const remaining = total - handedOver - counts.NOT_SUBMITTED_RECORDED;
    return { id, code: items[0].class?.code || 'Chưa phân lớp', total, counts,
      notSubmitted: counts.NOT_SUBMITTED,
      processing: counts.REVIEWING + counts.STUDENT_RETURNED + counts.FACULTY_RETURNED,
      ready: counts.READY,
      sent, published, handedOver,
      recorded: counts.NOT_SUBMITTED_RECORDED, remaining, rate: percentage(handedOver, total) };
  }).sort((a, b) => b.remaining / b.total - a.remaining / a.total || b.remaining - a.remaining || a.code.localeCompare(b.code, 'vi'));
}

export function aggregateClassWorkflow(
  rows: EvaluationRow[],
  humanReviewByClass: Record<string, number> = {},
  appealsByClass: Record<string, number> = {},
): ClassWorkflowSummary[] {
  return aggregateFacultyClasses(rows).map(cls => {
    const classRows = rows.filter(row => row.classId === cls.id);
    const unresolvedEvidences = classRows.reduce((sum, row) => sum + row.pendingEvidence, 0);
    const humanReviewEvidences = humanReviewByClass[cls.id] || 0;
    const pendingAppeals = appealsByClass[cls.id] || 0;
    const processed = cls.counts.READY + cls.counts.SENT + cls.counts.PUBLISHED + cls.counts.NOT_SUBMITTED_RECORDED;
    const directAction = cls.counts.REVIEWING + cls.counts.FACULTY_RETURNED + humanReviewEvidences + pendingAppeals;
    const openWork = cls.counts.REVIEWING + cls.counts.FACULTY_RETURNED + cls.counts.STUDENT_RETURNED + unresolvedEvidences + pendingAppeals;
    const waiting = cls.counts.NOT_SUBMITTED + cls.counts.STUDENT_RETURNED + Math.max(0, unresolvedEvidences - humanReviewEvidences);
    const status: ClassWorkStatus = directAction > 0
      ? 'NEEDS_ACTION'
      : waiting > 0
      ? 'WAITING'
      : cls.counts.READY > 0
      ? 'READY'
      : processed === cls.total
      ? 'COMPLETE'
      : 'WAITING';
    return {
      ...cls,
      processed,
      processedRate: percentage(processed, cls.total),
      facultyReturned: cls.counts.FACULTY_RETURNED,
      studentReturned: cls.counts.STUDENT_RETURNED,
      reviewing: cls.counts.REVIEWING,
      readyToSend: cls.counts.READY,
      waitingPublication: cls.counts.SENT,
      humanReviewEvidences,
      pendingAppeals,
      unresolvedEvidences,
      openWork,
      status,
    };
  }).sort((a, b) => {
    const priority: Record<ClassWorkStatus, number> = { NEEDS_ACTION: 0, WAITING: 1, READY: 2, COMPLETE: 3 };
    return priority[a.status] - priority[b.status] || b.openWork - a.openWork || a.code.localeCompare(b.code, 'vi');
  });
}
