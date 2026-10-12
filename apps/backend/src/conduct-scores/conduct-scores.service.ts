import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { EvidenceStatus, TermStatus } from '@prisma/client';

@Injectable()
export class ConductScoresService {
  constructor(private prisma: PrismaService) {}

  async getDashboard(studentId: string, termId?: string) {
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

    // 2. Lấy điểm chính thức đã chốt
    const conductScore = await this.prisma.conductScore.findUnique({
      where: {
        studentId_termId: {
          studentId,
          termId: activeTermId,
        },
      },
    });

    // 3. Lấy các hồ sơ đã APPROVED trong kỳ để phân bổ theo 5 nhóm tiêu chí
    const approvedEvidences = await this.prisma.evidence.findMany({
      where: {
        studentId,
        termId: activeTermId,
        status: EvidenceStatus.APPROVED,
      },
      include: {
        reviews: {
          where: { decision: 'APPROVED' },
          include: { criterion: true },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // 4. Lấy các hồ sơ đang chờ duyệt
    const pendingEvidences = await this.prisma.evidence.findMany({
      where: {
        studentId,
        termId: activeTermId,
        status: {
          in: [
            EvidenceStatus.NEEDS_HUMAN_REVIEW,
            EvidenceStatus.PROCESSING,
            EvidenceStatus.PLAUSIBLE,
            EvidenceStatus.NEEDS_SUPPLEMENT,
          ],
        },
      },
    });

    // Gom điểm theo 5 Khung tiêu chí ĐHBK Đà Nẵng
    const categoryScores: Record<string, { name: string; score: number; maxScore: number }> = {
      KHUNG_I: { name: 'Ý thức học tập', score: 0, maxScore: 20 },
      KHUNG_II: { name: 'Chấp hành nội quy, quy chế', score: 0, maxScore: 25 },
      KHUNG_III: { name: 'Hoạt động chính trị, XH, VH, TT', score: 0, maxScore: 20 },
      KHUNG_IV: { name: 'Phẩm chất công dân, cộng đồng', score: 0, maxScore: 25 },
      KHUNG_V: { name: 'Hoạt động lớp, đoàn thể', score: 0, maxScore: 10 },
    };

    for (const ev of approvedEvidences) {
      const review = ev.reviews[0];
      if (review && review.criterion && review.finalScore) {
        const cat = review.criterion.category || 'KHUNG_I';
        if (categoryScores[cat]) {
          categoryScores[cat].score = Math.min(
            categoryScores[cat].maxScore,
            categoryScores[cat].score + review.finalScore,
          );
        }
      }
    }

    const officialScore = conductScore?.totalScore || 0;
    const classification = conductScore?.classification || (officialScore >= 80 ? 'TỐT' : officialScore >= 65 ? 'KHÁ' : officialScore >= 50 ? 'TRUNG BÌNH' : 'YẾU');

    return {
      termId: activeTermId,
      officialScore,
      pendingCount: pendingEvidences.length,
      classification,
      categories: Object.entries(categoryScores).map(([key, val]) => ({
        key,
        name: val.name,
        score: val.score,
        maxScore: val.maxScore,
      })),
      recentEvidences: approvedEvidences.slice(0, 5),
    };
  }

  async getScoreByStudent(studentId: string, termId?: string) {
    return this.getDashboard(studentId, termId);
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

    const [conductScores, evidences] = await Promise.all([
      activeTermId
        ? this.prisma.conductScore.findMany({
            where: {
              studentId: { in: studentIds },
              termId: activeTermId,
            },
          })
        : [],
      activeTermId
        ? this.prisma.evidence.findMany({
            where: {
              studentId: { in: studentIds },
              termId: activeTermId,
            },
            include: {
              reviews: {
                where: { decision: 'APPROVED' },
                take: 1,
              },
              aiSuggestions: {
                take: 1,
              },
            },
          })
        : [],
    ]);

    // Map điểm và phân loại từng em
    const studentScores = students.map((s) => {
      const sScoreRecord = conductScores.find((cs) => cs.studentId === s.id);
      const sEvidences = evidences.filter((e) => e.studentId === s.id);

      const approvedEvs = sEvidences.filter((e) => e.status === EvidenceStatus.APPROVED);
      const pendingEvs = sEvidences.filter((e) => 
        e.status === EvidenceStatus.NEEDS_HUMAN_REVIEW || 
        e.status === EvidenceStatus.PROCESSING || 
        e.status === EvidenceStatus.PLAUSIBLE
      );
      const supplementEvs = sEvidences.filter((e) => e.status === EvidenceStatus.NEEDS_SUPPLEMENT);
      const rejectedEvs = sEvidences.filter((e) => e.status === EvidenceStatus.REJECTED);

      let officialScore = sScoreRecord ? sScoreRecord.totalScore : 0;
      if (!sScoreRecord && approvedEvs.length > 0) {
        officialScore = approvedEvs.reduce((sum, e) => sum + (e.reviews[0]?.finalScore || e.aiSuggestions[0]?.suggestedScore || 0), 0);
        officialScore = Math.min(100, +officialScore.toFixed(1));
      }

      const pendingScore = pendingEvs.reduce((sum, e) => sum + (e.aiSuggestions[0]?.suggestedScore || 0), 0);

      let classification = 'Chưa nộp';
      if (sEvidences.length > 0 || officialScore > 0) {
        if (officialScore >= 90) classification = 'Xuất sắc';
        else if (officialScore >= 80) classification = 'Tốt';
        else if (officialScore >= 65) classification = 'Khá';
        else if (officialScore >= 50) classification = 'Trung bình';
        else classification = 'Yếu';
      }

      return {
        id: s.id,
        fullName: s.fullName,
        studentCode: s.studentCode || 'N/A',
        email: s.email,
        officialScore,
        pendingScore: +pendingScore.toFixed(1),
        classification,
        submittedCount: sEvidences.length,
        approvedCount: approvedEvs.length,
        pendingCount: pendingEvs.length,
        supplementCount: supplementEvs.length,
        rejectedCount: rejectedEvs.length,
      };
    });

    // Thống kê phân bố lớp
    const summary = {
      totalStudents: students.length,
      evaluatedCount: studentScores.filter((s) => s.submittedCount > 0 || s.officialScore > 0).length,
      excellentCount: studentScores.filter((s) => s.classification === 'Xuất sắc').length,
      goodCount: studentScores.filter((s) => s.classification === 'Tốt').length,
      fairCount: studentScores.filter((s) => s.classification === 'Khá').length,
      averageCount: studentScores.filter((s) => s.classification === 'Trung bình').length,
      weakCount: studentScores.filter((s) => s.classification === 'Yếu').length,
      notSubmittedCount: studentScores.filter((s) => s.classification === 'Chưa nộp').length,
      avgScore: studentScores.length > 0
        ? +(studentScores.reduce((sum, s) => sum + s.officialScore, 0) / studentScores.length).toFixed(1)
        : 0,
    };

    return {
      class: classObj,
      term: termObj,
      summary,
      students: studentScores,
    };
  }
}
