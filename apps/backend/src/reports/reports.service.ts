import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { WorkflowActor, WorkflowService } from '../evaluation-workflow/workflow.service';
import { WorkflowQueryDto } from '../evaluation-workflow/dto/workflow-query.dto';
import { classification } from '../evaluation-workflow/evaluation-policy';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService, private workflow: WorkflowService) {}

  private async data(actor: WorkflowActor, termId?: string, query: WorkflowQueryDto = new WorkflowQueryDto()) {
    const term = termId ? await this.prisma.term.findUnique({ where: { id: termId } }) : await this.prisma.term.findFirst({ orderBy: [{ startDate: 'desc' }] });
    if (!term) throw new NotFoundException('Chưa có kỳ đánh giá');
    return this.workflow.list(actor, term.id, query, true);
  }

  async results(actor: WorkflowActor, termId?: string, query: WorkflowQueryDto = new WorkflowQueryDto(), unpaged = false) {
    const data = await this.data(actor, termId, query);
    const publications = await this.prisma.assessmentPublication.findMany({ where: { termId: data.term.id, studentId: { in: data.items.map(r => r.studentId) } }, orderBy: { revision: 'desc' } });
    const latest = new Map<string, typeof publications[number]>();
    for (const p of publications) if (!latest.has(p.studentId)) latest.set(p.studentId, p);
    const items = await Promise.all(data.items.map(async row => {
      const publication = latest.get(row.studentId);
      const published = publication?.snapshot as { totalScore?: number } | undefined;
      const legacy = !data.term.workflowEnabled && row.rubricVersionId ? await this.workflow.snapshot(this.prisma, row.studentId, data.term.id, row.rubricVersionId) : null;
      const officialScore = published?.totalScore ?? (legacy?.complete ? legacy.totalScore : null);
      return { ...row, officialScore, classification: officialScore === null ? 'Chưa công bố' : classification(officialScore), publicationRevision: publication?.revision ?? null, source: publication ? 'PUBLICATION' : legacy?.complete ? 'LEGACY_RUBRIC' : 'UNPUBLISHED' };
    }));
    const completed = items.filter(r => r.officialScore !== null);
    const distribution = { XUAT_SAC: 0, TOT: 0, KHA: 0, TRUNG_BINH: 0, YEU: 0 };
    for (const row of completed) { const n = row.officialScore!; distribution[n >= 90 ? 'XUAT_SAC' : n >= 80 ? 'TOT' : n >= 65 ? 'KHA' : n >= 50 ? 'TRUNG_BINH' : 'YEU']++; }
    const classProgress = [...new Set(items.map(r => r.classId))].map(id => {
      const rows = items.filter(r => r.classId === id);
      const scored = rows.filter(r => r.officialScore !== null);
      return { id, code: rows[0]?.class?.code, total: rows.length, completed: scored.length, pending: rows.length - scored.length, average: scored.length ? Number((scored.reduce((n,r) => n + r.officialScore!, 0) / scored.length).toFixed(2)) : null };
    });
    return { ...data, classProgress, items: unpaged ? items : items.slice((data.page - 1) * data.pageSize, data.page * data.pageSize), source: data.term.workflowEnabled ? 'LATEST_PUBLICATION' : 'LEGACY_RUBRIC', totalEvaluated: completed.length, pendingStudents: items.length - completed.length, averageScore: completed.length ? Number((completed.reduce((n,r) => n + r.officialScore!, 0) / completed.length).toFixed(2)) : null, distribution };
  }

  async getKpiSummary(actor: WorkflowActor, termId?: string) {
    const data = await this.data(actor, termId);
    const evidence = await this.prisma.evidence.groupBy({ by: ['status'], where: { termId: data.term.id, studentId: { in: data.items.map(r => r.studentId) } }, _count: { _all: true } });
    const count = (states: string[]) => evidence.filter(e => states.includes(e.status)).reduce((n,e) => n + e._count._all, 0);
    const totalEvidences = count(evidence.map(e => e.status));
    const approvedEvidences = count(['APPROVED']);
    const rejectedEvidences = count(['REJECTED']);
    return { ...data.summary, totalStudents: data.total, totalEvidences, approvedEvidences, rejectedEvidences, pendingEvidences: data.items.reduce((n,r) => n + r.pendingEvidence, 0), reviewRate: totalEvidences ? Math.round(100 * (approvedEvidences + rejectedEvidences) / totalEvidences) : 0, submittedStudents: data.items.filter(r => r.submissionStatus === 'SUBMITTED').length, returnedStudents: data.summary.returned, finalizedCriteria: data.items.reduce((n,r) => n + r.finalizedCriteria, 0), totalCriteria: data.items.reduce((n,r) => n + r.totalCriteria, 0), termId: data.term.id, updatedAt: data.updatedAt };
  }

  async getDistribution(actor: WorkflowActor, termId?: string, facultyId?: string) {
    const { distribution, totalEvaluated, pendingStudents, averageScore, term, source, updatedAt } = await this.results(actor, termId, Object.assign(new WorkflowQueryDto(), { facultyId }));
    return { distribution, totalEvaluated, pendingStudents, averageScore, termId: term.id, source, updatedAt };
  }

  async getFacultyProgress(actor: WorkflowActor, termId?: string) {
    const data = await this.data(actor, termId);
    return data.facultyProgress.map(f => ({ ...f, totalStudents: f.total, submittedStudents: data.items.filter(r => r.facultyId === f.id && r.submissionStatus === 'SUBMITTED').length, termId: data.term.id, updatedAt: data.updatedAt }));
  }
}
