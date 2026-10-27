import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { WorkflowService } from '../evaluation-workflow/workflow.service';
import { EvidenceStatus, TermStatus } from '@prisma/client';

@Injectable()
export class ConductScoresService {
  constructor(private prisma: PrismaService, private workflow: WorkflowService) {}

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
        score = Math.min(category.maxScore, score);
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
          ? totalScore >= 90 ? 'XUẤT SẮC' : totalScore >= 80 ? 'TỐT' : totalScore >= 65 ? 'KHÁ' : totalScore >= 50 ? 'TRUNG BÌNH' : 'YẾU'
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

  async getClassScores(classId: string, termId?: string) {
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

    const termObj = activeTermId ? await this.prisma.term.findUnique({ where: { id: activeTermId } }) : null;

    // 2. Tìm lớp học
    const classObj = await this.prisma.class.findUnique({
      where: { id: classId },
      include: {
        faculty: true,
      },
    });

    if (!classObj) throw new NotFoundException('Không tìm thấy Lớp học');

    // 3. Lấy toàn bộ sinh viên của lớp
    const students = await this.prisma.user.findMany({
      where: {
        classId,
        role: 'STUDENT',
        isActive: true,
      },
      orderBy: { studentCode: 'asc' },
      select: {
        id: true,
        fullName: true,
        studentCode: true,
        email: true,
      },
    });

    // 4. Lấy dữ liệu điểm và minh chứng của từng sinh viên trong kỳ này
    const studentIds = students.map((s) => s.id);

    const rubricVersion = activeTermId ? await this.prisma.rubricVersion.findFirst({
      where: { termId: activeTermId, status: 'PUBLISHED' },
      include: { categories: { include: { criteria: true } } },
      orderBy: { version: 'desc' },
    }) : null;
    if (rubricVersion && activeTermId) {
      const [assessments, submissions, evidenceRows] = await Promise.all([
        this.prisma.criterionAssessment.findMany({ where: { studentId: { in: studentIds }, termId: activeTermId, criterion: { rubricVersionId: rubricVersion.id } } }),
        this.prisma.assessmentSubmission.findMany({ where: { studentId: { in: studentIds }, termId: activeTermId, rubricVersionId: rubricVersion.id } }),
        this.prisma.evidence.findMany({ where: { studentId: { in: studentIds }, termId: activeTermId }, select: { id: true, studentId: true, status: true } }),
      ]);
      const totalCriteria = rubricVersion.categories.reduce((sum, category) => sum + category.criteria.length, 0);
      const scores = students.map((student) => {
        const studentAssessments = assessments.filter((assessment) => assessment.studentId === student.id);
        const finalized = studentAssessments.filter((assessment) => assessment.status === 'FINALIZED' && assessment.officialScore !== null);
        const submission = submissions.find((item) => item.studentId === student.id);
        const studentEvidence = evidenceRows.filter((item) => item.studentId === student.id);
        const approvedCount = studentEvidence.filter((item) => item.status === EvidenceStatus.APPROVED).length;
        const pendingCount = studentEvidence.filter((item) => [EvidenceStatus.NEEDS_HUMAN_REVIEW, EvidenceStatus.PROCESSING, EvidenceStatus.PLAUSIBLE].some((status) => status === item.status)).length;
        const supplementCount = studentEvidence.filter((item) => item.status === EvidenceStatus.NEEDS_SUPPLEMENT).length;
        const rejectedCount = studentEvidence.filter((item) => item.status === EvidenceStatus.REJECTED).length;
        const partialScore = Math.min(100, rubricVersion.categories.reduce((sum, category) =>
          sum + Math.min(category.maxScore, finalized.filter(a => category.criteria.some(c => c.id === a.criterionId)).reduce((n, a) => n + (a.officialScore ?? 0), 0)), 0));
        const complete = totalCriteria > 0 && finalized.length === totalCriteria;
        const officialScore = complete ? partialScore : null;
        const classification = complete
          ? officialScore! >= 90 ? 'Xuất sắc' : officialScore! >= 80 ? 'Tốt' : officialScore! >= 65 ? 'Khá' : officialScore! >= 50 ? 'Trung bình' : 'Yếu'
          : submission?.status === 'SUBMITTED' ? 'Đã nộp · chờ chốt' : submission?.status === 'RETURNED' ? 'Cần chỉnh sửa' : 'Chưa nộp';
        return {
          id: student.id, fullName: student.fullName, studentCode: student.studentCode || 'N/A', email: student.email,
          officialScore, partialFinalizedScore: partialScore, classification,
          submissionStatus: submission?.status || 'DRAFT', finalizedCriteriaCount: finalized.length, totalCriteria,
          submittedCount: studentEvidence.length, approvedCount, pendingCount, supplementCount, rejectedCount,
        };
      });
      const completed = scores.filter((student) => student.officialScore !== null);
      const submitted = scores.filter((student) => student.submissionStatus === 'SUBMITTED' || student.submissionStatus === 'RETURNED');
      return {
        class: classObj, term: termObj,
        summary: {
          totalStudents: students.length, evaluatedCount: submitted.length,
          finalizedCriteriaCount: assessments.filter((item) => item.status === 'FINALIZED').length,
          totalCriteriaCount: students.length * totalCriteria,
          completedScoreCount: completed.length,
          avgScore: completed.length ? +(completed.reduce((sum, item) => sum + (item.officialScore || 0), 0) / completed.length).toFixed(1) : null,
          pendingCount: evidenceRows.filter((item) => [EvidenceStatus.NEEDS_HUMAN_REVIEW, EvidenceStatus.PROCESSING, EvidenceStatus.PLAUSIBLE].some((status) => status === item.status)).length,
          excellentCount: completed.filter((item) => item.classification === 'Xuất sắc').length,
          goodCount: completed.filter((item) => item.classification === 'Tốt').length,
          fairCount: completed.filter((item) => item.classification === 'Khá').length,
          averageCount: completed.filter((item) => item.classification === 'Trung bình').length,
          weakCount: completed.filter((item) => item.classification === 'Yếu').length,
          notSubmittedCount: scores.filter((item) => item.submissionStatus === 'DRAFT').length,
        },
        students: scores,
      };
    }

    const studentScores = students.map((s) => {
      return {
        id: s.id,
        fullName: s.fullName,
        studentCode: s.studentCode || 'N/A',
        email: s.email,
        officialScore: null,
        pendingScore: null,
        classification: 'Chưa có rubric',
        submittedCount: 0,
        approvedCount: 0,
        pendingCount: 0,
        supplementCount: 0,
        rejectedCount: 0,
      };
    });

    // Thống kê phân bố lớp
    const summary = {
      totalStudents: students.length,
      evaluatedCount: 0,
      excellentCount: 0,
      goodCount: 0,
      fairCount: 0,
      averageCount: 0,
      weakCount: 0,
      notSubmittedCount: studentScores.length,
      avgScore: null,
    };

    return {
      class: classObj,
      term: termObj,
      summary,
      students: studentScores,
    };
  }
}
