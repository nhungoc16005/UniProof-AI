import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateAppealDto, ResolveAppealDto } from './dto/appeal.dto';
import { AppealStatus, EvidenceStatus, Role } from '@prisma/client';
import { WorkflowService } from '../evaluation-workflow/workflow.service';

@Injectable()
export class AppealsService {
  constructor(private prisma: PrismaService, private workflow: WorkflowService) {}

  async findAll(user: any, params: { termId?: string; status?: AppealStatus; page?: number; pageSize?: number }) {
    if (user.role === Role.STAFF && !user.facultyId) throw new ForbiddenException('Chưa được phân công Khoa');
    const { termId, status, page = 1, pageSize = 20 } = params;
    const where: any = { ...(termId ? { termId } : {}), ...(status ? { status } : {}) };
    if (user.role === Role.STUDENT) where.studentId = user.id;
    if (user.role === Role.STAFF) {
      const assigned = await this.prisma.assessmentHandoff.findMany({ where: { facultyId: user.facultyId, ...(termId ? { termId } : {}) }, select: { studentId: true, termId: true } });
      if (termId && assigned.length === 0) {
        return { items: [], total: 0, page, pageSize };
      }
      where.OR = [
        ...assigned.map(a => ({ studentId: a.studentId, termId: a.termId })),
        { student: { class: { facultyId: user.facultyId } }, termId: null },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.appeal.findMany({ where, skip: (page - 1) * pageSize, take: Math.min(pageSize, 100), orderBy: { createdAt: 'desc' }, include: {
        student: { select: { id: true, fullName: true, studentCode: true } },
        evidence: { select: { id: true, declaredActivityName: true, status: true, term: { select: { code: true, name: true } } } },
        resolver: { select: { id: true, fullName: true } },
      } }),
      this.prisma.appeal.count({ where }),
    ]);
    const assessmentIds = items.flatMap(item => item.criterionAssessmentId ? [item.criterionAssessmentId] : []);
    const publicationKeys = items.flatMap(item => item.termId && item.publicationRevision != null
      ? [{ studentId: item.studentId, termId: item.termId, revision: item.publicationRevision }]
      : []);
    const termIds = [...new Set(items.flatMap(item => item.termId ? [item.termId] : []))];
    const [assessments, publications, terms] = await Promise.all([
      assessmentIds.length
        ? this.prisma.criterionAssessment.findMany({ where: { id: { in: assessmentIds } }, include: { criterion: true } })
        : Promise.resolve([]),
      publicationKeys.length
        ? this.prisma.assessmentPublication.findMany({ where: { OR: publicationKeys } })
        : Promise.resolve([]),
      termIds.length
        ? this.prisma.term.findMany({ where: { id: { in: termIds } }, select: { id: true, name: true, status: true } })
        : Promise.resolve([]),
    ]);
    const assessmentById = new Map(assessments.map(item => [item.id, item]));
    const publicationByKey = new Map(publications.map(item => [`${item.studentId}:${item.termId}:${item.revision}`, item]));
    const termById = new Map(terms.map(item => [item.id, item]));
    const enriched = items.map(item => {
      const assessment = item.criterionAssessmentId ? assessmentById.get(item.criterionAssessmentId) : null;
      const publication = item.termId && item.publicationRevision != null
        ? publicationByKey.get(`${item.studentId}:${item.termId}:${item.publicationRevision}`)
        : null;
      const published = publication?.snapshot as any;
      const publishedCriterion = published?.categories?.flatMap((category: any) => category.criteria)
        .find((criterion: any) => criterion.id === assessment?.criterionId);
      return {
        ...item,
        criterion: assessment?.criterion,
        publishedScore: publishedCriterion?.assessment?.officialScore ?? null,
        term: item.termId ? termById.get(item.termId) ?? null : null,
      };
    });
    return { items: enriched, total, page, pageSize };
  }

  async create(studentId: string, dto: CreateAppealDto) {
    if (!!dto.evidenceId === !!dto.criterionAssessmentId) throw new BadRequestException('Chọn một tiêu chí hoặc một minh chứng để phúc khảo');
    const evidence = dto.evidenceId ? await this.prisma.evidence.findUnique({ where: { id: dto.evidenceId }, include: { criterionAssessment: true } }) : null;
    const assessment = dto.criterionAssessmentId ? await this.prisma.criterionAssessment.findUnique({ where: { id: dto.criterionAssessmentId } }) : evidence?.criterionAssessment;
    if (dto.evidenceId && !evidence || dto.criterionAssessmentId && !assessment) throw new NotFoundException('Không tìm thấy nội dung phúc khảo');
    if ((evidence?.studentId ?? assessment?.studentId) !== studentId) throw new ForbiddenException('Không sở hữu nội dung này');
    const termId = evidence?.termId ?? assessment!.termId;
    return this.prisma.$transaction(async tx => {
      const term = await this.workflow.lock(tx, termId);
      if (term.status === 'CLOSED' || term.status === 'UPCOMING' || new Date() > term.appealDeadline) throw new BadRequestException('Kỳ không nhận phúc khảo hoặc đã hết hạn');
      const publication = term.workflowEnabled ? await tx.assessmentPublication.findFirst({ where: { studentId, termId }, orderBy: { revision: 'desc' } }) : null;
      if (term.workflowEnabled && (!publication || !assessment)) throw new BadRequestException('Chỉ phúc khảo tiêu chí có kết quả đã được CTSV công bố');
      if (!dto.content?.trim()) throw new BadRequestException('Cần nhập giải trình');
      const target = assessment ? { criterionAssessmentId: assessment.id } : { evidenceId: evidence!.id };
      if (await tx.appeal.count({ where: { studentId, termId, ...target, status: 'PENDING' } })) throw new BadRequestException('Nội dung đang có đơn phúc khảo chờ xử lý');
      const result = await tx.appeal.create({ data: { studentId, termId, evidenceId: evidence?.id, criterionAssessmentId: assessment?.id, publicationRevision: publication?.revision, previousEvidenceStatus: evidence?.status, content: dto.content.trim(), requestedScore: dto.requestedScore ?? null } });
      // The published evidence remains valid until a human accepts reopening.
      await this.workflow.audit(tx, studentId, 'APPEAL_CREATED', result.id, { studentId, termId, criterionAssessmentId: assessment?.id ?? null });
      return result;
    });
  }

