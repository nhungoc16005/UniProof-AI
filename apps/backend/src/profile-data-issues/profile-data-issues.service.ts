import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProfileDataIssueStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class ProfileDataIssuesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(actor: any, body: { category: string; content: string }) {
    const currentData = { fullName: actor.fullName, email: actor.email, studentCode: actor.studentCode, classId: actor.classId, facultyId: actor.facultyId };
    return this.prisma.$transaction(async tx => {
      const issue = await tx.profileDataIssue.create({ data: { reporterId: actor.id, category: body.category.trim(), content: body.content.trim(), currentData: currentData as Prisma.InputJsonValue } });
      await tx.auditLog.create({ data: { userId: actor.id, action: 'PROFILE_DATA_ISSUE_REPORTED', entityType: 'ProfileDataIssue', entityId: issue.id, newValue: { category: issue.category } } });
      return issue;
    });
  }

  mine(userId: string) {
    return this.prisma.profileDataIssue.findMany({ where: { reporterId: userId }, orderBy: { createdAt: 'desc' }, take: 20 });
  }

  async list(status?: ProfileDataIssueStatus, page = 1) {
    const pageSize = 25;
    const where = status ? { status } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.profileDataIssue.findMany({ where, include: { reporter: { select: { id: true, fullName: true, email: true, studentCode: true, class: { select: { code: true, faculty: { select: { name: true } } } } } }, resolver: { select: { fullName: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.profileDataIssue.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async resolve(actorId: string, id: string, body: { status: 'RESOLVED' | 'REJECTED'; resolution: string }) {
    return this.prisma.$transaction(async tx => {
      const issue = await tx.profileDataIssue.findUnique({ where: { id } });
      if (!issue) throw new NotFoundException('Không tìm thấy yêu cầu');
      if (issue.status !== ProfileDataIssueStatus.OPEN) throw new BadRequestException('Yêu cầu đã được xử lý');
      const updated = await tx.profileDataIssue.update({ where: { id }, data: { status: body.status, resolution: body.resolution.trim(), resolverId: actorId, resolvedAt: new Date() } });
      await tx.notification.create({ data: { userId: issue.reporterId, type: 'PROFILE_DATA_ISSUE_RESOLVED', eventKey: 'PROFILE_DATA_ISSUE_RESOLVED', dedupeKey: `profile-issue:${id}:${body.status}`, title: body.status === 'RESOLVED' ? 'Yêu cầu thông tin đã được xử lý' : 'Yêu cầu thông tin chưa được chấp nhận', content: body.resolution.trim(), targetPath: '/account', metadata: { issueId: id, status: body.status } } });
      await tx.auditLog.create({ data: { userId: actorId, action: 'PROFILE_DATA_ISSUE_RESOLVED', entityType: 'ProfileDataIssue', entityId: id, oldValue: { status: issue.status }, newValue: { status: body.status, resolution: body.resolution.trim() } } });
      return updated;
    });
  }
}
