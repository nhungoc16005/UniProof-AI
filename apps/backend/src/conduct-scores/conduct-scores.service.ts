import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { WorkflowService } from '../evaluation-workflow/workflow.service';
import { ReportsService } from '../reports/reports.service';
import { WorkflowQueryDto } from '../evaluation-workflow/dto/workflow-query.dto';
import { classification, sumCategory } from '../evaluation-workflow/evaluation-policy';
import { EvidenceStatus, TermStatus } from '@prisma/client';

@Injectable()
export class ConductScoresService {
  constructor(private prisma: PrismaService, private workflow: WorkflowService, private reports: ReportsService) {}

  async getDashboard(studentId: string, termId?: string, staffView = false) {
    // 1. Xác định kỳ học
    let activeTermId = termId;
    if (!activeTermId) {
      const activeTerm = await this.prisma.term.findFirst({ where: { status: TermStatus.ACTIVE } });
      activeTermId = activeTerm?.id;
    }

    if (!activeTermId) {
      const latestTerm = await this.prisma.term.findFirst({ orderBy: { startDate: 'desc' } });
      activeTermId = latestTerm?.id;
    }

    if (!activeTermId) {
      return {
        officialScore: 0,
        pendingScore: 0,
        classification: 'CHƯA_XẾP_LOẠI',
        categories: [],
      };
    }

    const rubricVersion = await this.prisma.rubricVersion.findFirst({
      where: { termId: activeTermId, status: 'PUBLISHED' },
      include: { categories: { orderBy: { position: 'asc' }, include: { criteria: { orderBy: { code: 'asc' } } } } },
      orderBy: { version: 'desc' },
    });
    const term = await this.prisma.term.findUnique({ where: { id: activeTermId } });
    if (rubricVersion && term?.workflowEnabled && !staffView) {
      const publication = await this.workflow.publication(studentId, activeTermId);
      const published = publication?.snapshot as any;
      return {
        termId: activeTermId, rubricVersion: { id: rubricVersion.id, version: rubricVersion.version },
        officialScore: published?.totalScore ?? null, scoreInProgress: null,
        classification: published?.classification ?? 'CHƯA CÔNG BỐ',
        status: publication ? term.status === 'CLOSED' ? 'FINAL' : 'PROVISIONAL' : 'NOT_PUBLISHED',
        publication: publication ? { revision: publication.revision, publishedAt: publication.publishedAt } : null,
        appealDeadline: term.appealDeadline,
        categories: published?.categories ?? rubricVersion.categories.map(c => ({ key: c.code, name: c.name, maxScore: c.maxScore, score: null, criteria: c.criteria })),
        recentEvidences: [],
      };
    }
    if (rubricVersion) {
      const [assessments, recentEvidences] = await Promise.all([
        this.prisma.criterionAssessment.findMany({
          where: { studentId, termId: activeTermId, criterion: { rubricVersionId: rubricVersion.id } },
          include: { criterion: true },
        }),
        this.prisma.evidence.findMany({
          where: { studentId, termId: activeTermId },
          orderBy: { submittedAt: 'desc' },
          take: 5,
          include: { reviews: { orderBy: { createdAt: 'desc' }, take: 1 } },
        }),
      ]);
      const byCriterion = new Map(assessments.map((assessment) => [assessment.criterionId, assessment]));
      let totalScore = 0;
      let finalizedCount = 0;
      const categories = rubricVersion.categories.map((category) => {
        let score = 0;
        const criteria = category.criteria.map((criterion) => {
          const assessment = byCriterion.get(criterion.id) || null;
          if (assessment?.status === 'FINALIZED' && assessment.officialScore !== null) {
            score += assessment.officialScore;
            finalizedCount++;
          }
          return { ...criterion, assessment };
        });
        score = sumCategory(category.maxScore, [score]);
        totalScore += score;
        return { key: category.code, name: category.name, score, maxScore: category.maxScore, criteria };
      });
      totalScore = Math.min(100, totalScore);
      const totalCriteria = rubricVersion.categories.reduce((sum, category) => sum + category.criteria.length, 0);
      const isComplete = totalCriteria > 0 && finalizedCount === totalCriteria;
      return {
        termId: activeTermId,
        rubricVersion: { id: rubricVersion.id, version: rubricVersion.version },
        officialScore: isComplete ? totalScore : null,
        scoreInProgress: totalScore,
        pendingCriteriaCount: totalCriteria - finalizedCount,
        status: isComplete ? 'READY_TO_CLOSE' : 'IN_PROGRESS',
        classification: isComplete
          ? classification(totalScore)
          : 'CHƯA XẾP LOẠI',
        categories,
        recentEvidences,
      };
    }

    // Kỳ không có rubric phiên bản không có nguồn điểm chính thức hợp lệ.
    return {
      termId: activeTermId,
      officialScore: null,
      scoreInProgress: null,
      classification: 'CHƯA_XẾP_LOẠI',
      status: 'NO_RUBRIC',
      categories: [],
      recentEvidences: [],
    };
  }

  async getScoreByStudent(studentId: string, termId?: string) {
    return this.getDashboard(studentId, termId, true);
  }

  async traceEvidenceScore(evidenceId: string) {
    const evidence = await this.prisma.evidence.findUnique({
      where: { id: evidenceId },
      include: {
        student: { select: { fullName: true, studentCode: true } },
        term: { select: { name: true } },
        reviews: {
          include: {
            reviewer: { select: { fullName: true, role: true } },
            criterion: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!evidence) throw new NotFoundException('Không tìm thấy hồ sơ');

    return {
      evidenceId: evidence.id,
      activityName: evidence.declaredActivityName,
      status: evidence.status,
      student: evidence.student,
      term: evidence.term,
      history: evidence.reviews.map((r) => ({
        decision: r.decision,
        finalScore: r.finalScore,
        criterion: r.criterion ? `${r.criterion.code} - ${r.criterion.name}` : null,
        reviewer: r.reviewer?.fullName,
        reason: r.reason,
        timestamp: r.createdAt,
      })),
    };
  }

  async getClassScores(classId: string, termId: string | undefined, actor: any) {
    const cls = await this.prisma.class.findUniqueOrThrow({ where: { id: classId }, include: { faculty: true } });
    const report = await this.reports.results(actor, termId, Object.assign(new WorkflowQueryDto(), { classId }), true);
    return { class: cls, term: report.term, summary: {
      totalStudents: report.total, evaluatedCount: report.totalEvaluated, completedScoreCount: report.totalEvaluated, avgScore: report.averageScore,
      excellentCount: report.distribution.XUAT_SAC, goodCount: report.distribution.TOT, fairCount: report.distribution.KHA, averageCount: report.distribution.TRUNG_BINH, weakCount: report.distribution.YEU,
      notSubmittedCount: report.summary.notSubmitted, pendingCount: report.pendingStudents,
    }, students: report.items.map(r => ({ ...r, id: r.studentId, fullName: r.student?.fullName, studentCode: r.student?.studentCode })) };
  }
}
