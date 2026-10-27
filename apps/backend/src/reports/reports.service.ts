import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { EvidenceStatus, TermStatus } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getKpiSummary(termId?: string) {
    let targetTermId = termId;
    if (!targetTermId) {
      const activeTerm = await this.prisma.term.findFirst({ where: { status: TermStatus.ACTIVE } });
      targetTermId = activeTerm?.id;
    }

    const whereTerm = targetTermId ? { termId: targetTermId } : {};
    const rubricVersion = targetTermId ? await this.prisma.rubricVersion.findFirst({ where: { termId: targetTermId, status: 'PUBLISHED' }, include: { _count: { select: { criteria: true } } }, orderBy: { version: 'desc' } }) : null;

    const [totalStudents, totalEvidences, approvedEvidences, pendingEvidences, rejectedEvidences, submittedStudents, returnedStudents, finalizedCriteria] =
      await Promise.all([
        this.prisma.user.count({ where: { role: 'STUDENT', isActive: true } }),
        this.prisma.evidence.count({ where: whereTerm }),
        this.prisma.evidence.count({ where: { ...whereTerm, status: EvidenceStatus.APPROVED } }),
        this.prisma.evidence.count({
          where: {
            ...whereTerm,
            status: { in: [EvidenceStatus.NEEDS_HUMAN_REVIEW, EvidenceStatus.PROCESSING, EvidenceStatus.PLAUSIBLE] },
          },
        }),
        this.prisma.evidence.count({ where: { ...whereTerm, status: EvidenceStatus.REJECTED } }),
        targetTermId ? this.prisma.assessmentSubmission.count({ where: { termId: targetTermId, status: 'SUBMITTED' } }) : 0,
        targetTermId ? this.prisma.assessmentSubmission.count({ where: { termId: targetTermId, status: 'RETURNED' } }) : 0,
        targetTermId ? this.prisma.criterionAssessment.count({ where: { termId: targetTermId, status: 'FINALIZED', ...(rubricVersion ? { criterion: { rubricVersionId: rubricVersion.id } } : {}) } }) : 0,
      ]);

    const reviewRate = totalEvidences > 0 ? Math.round(((approvedEvidences + rejectedEvidences) / totalEvidences) * 100) : 0;

    return {
      totalStudents,
      totalEvidences,
      approvedEvidences,
      pendingEvidences,
      rejectedEvidences,
      reviewRate,
      submittedStudents,
      returnedStudents,
      finalizedCriteria,
      totalCriteria: rubricVersion ? totalStudents * rubricVersion._count.criteria : 0,
      termId: targetTermId ?? null,
      updatedAt: new Date().toISOString(),
    };
  }

  async getDistribution(termId?: string, facultyId?: string) {
    let targetTermId = termId;
    if (!targetTermId) {
      const activeTerm = await this.prisma.term.findFirst({ where: { status: TermStatus.ACTIVE } });
      targetTermId = activeTerm?.id;
    }

    const rubricVersion = targetTermId ? await this.prisma.rubricVersion.findFirst({
      where: { termId: targetTermId, status: 'PUBLISHED' },
      include: { categories: { include: { criteria: true } } },
      orderBy: { version: 'desc' },
    }) : null;
    if (rubricVersion && targetTermId) {
      const students = await this.prisma.user.findMany({
        where: { role: 'STUDENT', isActive: true, ...(facultyId ? { class: { facultyId } } : {}) },
        select: { id: true },
      });
      const assessments = await this.prisma.criterionAssessment.findMany({
        where: { termId: targetTermId, studentId: { in: students.map((student) => student.id) }, status: 'FINALIZED', criterion: { rubricVersionId: rubricVersion.id } },
        include: { criterion: { include: { rubricCategory: true } } },
      });
      const totalCriteria = rubricVersion.categories.reduce((sum, category) => sum + category.criteria.length, 0);
      const byStudent = new Map<string, typeof assessments>();
      for (const assessment of assessments) byStudent.set(assessment.studentId, [...(byStudent.get(assessment.studentId) || []), assessment]);
      const totals: number[] = [];
      for (const studentAssessments of byStudent.values()) {
        if (totalCriteria === 0 || studentAssessments.length !== totalCriteria) continue;
        const categoryTotals = new Map<string, number>();
        for (const assessment of studentAssessments) {
          const categoryId = assessment.criterion.categoryId;
          categoryTotals.set(categoryId, (categoryTotals.get(categoryId) || 0) + (assessment.officialScore || 0));
        }
        totals.push(Math.min(100, rubricVersion.categories.reduce((sum, category) => sum + Math.min(category.maxScore, categoryTotals.get(category.id) || 0), 0)));
      }
      const counts = { XUAT_SAC: 0, TOT: 0, KHA: 0, TRUNG_BINH: 0, YEU: 0 };
      for (const score of totals) {
        if (score >= 90) counts.XUAT_SAC++;
        else if (score >= 80) counts.TOT++;
        else if (score >= 65) counts.KHA++;
        else if (score >= 50) counts.TRUNG_BINH++;
        else counts.YEU++;
      }
      return { totalEvaluated: totals.length, pendingStudents: students.length - totals.length, distribution: counts, termId: targetTermId, rubricVersionId: rubricVersion.id, updatedAt: new Date().toISOString() };
    }

    const pendingStudents = await this.prisma.user.count({
      where: { role: 'STUDENT', isActive: true, ...(facultyId ? { class: { facultyId } } : {}) },
    });
    return {
      totalEvaluated: 0,
      pendingStudents,
      distribution: { XUAT_SAC: 0, TOT: 0, KHA: 0, TRUNG_BINH: 0, YEU: 0 },
      termId: targetTermId ?? null,
      rubricVersionId: null,
      updatedAt: new Date().toISOString(),
    };
  }

  async getFacultyProgress(termId?: string) {
    let targetTermId = termId;
    if (!targetTermId) {
      const activeTerm = await this.prisma.term.findFirst({ where: { status: TermStatus.ACTIVE } });
      targetTermId = activeTerm?.id;
    }

    const rubricVersion = targetTermId ? await this.prisma.rubricVersion.findFirst({ where: { termId: targetTermId, status: 'PUBLISHED' }, select: { id: true }, orderBy: { version: 'desc' } }) : null;

    const faculties = await this.prisma.faculty.findMany({
      include: {
        classes: {
          select: { id: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const results = await Promise.all(
      faculties.map(async (fac) => {
        const classIds = fac.classes.map((c) => c.id);

        const [totalStudents, totalEvidences, approvedEvidences, submittedStudents, returnedStudents, finalizedCriteria] = await Promise.all([
          this.prisma.user.count({
            where: {
              role: 'STUDENT',
              classId: { in: classIds },
              isActive: true,
            },
          }),
          targetTermId
            ? this.prisma.evidence.count({
                where: {
                  termId: targetTermId,
                  student: { classId: { in: classIds } },
                },
              })
            : 0,
          targetTermId
            ? this.prisma.evidence.count({
                where: {
                  termId: targetTermId,
                  student: { classId: { in: classIds } },
                  status: EvidenceStatus.APPROVED,
                },
              })
            : 0,
          targetTermId ? this.prisma.assessmentSubmission.count({ where: { termId: targetTermId, status: 'SUBMITTED', student: { classId: { in: classIds } } } }) : 0,
          targetTermId ? this.prisma.assessmentSubmission.count({ where: { termId: targetTermId, status: 'RETURNED', student: { classId: { in: classIds } } } }) : 0,
          targetTermId ? this.prisma.criterionAssessment.count({ where: { termId: targetTermId, status: 'FINALIZED', student: { classId: { in: classIds } }, ...(targetTermId && rubricVersion ? { criterion: { rubricVersionId: rubricVersion.id } } : {}) } }) : 0,
        ]);

        const approvedRate = totalEvidences > 0 ? Math.round((approvedEvidences / totalEvidences) * 100) : 0;
        const submissionRate = totalStudents > 0 ? Math.round(((submittedStudents + returnedStudents) / totalStudents) * 100) : 0;
        const status = submissionRate >= 80 ? 'Đã nộp phần lớn' : submittedStudents + returnedStudents > 0 ? 'Đang tiếp nhận phiếu' : 'Chưa có phiếu';

        return {
          id: fac.id,
          code: fac.code,
          name: fac.name,
          totalStudents,
          submittedCount: totalEvidences,
          approvedCount: approvedEvidences,
          approvedRate: `${approvedRate}%`,
          submittedStudents,
          returnedStudents,
          finalizedCriteria,
          termId: targetTermId ?? null,
          updatedAt: new Date().toISOString(),
          status,
          submissionRate: `${submissionRate}%`,
        };
      }),
    );

    return results;
  }
}