  async resolve(appealId: string, officer: any, dto: ResolveAppealDto) {
    if (officer.role !== Role.STAFF) throw new ForbiddenException('Phúc khảo do cán bộ Khoa xử lý');
    if (!dto.resolutionNote?.trim()) throw new BadRequestException('Cần nhập lý do giải quyết');
    if (![AppealStatus.ACCEPTED, AppealStatus.REJECTED].includes(dto.status as any)) throw new BadRequestException('Quyết định không hợp lệ');
    if (dto.adjustedScore != null) throw new BadRequestException('Điểm phải được xác minh và chốt tại tiêu chí; phúc khảo không ghi điểm trực tiếp');
    const appeal = await this.prisma.appeal.findUnique({ where: { id: appealId }, include: { evidence: true } });
    if (!appeal) throw new NotFoundException('Không tìm thấy đơn');
    const termId = appeal.termId ?? appeal.evidence?.termId;
    if (!termId) throw new BadRequestException('Không xác định được kỳ');
    return this.prisma.$transaction(async tx => {
      const term = await this.workflow.lock(tx, termId);
      await this.workflow.scope(officer, appeal.studentId, termId, tx);
      if (term.status === 'CLOSED') throw new BadRequestException('Kỳ đã chốt');
      const changed = await tx.appeal.updateMany({ where: { id: appealId, status: 'PENDING' }, data: { status: dto.status, resolverId: officer.id, resolutionNote: dto.resolutionNote.trim(), resolvedAt: new Date() } });
      if (!changed.count) throw new BadRequestException('Đơn đã được xử lý');
      if (dto.status === AppealStatus.ACCEPTED) {
        if (term.workflowEnabled) {
          if (!appeal.criterionAssessmentId) throw new BadRequestException('Thiếu tiêu chí cần mở lại');
          await tx.assessmentHandoff.update({ where: { studentId_termId: { studentId: appeal.studentId, termId } }, data: { status: 'RETURNED', returnReason: 'Chấp thuận phúc khảo: ' + dto.resolutionNote.trim() } });
          await tx.criterionAssessment.update({ where: { id: appeal.criterionAssessmentId }, data: { status: 'NEEDS_VERIFICATION', officialScore: null, officialReason: null, finalizedAt: null, finalReviewerId: null, suggestedScore: null, suggestionReason: null } });
        }
        if (appeal.evidenceId) await tx.evidence.update({ where: { id: appeal.evidenceId }, data: { status: EvidenceStatus.NEEDS_HUMAN_REVIEW } });
      } else if (appeal.evidenceId && appeal.evidence?.status === 'APPEALING') {
        // Legacy appeals stored APPEALING on the evidence. Restore its last decision.
        const last = await tx.review.findFirst({ where: { evidenceId: appeal.evidenceId, decision: { in: ['APPROVED', 'REJECTED', 'SCORE_ADJUSTED'] } }, orderBy: { createdAt: 'desc' } });
        await tx.evidence.update({ where: { id: appeal.evidenceId }, data: { status: appeal.previousEvidenceStatus ?? (last?.decision === 'REJECTED' ? EvidenceStatus.REJECTED : last ? EvidenceStatus.APPROVED : EvidenceStatus.NEEDS_HUMAN_REVIEW) } });
      }
      await this.workflow.audit(tx, officer.id, 'APPEAL_RESOLVED', appealId, { studentId: appeal.studentId, termId, status: dto.status, reason: dto.resolutionNote.trim() });
      await tx.notification.create({ data: { userId: appeal.studentId, relatedEvidenceId: appeal.evidenceId, type: 'APPEAL_RESOLVED', title: 'Phúc khảo đã được phản hồi', content: dto.status === 'ACCEPTED' ? 'Đã mở lại nội dung để Khoa đánh giá và gửi lại CTSV. ' + dto.resolutionNote : dto.resolutionNote } });
      return tx.appeal.findUnique({ where: { id: appealId } });
    });
  }
}
