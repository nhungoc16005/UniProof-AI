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
      include: { rules: true },
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

  async deleteCriterion(id: string) {
    const crit = await this.prisma.criterion.findUnique({ where: { id } });
    if (!crit) throw new NotFoundException('Không tìm thấy tiêu chí');

    await this.prisma.$transaction([
      this.prisma.rule.deleteMany({ where: { criterionId: id } }),
      this.prisma.aiSuggestion.updateMany({ where: { criterionId: id }, data: { criterionId: null } }),
      this.prisma.review.updateMany({ where: { criterionId: id }, data: { criterionId: null } }),
      this.prisma.criterion.delete({ where: { id } }),
    ]);

    return { success: true, message: 'Đã xóa tiêu chí thành công' };
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

  async createFaculty(dto: { code: string; name: string }) {
    const existing = await this.prisma.faculty.findUnique({ where: { code: dto.code.trim().toUpperCase() } });
    if (existing) throw new BadRequestException('Mã khoa đã tồn tại');
    return this.prisma.faculty.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
      },
      include: {
        _count: { select: { classes: true, staffs: true } },
      },
    });
  }

  async updateFaculty(id: string, dto: { code?: string; name?: string }) {
    const faculty = await this.prisma.faculty.findUnique({ where: { id } });
    if (!faculty) throw new NotFoundException('Không tìm thấy khoa');
    return this.prisma.faculty.update({
      where: { id },
      data: {
        code: dto.code ? dto.code.trim().toUpperCase() : undefined,
        name: dto.name ? dto.name.trim() : undefined,
      },
      include: {
        _count: { select: { classes: true, staffs: true } },
      },
    });
  }

  async deleteFaculty(id: string) {
    const faculty = await this.prisma.faculty.findUnique({
      where: { id },
      include: {
        _count: { select: { classes: true, staffs: true } },
      },
    });
    if (!faculty) throw new NotFoundException('Không tìm thấy khoa');
    if (faculty._count.classes > 0 || faculty._count.staffs > 0) {
      throw new BadRequestException('Không thể xóa khoa đang có lớp học hoặc cán bộ phụ trách. Vui lòng chuyển các lớp và cán bộ sang khoa khác trước.');
    }
    return this.prisma.faculty.delete({ where: { id } });
  }

  async createClass(dto: { code: string; name?: string; cohort: string; facultyId: string }) {
    const existing = await this.prisma.class.findUnique({ where: { code: dto.code.trim().toUpperCase() } });
    if (existing) throw new BadRequestException('Mã lớp sinh hoạt đã tồn tại');
    const faculty = await this.prisma.faculty.findUnique({ where: { id: dto.facultyId } });
    if (!faculty) throw new NotFoundException('Khoa không tồn tại');
    return this.prisma.class.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        name: dto.name ? dto.name.trim() : dto.code.trim().toUpperCase(),
        cohort: dto.cohort.trim(),
        facultyId: dto.facultyId,
      },
      include: {
        faculty: { select: { id: true, code: true, name: true } },
        _count: { select: { students: true } },
      },
    });
  }

  async updateClass(id: string, dto: { code?: string; name?: string; cohort?: string; facultyId?: string }) {
    const cls = await this.prisma.class.findUnique({ where: { id } });
    if (!cls) throw new NotFoundException('Không tìm thấy lớp');
    return this.prisma.class.update({
      where: { id },
      data: {
        code: dto.code ? dto.code.trim().toUpperCase() : undefined,
        name: dto.name ? dto.name.trim() : undefined,
        cohort: dto.cohort ? dto.cohort.trim() : undefined,
        facultyId: dto.facultyId ? dto.facultyId : undefined,
      },
      include: {
        faculty: { select: { id: true, code: true, name: true } },
        _count: { select: { students: true } },
      },
    });
  }

  async deleteClass(id: string) {
    const cls = await this.prisma.class.findUnique({
      where: { id },
      include: {
        _count: { select: { students: true } },
      },
    });
    if (!cls) throw new NotFoundException('Không tìm thấy lớp');
    if (cls._count.students > 0) {
      throw new BadRequestException('Không thể xóa lớp sinh hoạt đang có sinh viên. Vui lòng chuyển sinh viên sang lớp khác trước.');
    }
    return this.prisma.class.delete({ where: { id } });
  }

  // ==========================================
  // REGULATION DOCUMENTS (KNOWLEDGE BASE A06)
  // ==========================================
  async getRegulations() {
    return this.prisma.regulationDocument.findMany({
      include: {
        uploadedBy: { select: { id: true, fullName: true, email: true } },
        _count: { select: { chunks: true, criteria: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRegulation(dto: { title: string; version: string; fileUrl?: string; effectiveDate?: string; uploadedById: string }) {
    return this.prisma.regulationDocument.create({
      data: {
        title: dto.title.trim(),
        version: dto.version.trim(),
        fileUrl: dto.fileUrl || '/docs/quy-che.pdf',
        effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : new Date(),
        uploadedById: dto.uploadedById,
        status: 'ACTIVE',
      },
      include: {
        uploadedBy: { select: { id: true, fullName: true, email: true } },
        _count: { select: { chunks: true, criteria: true } },
      },
    });
  }

  async deleteRegulation(id: string) {
    const doc = await this.prisma.regulationDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Không tìm thấy tài liệu quy chế');

    await this.prisma.$transaction([
      this.prisma.regulationChunk.deleteMany({ where: { regulationDocumentId: id } }),
      this.prisma.criterion.updateMany({ where: { regulationDocumentId: id }, data: { regulationDocumentId: null } }),
      this.prisma.regulationDocument.delete({ where: { id } }),
    ]);

    return { success: true, message: 'Đã xóa tài liệu quy chế thành công' };
  }
}
