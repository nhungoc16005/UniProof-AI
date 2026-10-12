import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateActivityDto, AddParticipantDto } from './dto/activity.dto';
import { ActivityType } from '@prisma/client';

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
