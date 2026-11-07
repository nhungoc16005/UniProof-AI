import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Activity, ActivityParticipantStatus, ActivityType, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { WorkflowActor, WorkflowService } from '../evaluation-workflow/workflow.service';
import { CreateActivityDto, AddParticipantDto, UpdateActivityDto, BatchAttendanceDto } from './dto/activity.dto';
import { evaluateRubricCriterion } from '../criteria/rubric-scoring';

@Injectable()
export class ActivitiesService {
  constructor(private prisma: PrismaService, private workflow: WorkflowService) {}

  private async participantFilter(activity: Activity, actor: WorkflowActor, db: Prisma.TransactionClient = this.prisma) {
    if (actor.role === Role.STUDENT) return { studentId: actor.id };
    if (actor.role === Role.ADMIN) return {};
    if (!actor.facultyId || (activity.facultyId && activity.facultyId !== actor.facultyId)) throw new ForbiddenException('Hoạt động nằm ngoài Khoa phụ trách');
    const term = activity.termId ? await db.term.findUnique({ where: { id: activity.termId } }) : null;
    if (term?.workflowEnabled) {
      const assigned = await db.assessmentHandoff.findMany({ where: { termId: term.id, facultyId: actor.facultyId }, select: { studentId: true } });
      return { studentId: { in: assigned.map(row => row.studentId) } };
    }
    return { student: { class: { facultyId: actor.facultyId } } };
  }

  private validateDates(start?: string | Date | null, end?: string | Date | null) {
    if ((start && !Number.isFinite(new Date(start).getTime())) || (end && !Number.isFinite(new Date(end).getTime())) || (start && end && new Date(start) > new Date(end))) throw new BadRequestException('Ngày bắt đầu/kết thúc hoạt động không hợp lệ');
  }

  private async ensureParticipantWritable(tx: Prisma.TransactionClient, activity: Activity, studentId: string) {
    if (!activity.termId) throw new BadRequestException('Hoạt động lịch sử chỉ được tra cứu');
    const term = await tx.term.findUniqueOrThrow({ where: { id: activity.termId } });
    if (!term.workflowEnabled) return;
    const handoff = await tx.assessmentHandoff.findUnique({ where: { studentId_termId: { studentId, termId: activity.termId } }, select: { status: true } });
    if (!handoff || !['WORKING', 'RETURNED'].includes(handoff.status)) throw new BadRequestException('Kết quả sinh viên đã bàn giao hoặc không còn được Khoa chỉnh sửa');
  }

  private async recomputeActivityCriterion(tx: Prisma.TransactionClient, activity: Activity, studentId: string) {
    if (!activity.termId || !activity.criterionId) throw new BadRequestException('Hoạt động chưa gắn kỳ hoặc tiêu chí');
    const criterion = await tx.criterion.findUniqueOrThrow({ where: { id: activity.criterionId }, select: { id: true, maxScore: true, scoringConfig: true, rolesScore: true } });
    const config = criterion.scoringConfig as Record<string, any> | null;
    if (!config || !['activity_threshold', 'community_activity_tier'].includes(String(config.kind))) throw new BadRequestException('Tiêu chí chưa hỗ trợ ghi nhận điểm từ danh sách hoạt động');
    const rows = await tx.activityParticipant.findMany({
      where: { studentId, status: ActivityParticipantStatus.CONFIRMED, activity: { termId: activity.termId, criterionId: activity.criterionId } },
      select: { activityId: true, formRole: true },
    });
    const unique = [...new Map(rows.map(row => [row.activityId, row])).values()];
    const assessment = await tx.criterionAssessment.findUnique({ where: { studentId_termId_criterionId: { studentId, termId: activity.termId, criterionId: activity.criterionId } } });
    const previous = assessment?.verifiedData && typeof assessment.verifiedData === 'object' && !Array.isArray(assessment.verifiedData) ? assessment.verifiedData as Record<string, any> : {};
    const roleScores = criterion.rolesScore && typeof criterion.rolesScore === 'object' && !Array.isArray(criterion.rolesScore) ? criterion.rolesScore as Record<string, number> : {};
    const verifiedData = {
      ...previous,
      verifiedActivityCount: unique.length,
      cheerleaderActivityCount: unique.filter(row => ['CO_VU', 'CHEERLEADER'].includes(row.formRole || '')).length,
      convertedCommunityPoints: unique.reduce((sum, row) => sum + (Number(roleScores[row.formRole || '']) || 0), 0),
      activitySource: 'FACULTY_CONFIRMED_ATTENDANCE',
    };
    const evaluation = evaluateRubricCriterion(criterion.maxScore, criterion.scoringConfig, verifiedData);
    return tx.criterionAssessment.upsert({
      where: { studentId_termId_criterionId: { studentId, termId: activity.termId, criterionId: activity.criterionId } },
      create: { studentId, termId: activity.termId, criterionId: activity.criterionId, verifiedData, verificationNote: 'Dữ liệu được tổng hợp từ danh sách hoạt động do Khoa xác nhận.', suggestedScore: evaluation.suggestedScore, suggestionReason: evaluation.reason, status: evaluation.status },
      update: { verifiedData, verificationNote: 'Dữ liệu được tổng hợp từ danh sách hoạt động do Khoa xác nhận.', suggestedScore: evaluation.suggestedScore, suggestionReason: evaluation.reason, status: evaluation.status, officialScore: null, officialReason: null, finalizedAt: null, finalReviewerId: null },
    });
  }

