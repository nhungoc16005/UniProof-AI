import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateTermDto, UpdateTermDto, CreateCriterionDto, UpdateCriterionDto } from './dto/criteria.dto';
import { TermStatus } from '@prisma/client';

@Injectable()
export class CriteriaService {
  constructor(private prisma: PrismaService) {}

  // ==========================================
  // CRITERIA
  // ==========================================
  async getCriteria() {
    return this.prisma.criterion.findMany({
      orderBy: { code: 'asc' },
    });
  }

  async createCriterion(dto: CreateCriterionDto) {
    const existing = await this.prisma.criterion.findUnique({ where: { code: dto.code } });
    if (existing) throw new BadRequestException(`Tiêu chí mã ${dto.code} đã tồn tại`);

    return this.prisma.criterion.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        maxScore: dto.maxScore,
        category: dto.category,
      },
    });
  }

  async updateCriterion(id: string, dto: UpdateCriterionDto) {
    const existing = await this.prisma.criterion.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy tiêu chí');

    return this.prisma.criterion.update({
      where: { id },
      data: dto,
    });
  }

  // ==========================================
  // TERMS
  // ==========================================
  async getTerms() {
    return this.prisma.term.findMany({
      orderBy: { startDate: 'desc' },
    });
  }

  async getActiveTerm() {
    const term = await this.prisma.term.findFirst({
      where: { status: TermStatus.ACTIVE },
      orderBy: { startDate: 'desc' },
    });
    if (!term) {
      // Fallback lấy kỳ mới nhất
      return this.prisma.term.findFirst({
        orderBy: { startDate: 'desc' },
      });
    }
    return term;
  }

  async createTerm(dto: CreateTermDto) {
    const existing = await this.prisma.term.findUnique({ where: { code: dto.code } });
    if (existing) throw new BadRequestException(`Kỳ học mã ${dto.code} đã tồn tại`);

    return this.prisma.term.create({
      data: {
        name: dto.name,
        code: dto.code,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        submissionDeadline: new Date(dto.submissionDeadline),
        reviewDeadline: new Date(dto.reviewDeadline),
        appealDeadline: new Date(dto.appealDeadline),
        status: dto.status || TermStatus.UPCOMING,
      },
    });
  }

  async updateTerm(id: string, dto: UpdateTermDto) {
    const existing = await this.prisma.term.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy kỳ học');

    return this.prisma.term.update({
      where: { id },
      data: {
        name: dto.name,
        submissionDeadline: dto.submissionDeadline ? new Date(dto.submissionDeadline) : undefined,
        reviewDeadline: dto.reviewDeadline ? new Date(dto.reviewDeadline) : undefined,
        appealDeadline: dto.appealDeadline ? new Date(dto.appealDeadline) : undefined,
        status: dto.status,
      },
    });
  }

  async closeTerm(id: string) {
    const term = await this.prisma.term.findUnique({ where: { id } });
    if (!term) throw new NotFoundException('Không tìm thấy kỳ học');

    return this.prisma.term.update({
      where: { id },
      data: { status: TermStatus.CLOSED },
    });
  }

  async reopenTerm(id: string, reason: string) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('Bắt buộc phải có lý do văn bản khi mở lại kỳ học đã chốt');
    }
    const term = await this.prisma.term.findUnique({ where: { id } });
    if (!term) throw new NotFoundException('Không tìm thấy kỳ học');

    return this.prisma.term.update({
      where: { id },
      data: { status: TermStatus.ACTIVE },
    });
  }

  // ==========================================
  // FACULTIES & CLASSES
  // ==========================================
  async getFaculties() {
    return this.prisma.faculty.findMany({
      include: {
        _count: { select: { classes: true, staffs: true } },
      },
      orderBy: { code: 'asc' },
    });
  }

  async getClasses(facultyId?: string) {
    return this.prisma.class.findMany({
      where: facultyId ? { facultyId } : undefined,
      include: {
        faculty: { select: { id: true, code: true, name: true } },
        _count: { select: { students: true } },
      },
      orderBy: { code: 'asc' },
    });
  }
}
