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

    const [totalStudents, totalEvidences, approvedEvidences, pendingEvidences, rejectedEvidences] =
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
      ]);

    const reviewRate = totalEvidences > 0 ? Math.round(((approvedEvidences + rejectedEvidences) / totalEvidences) * 100) : 0;

    return {
      totalStudents,
      totalEvidences,
      approvedEvidences,
      pendingEvidences,
      rejectedEvidences,
      reviewRate,
    };
  }

  async getDistribution(termId?: string, facultyId?: string) {
    let targetTermId = termId;
    if (!targetTermId) {
      const activeTerm = await this.prisma.term.findFirst({ where: { status: TermStatus.ACTIVE } });
      targetTermId = activeTerm?.id;
    }

    const where: any = {};
    if (targetTermId) where.termId = targetTermId;
    if (facultyId) where.student = { class: { facultyId } };

    const scores = await this.prisma.conductScore.findMany({
      where,
      select: { classification: true, totalScore: true },
    });

    const counts = {
      XUAT_SAC: 0,
      TOT: 0,
      KHA: 0,
      TRUNG_BINH: 0,
      YEU: 0,
    };

    for (const s of scores) {
      if (s.classification === 'XUẤT SẮC') counts.XUAT_SAC++;
      else if (s.classification === 'TỐT') counts.TOT++;
      else if (s.classification === 'KHÁ') counts.KHA++;
      else if (s.classification === 'TRUNG BÌNH') counts.TRUNG_BINH++;
      else counts.YEU++;
    }

    return {
      totalEvaluated: scores.length,
      distribution: counts,
    };
  }
}
