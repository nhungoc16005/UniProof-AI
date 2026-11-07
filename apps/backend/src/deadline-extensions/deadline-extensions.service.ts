import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeadlineExtensionTarget, DeadlineExtensionType, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class DeadlineExtensionsService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(termId: string, studentId: string, type: DeadlineExtensionType, db: Prisma.TransactionClient | PrismaService = this.prisma) {
    const [term, handoff] = await Promise.all([
      db.term.findUnique({ where: { id: termId } }),
      db.assessmentHandoff.findUnique({ where: { studentId_termId: { studentId, termId } }, select: { classId: true } }),
    ]);
    if (!term) throw new NotFoundException('Không tìm thấy kỳ đánh giá');
    const base = type === 'SUBMISSION' ? term.submissionDeadline : type === 'REVIEW' ? term.reviewDeadline : term.appealDeadline;
    const targets = [{ targetType: DeadlineExtensionTarget.STUDENT, targetId: studentId }, ...(handoff?.classId ? [{ targetType: DeadlineExtensionTarget.CLASS, targetId: handoff.classId }] : [])];
    const rows = await db.assessmentDeadlineExtension.findMany({ where: { termId, type, revokedAt: null, OR: targets }, orderBy: { createdAt: 'desc' } });
    const student = rows.find(row => row.targetType === 'STUDENT');
    const cls = rows.find(row => row.targetType === 'CLASS');
    const selected = student || cls;
    return { deadline: selected?.deadline ?? base, source: selected ? selected.targetType : 'TERM', extensionId: selected?.id ?? null };
  }

  async create(actorId: string, body: { termId: string; targetType: DeadlineExtensionTarget; targetId: string; type: DeadlineExtensionType; deadline: string; reason: string }) {
    const deadline = new Date(body.deadline);
    if (Number.isNaN(deadline.getTime()) || !body.reason?.trim()) throw new BadRequestException('Hạn mới và lý do là bắt buộc');
    return this.prisma.$transaction(async tx => {
      const term = await tx.term.findUnique({ where: { id: body.termId } });
      if (!term) throw new NotFoundException('Không tìm thấy kỳ đánh giá');
      if (term.status === 'CLOSED') throw new BadRequestException('Kỳ đã chốt, không thể gia hạn');
      const base = body.type === 'SUBMISSION' ? term.submissionDeadline : body.type === 'REVIEW' ? term.reviewDeadline : term.appealDeadline;
      if (deadline <= base) throw new BadRequestException('Hạn mới phải sau hạn chung của kỳ');
      let userIds: string[] = [];
      if (body.targetType === 'STUDENT') {
        const handoff = await tx.assessmentHandoff.findUnique({ where: { studentId_termId: { studentId: body.targetId, termId: body.termId } } });
        if (!handoff) throw new BadRequestException('Sinh viên không thuộc danh sách kỳ');
        userIds = [body.targetId];
      } else {
        if (!await tx.assessmentHandoff.count({ where: { termId: body.termId, classId: body.targetId } })) throw new BadRequestException('Lớp không thuộc danh sách kỳ');
        userIds = (await tx.assessmentHandoff.findMany({ where: { termId: body.termId, classId: body.targetId }, select: { studentId: true } })).map(row => row.studentId);
      }
      const extension = await tx.assessmentDeadlineExtension.create({ data: { ...body, reason: body.reason.trim(), deadline, createdById: actorId } });
      if (userIds.length) await tx.notification.createMany({ data: userIds.map(userId => ({ userId, type: 'DEADLINE_EXTENDED', eventKey: 'DEADLINE_EXTENDED', dedupeKey: `deadline:${extension.id}:${userId}`, title: 'Đã gia hạn thời gian xử lý', content: `${body.reason.trim()} · Hạn mới: ${deadline.toLocaleString('vi-VN')}`, targetPath: '/student', metadata: { extensionId: extension.id, type: body.type } })) });
      await tx.auditLog.create({ data: { userId: actorId, action: 'DEADLINE_EXTENSION_CREATED', entityType: 'AssessmentDeadlineExtension', entityId: extension.id, newValue: { termId: body.termId, targetType: body.targetType, targetId: body.targetId, type: body.type, deadline: deadline.toISOString(), reason: body.reason.trim() } } });
      return extension;
    });
  }

  list(termId: string) {
    return this.prisma.assessmentDeadlineExtension.findMany({ where: { termId }, include: { createdBy: { select: { fullName: true } }, revokedBy: { select: { fullName: true } } }, orderBy: { createdAt: 'desc' } });
  }

  async revoke(actorId: string, id: string) {
    return this.prisma.$transaction(async tx => {
      const row = await tx.assessmentDeadlineExtension.findUnique({ where: { id } });
      if (!row) throw new NotFoundException('Không tìm thấy gia hạn');
      if (row.revokedAt) return row;
      const updated = await tx.assessmentDeadlineExtension.update({ where: { id }, data: { revokedAt: new Date(), revokedById: actorId } });
      await tx.auditLog.create({ data: { userId: actorId, action: 'DEADLINE_EXTENSION_REVOKED', entityType: 'AssessmentDeadlineExtension', entityId: id, oldValue: { revokedAt: null }, newValue: { revokedAt: updated.revokedAt?.toISOString() } } });
      return updated;
    });
  }
}