  private mutate<T>(id: string, actor: WorkflowActor, action: string, write: (tx: Prisma.TransactionClient, activity: Activity) => Promise<T>) {
    return this.prisma.$transaction(async tx => {
      const activity = await tx.activity.findUniqueOrThrow({ where: { id } });
      if (actor.role !== Role.ADMIN && (actor.role !== Role.STAFF || !actor.facultyId || activity.facultyId !== actor.facultyId)) throw new ForbiddenException('Không có quyền sửa hoạt động này');
      if (!activity.termId) throw new BadRequestException('Hoạt động lịch sử chưa gắn kỳ chỉ được tra cứu');
      const term = await this.workflow.lock(tx, activity.termId);
      if (term.status === 'CLOSED') throw new BadRequestException('Kỳ đã chốt');
      const result = await write(tx, activity);
      await tx.auditLog.create({ data: { userId: actor.id, action, entityType: 'Activity', entityId: id, oldValue: JSON.parse(JSON.stringify(activity)), newValue: JSON.parse(JSON.stringify(result)) } });
      return result;
    }, { timeout: 20000 });
  }

  async findAll(actor: WorkflowActor, type?: ActivityType, search?: string, termId?: string) {
    if (actor.role === Role.STAFF && !actor.facultyId) throw new ForbiddenException('Chưa được phân công Khoa');
    const where: Prisma.ActivityWhereInput = {
      ...(actor.role === Role.STAFF ? { AND: [{ OR: [{ facultyId: actor.facultyId }, { facultyId: null }] }] } : {}),
      ...(termId ? { termId } : {}), ...(type ? { type } : {}),
      ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { organizer: { contains: search, mode: 'insensitive' } }] } : {}),
    };
    return this.prisma.activity.findMany({ where, include: { _count: { select: { participants: true, evidences: true } } }, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string, actor: WorkflowActor) {
    const activity = await this.prisma.activity.findUniqueOrThrow({ where: { id } });
    const filter = await this.participantFilter(activity, actor);
    const participants = await this.prisma.activityParticipant.findMany({ where: { activityId: id, ...filter }, include: { student: { select: { id: true, fullName: true, studentCode: true, class: { select: { code: true } } } } }, orderBy: { createdAt: 'desc' } });
    return { ...activity, participants };
  }

  async create(dto: CreateActivityDto, actor: WorkflowActor) {
    if (actor.role === Role.STAFF && !actor.facultyId) throw new ForbiddenException('Chưa được phân công Khoa');
    if (!dto.termId || !dto.criterionId || !dto.startDate || !dto.name.trim() || !dto.organizer.trim()) throw new BadRequestException('Cần chọn kỳ, tiêu chí, ngày diễn ra, tên hoạt động và đơn vị tổ chức');
    this.validateDates(dto.startDate, dto.endDate);
    return this.prisma.$transaction(async tx => {
      const term = await this.workflow.lock(tx, dto.termId!);
      if (term.status === 'CLOSED') throw new BadRequestException('Kỳ đã chốt');
      if (dto.criterionId && !await tx.criterion.count({ where: { id: dto.criterionId, rubricVersion: { termId: dto.termId, status: 'PUBLISHED' } } })) throw new BadRequestException('Tiêu chí không thuộc kỳ');
      const activity = await tx.activity.create({ data: { termId: dto.termId, criterionId: dto.criterionId, facultyId: actor.facultyId || null, createdById: actor.id, name: dto.name.trim(), organizer: dto.organizer.trim(), type: dto.type, startDate: dto.startDate ? new Date(dto.startDate) : undefined, endDate: dto.endDate ? new Date(dto.endDate) : undefined, location: dto.location, description: dto.description } });
      await tx.auditLog.create({ data: { userId: actor.id, action: 'ACTIVITY_CREATED', entityType: 'Activity', entityId: activity.id, newValue: JSON.parse(JSON.stringify(activity)) } });
      return activity;
    });
  }

  async update(id: string, dto: UpdateActivityDto, actor: WorkflowActor) {
    return this.mutate(id, actor, 'ACTIVITY_UPDATED', async (tx, activity) => {
      if ((dto.name !== undefined && !dto.name.trim()) || (dto.organizer !== undefined && !dto.organizer.trim())) throw new BadRequestException('Tên hoạt động và đơn vị tổ chức không được trống');
      this.validateDates(dto.startDate ?? activity.startDate, dto.endDate ?? activity.endDate);
      return tx.activity.update({ where: { id }, data: { name: dto.name?.trim(), organizer: dto.organizer?.trim(), startDate: dto.startDate ? new Date(dto.startDate) : undefined, endDate: dto.endDate ? new Date(dto.endDate) : undefined, location: dto.location, description: dto.description } });
    });
  }

  async addParticipant(activityId: string, dto: AddParticipantDto, actor: WorkflowActor) {
    return this.mutate(activityId, actor, 'ATTENDANCE_ADDED', async (tx, activity) => {
      const student = await tx.user.findUnique({ where: { studentCode: dto.studentCode.trim() } });
      if (!student || student.role !== Role.STUDENT) throw new NotFoundException('Không tìm thấy sinh viên');
      await this.workflow.scope(actor, student.id, activity.termId!, tx);
      const existing = await tx.activityParticipant.findUnique({ where: { activityId_studentId: { activityId, studentId: student.id } } });
      if (existing) throw new BadRequestException('Sinh viên đã có tên trong danh sách điểm danh');
      return tx.activityParticipant.create({ data: { activityId, studentId: student.id, formRole: dto.formRole || 'THAM_GIA_CHINH', source: 'Nhập thủ công' }, include: { student: { select: { id: true, fullName: true, studentCode: true } } } });
    });
  }

  async getParticipants(activityId: string, actor: WorkflowActor) {
    const activity = await this.prisma.activity.findUniqueOrThrow({ where: { id: activityId } });
    return this.prisma.activityParticipant.findMany({ where: { activityId, ...await this.participantFilter(activity, actor) }, include: { student: { select: { id: true, fullName: true, studentCode: true, email: true, class: { select: { code: true } } } } }, orderBy: { createdAt: 'desc' } });
  }

  async batchAddParticipants(activityId: string, dto: BatchAttendanceDto, actor: WorkflowActor) {
    return this.mutate(activityId, actor, 'ATTENDANCE_IMPORTED', async (tx, activity) => {
      const codes = [...new Set(dto.studentCodes.map(c => c.trim()).filter(Boolean))];
      if (!codes.length) throw new BadRequestException('Danh sách MSSV không được trống');
      const filter = await this.participantFilter(activity, actor, tx);
      const scope = 'studentId' in filter ? { id: filter.studentId } : 'student' in filter ? { class: filter.student!.class } : {};
      const students = await tx.user.findMany({ where: { studentCode: { in: codes }, role: Role.STUDENT, ...scope }, select: { id: true, studentCode: true } });
      const byCode = new Map(students.map(s => [s.studentCode, s]));
      const existing = new Set((await tx.activityParticipant.findMany({ where: { activityId }, select: { studentId: true } })).map(p => p.studentId));
      const addedCodes = codes.filter(c => byCode.has(c) && !existing.has(byCode.get(c)!.id));
      const alreadyInListCodes = codes.filter(c => byCode.has(c) && existing.has(byCode.get(c)!.id));
      const notFoundCodes = codes.filter(c => !byCode.has(c));
      await tx.activityParticipant.createMany({ data: addedCodes.map(c => ({ activityId, studentId: byCode.get(c)!.id, formRole: dto.formRole || 'THAM_GIA_CHINH', source: 'Import danh sách' })), skipDuplicates: true });
      return { success: true, totalInput: codes.length, addedCount: addedCodes.length, addedCodes, alreadyInListCount: alreadyInListCodes.length, alreadyInListCodes, notFoundCount: notFoundCodes.length, notFoundCodes };
    });
  }

  async deleteParticipant(activityId: string, participantId: string, actor: WorkflowActor) {
    return this.mutate(activityId, actor, 'ATTENDANCE_REMOVED', async (tx, activity) => {
      const participant = await tx.activityParticipant.findUnique({ where: { id: participantId } });
      if (!participant || participant.activityId !== activityId) throw new NotFoundException('Không tìm thấy bản ghi điểm danh');
      if (participant.status !== ActivityParticipantStatus.DRAFT) throw new BadRequestException('Danh sách đã xác nhận không thể xóa; hãy thu hồi và nhập lý do');
      await this.workflow.scope(actor, participant.studentId, activity.termId!, tx);
      await tx.activityParticipant.delete({ where: { id: participantId } });
      return { success: true, message: 'Đã xóa bản ghi điểm danh', participantId, studentId: participant.studentId };
    });
  }

  async confirmParticipants(activityId: string, participantIds: string[] | undefined, actor: WorkflowActor) {
    return this.mutate(activityId, actor, 'ATTENDANCE_CONFIRMED', async (tx, activity) => {
      if (!activity.criterionId) throw new BadRequestException('Hoạt động chưa gắn tiêu chí');
      const criterion = await tx.criterion.findFirst({ where: { id: activity.criterionId, rubricVersion: { termId: activity.termId!, status: 'PUBLISHED' } }, select: { scoringConfig: true, rolesScore: true } });
      const config = criterion?.scoringConfig as Record<string, any> | null;
      if (!config || !['activity_threshold', 'community_activity_tier'].includes(String(config.kind))) throw new BadRequestException('Tiêu chí chưa hỗ trợ tính điểm từ danh sách hoạt động');
      if (config.kind === 'community_activity_tier' && (!criterion?.rolesScore || typeof criterion.rolesScore !== 'object' || !Object.keys(criterion.rolesScore as object).length)) throw new BadRequestException('Tiêu chí cộng đồng chưa cấu hình điểm quy đổi theo vai trò; chưa thể xác nhận danh sách');
      const rows = await tx.activityParticipant.findMany({ where: { activityId, status: ActivityParticipantStatus.DRAFT, ...(participantIds?.length ? { id: { in: participantIds } } : {}) } });
      if (!rows.length) return { confirmedCount: 0, message: 'Không còn bản ghi nháp cần xác nhận' };
      for (const row of rows) { await this.workflow.scope(actor, row.studentId, activity.termId!, tx); await this.ensureParticipantWritable(tx, activity, row.studentId); }
      await tx.activityParticipant.updateMany({ where: { id: { in: rows.map(row => row.id) }, status: ActivityParticipantStatus.DRAFT }, data: { status: ActivityParticipantStatus.CONFIRMED, confirmedById: actor.id, confirmedAt: new Date(), revokedAt: null, revokeReason: null, revision: { increment: 1 } } });
      for (const studentId of [...new Set(rows.map(row => row.studentId))]) await this.recomputeActivityCriterion(tx, activity, studentId);
      return { confirmedCount: rows.length, studentIds: [...new Set(rows.map(row => row.studentId))] };
    });
  }

  async revokeParticipant(activityId: string, participantId: string, reason: string, actor: WorkflowActor) {
    return this.mutate(activityId, actor, 'ATTENDANCE_REVOKED', async (tx, activity) => {
      const participant = await tx.activityParticipant.findUnique({ where: { id: participantId } });
      if (!participant || participant.activityId !== activityId) throw new NotFoundException('Không tìm thấy bản ghi điểm danh');
      if (participant.status !== ActivityParticipantStatus.CONFIRMED) throw new BadRequestException('Chỉ có thể thu hồi bản ghi đã xác nhận');
      await this.workflow.scope(actor, participant.studentId, activity.termId!, tx);
      await this.ensureParticipantWritable(tx, activity, participant.studentId);
      await tx.activityParticipant.update({ where: { id: participantId }, data: { status: ActivityParticipantStatus.REVOKED, revokedAt: new Date(), revokeReason: reason.trim(), revision: { increment: 1 } } });
      await this.recomputeActivityCriterion(tx, activity, participant.studentId);
      return { participantId, studentId: participant.studentId, status: ActivityParticipantStatus.REVOKED };
    });
  }

  async delete(id: string, actor: WorkflowActor) {
    return this.mutate(id, actor, 'ACTIVITY_DELETED', async tx => {
      const activity = await tx.activity.findUniqueOrThrow({ where: { id }, include: { _count: { select: { participants: true, evidences: true } } } });
      if (activity._count.participants || activity._count.evidences) throw new BadRequestException('Hoạt động đã có minh chứng hoặc điểm danh; giữ lại để truy vết');
      await tx.activity.delete({ where: { id } });
      return { success: true, message: 'Đã xóa hoạt động' };
    });
  }
}
