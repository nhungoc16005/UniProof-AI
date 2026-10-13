import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateActivityDto, AddParticipantDto } from './dto/activity.dto';
import { ActivityType, Role } from '@prisma/client';

@Injectable()
export class ActivitiesService {
  constructor(private prisma: PrismaService) {}

  async findAll(type?: ActivityType, search?: string) {
    const where: any = {};
    if (type) where.type = type;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { organizer: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.activity.findMany({
      where,
      include: {
        _count: { select: { participants: true, evidences: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
      include: {
        participants: {
          include: {
            student: {
              select: {
                id: true,
                fullName: true,
                studentCode: true,
                class: { select: { code: true } },
              },
            },
          },
        },
      },
    });

    if (!activity) throw new NotFoundException('Không tìm thấy hoạt động');
    return activity;
  }

  async create(dto: CreateActivityDto) {
    return this.prisma.activity.create({
      data: {
        name: dto.name,
        type: dto.type,
        organizer: dto.organizer,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        location: dto.location,
        description: dto.description,
      },
    });
  }

  async addParticipant(activityId: string, dto: AddParticipantDto) {
    const activity = await this.prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) throw new NotFoundException('Không tìm thấy hoạt động');

    const student = await this.prisma.user.findUnique({
      where: { studentCode: dto.studentCode.trim() },
    });
    if (!student) throw new NotFoundException(`Không tìm thấy sinh viên có MSSV: ${dto.studentCode}`);

    const existing = await this.prisma.activityParticipant.findUnique({
      where: {
        activityId_studentId: {
          activityId,
          studentId: student.id,
        },
      },
    });
    if (existing) throw new BadRequestException('Sinh viên đã có tên trong danh sách điểm danh');

    return this.prisma.activityParticipant.create({
      data: {
        activityId,
        studentId: student.id,
        formRole: dto.formRole || 'THAM_GIA_CHINH',
        source: 'Nhập thủ công',
      },
      include: {
        student: { select: { id: true, fullName: true, studentCode: true } },
      },
    });
  }

  async getParticipants(activityId: string) {
    const activity = await this.prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) throw new NotFoundException('Không tìm thấy hoạt động');

    return this.prisma.activityParticipant.findMany({
      where: { activityId },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            studentCode: true,
            email: true,
            class: { select: { code: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, dto: any) {
    const activity = await this.prisma.activity.findUnique({ where: { id } });
    if (!activity) throw new NotFoundException('Không tìm thấy hoạt động');

    return this.prisma.activity.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        organizer: dto.organizer !== undefined ? dto.organizer.trim() : undefined,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        location: dto.location !== undefined ? dto.location : undefined,
        description: dto.description !== undefined ? dto.description : undefined,
      },
    });
  }

  async batchAddParticipants(activityId: string, dto: { studentCodes: string[]; formRole?: string }) {
    const activity = await this.prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) throw new NotFoundException('Không tìm thấy hoạt động');

    const trimmedCodes = Array.from(new Set((dto.studentCodes || []).map((c) => c.trim()).filter(Boolean)));
    if (trimmedCodes.length === 0) throw new BadRequestException('Danh sách MSSV không được để trống');

    const students = await this.prisma.user.findMany({
      where: { studentCode: { in: trimmedCodes }, role: Role.STUDENT },
      select: { id: true, studentCode: true, fullName: true },
    });

    const foundStudentMap = new Map<string, typeof students[0]>();
    students.forEach((s) => {
      if (s.studentCode) foundStudentMap.set(s.studentCode, s);
    });

    const existingParticipants = await this.prisma.activityParticipant.findMany({
      where: {
        activityId,
        studentId: { in: students.map((s) => s.id) },
      },
      select: { studentId: true },
    });
    const existingStudentIdSet = new Set(existingParticipants.map((ep) => ep.studentId));

    const toCreate: { activityId: string; studentId: string; formRole: string; source: string }[] = [];
    const addedCodes: string[] = [];
    const alreadyInListCodes: string[] = [];
    const notFoundCodes: string[] = [];

    for (const code of trimmedCodes) {
      const student = foundStudentMap.get(code);
      if (!student) {
        notFoundCodes.push(code);
      } else if (existingStudentIdSet.has(student.id)) {
        alreadyInListCodes.push(code);
      } else {
        toCreate.push({
          activityId,
          studentId: student.id,
          formRole: dto.formRole || 'THAM_GIA_CHINH',
          source: 'Import danh sách',
        });
        addedCodes.push(code);
      }
    }

    if (toCreate.length > 0) {
      await this.prisma.activityParticipant.createMany({
        data: toCreate,
        skipDuplicates: true,
      });
    }

    return {
      success: true,
      totalInput: trimmedCodes.length,
      addedCount: addedCodes.length,
      addedCodes,
      alreadyInListCount: alreadyInListCodes.length,
      alreadyInListCodes,
      notFoundCount: notFoundCodes.length,
      notFoundCodes,
    };
  }

  async deleteParticipant(activityId: string, participantId: string) {
    const participant = await this.prisma.activityParticipant.findUnique({
      where: { id: participantId },
    });
    if (!participant || participant.activityId !== activityId) {
      throw new NotFoundException('Không tìm thấy sinh viên trong danh sách điểm danh của hoạt động');
    }

    await this.prisma.activityParticipant.delete({ where: { id: participantId } });
    return { success: true, message: 'Đã xóa sinh viên khỏi danh sách điểm danh' };
  }

  async delete(id: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
      include: { _count: { select: { participants: true, evidences: true } } },
    });
    if (!activity) throw new NotFoundException('Không tìm thấy hoạt động');

    // Clean up participants and unlink evidences safely
    await this.prisma.$transaction([
      this.prisma.activityParticipant.deleteMany({ where: { activityId: id } }),
      this.prisma.evidence.updateMany({ where: { activityId: id }, data: { activityId: null } }),
      this.prisma.activity.delete({ where: { id } }),
    ]);

    return { success: true, message: 'Đã xóa hoạt động thành công' };
  }
}
