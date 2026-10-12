import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: { role?: Role; facultyId?: string; classId?: string; search?: string; page?: number; pageSize?: number }) {
    const { role, facultyId, classId, search, page = 1, pageSize = 50 } = params;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (role) where.role = role;

    if (facultyId) {
      if (role === Role.STAFF) {
        where.facultyId = facultyId;
      } else if (role === Role.STUDENT) {
        where.class = { facultyId };
      } else {
        where.OR = [
          { facultyId },
          { class: { facultyId } },
        ];
      }
    }

    if (classId) where.classId = classId;

    if (search) {
      const searchConditions = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { studentCode: { contains: search, mode: 'insensitive' } },
      ];

      if (where.OR) {
        where.AND = [
          { OR: where.OR },
          { OR: searchConditions },
        ];
        delete where.OR;
      } else {
        where.OR = searchConditions;
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          studentCode: true,
          isActive: true,
          isFirstLogin: true,
          faculty: { select: { id: true, code: true, name: true } },
          class: {
            select: {
              id: true,
              code: true,
              name: true,
              cohort: true,
              faculty: { select: { id: true, code: true, name: true } },
            },
          },
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        faculty: true,
        class: true,
      },
    });

    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    const { password, ...safeUser } = user;
    return safeUser;
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.email.trim().toLowerCase() },
          ...(dto.studentCode ? [{ studentCode: dto.studentCode.trim() }] : []),
        ],
      },
    });

    if (existing) {
      throw new BadRequestException('Email hoặc Mã sinh viên đã tồn tại');
    }

    const defaultPass = dto.password || (dto.role === Role.STUDENT ? 'Student@123' : dto.role === Role.STAFF ? 'Officer@123' : 'Admin@123');
    const hashedPassword = await bcrypt.hash(defaultPass, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.trim().toLowerCase(),
        password: hashedPassword,
        fullName: dto.fullName.trim(),
        role: dto.role,
        studentCode: dto.studentCode ? dto.studentCode.trim() : null,
        classId: dto.classId || null,
        facultyId: dto.facultyId || null,
      },
      include: {
        faculty: true,
        class: true,
      },
    });

    const { password, ...safeUser } = user;
    return safeUser;
  }

  async update(id: string, dto: UpdateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy người dùng');

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        fullName: dto.fullName !== undefined ? dto.fullName.trim() : undefined,
        email: dto.email !== undefined ? dto.email.trim().toLowerCase() : undefined,
        studentCode: dto.studentCode !== undefined ? (dto.studentCode ? dto.studentCode.trim() : null) : undefined,
        isActive: dto.isActive !== undefined ? dto.isActive : undefined,
        classId: dto.classId !== undefined ? dto.classId : undefined,
        facultyId: dto.facultyId !== undefined ? dto.facultyId : undefined,
      },
      include: {
        faculty: true,
        class: true,
      },
    });

    const { password, ...safeUser } = updated;
    return safeUser;
  }

  async delete(id: string) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            evidences: true,
            reviews: true,
            appeals: true,
          },
        },
      },
    });

    if (!existing) throw new NotFoundException('Không tìm thấy người dùng');

    // Clean up related data safely
    await this.prisma.$transaction([
      this.prisma.conductScore.deleteMany({ where: { studentId: id } }),
      this.prisma.notification.deleteMany({ where: { userId: id } }),
      this.prisma.auditLog.deleteMany({ where: { userId: id } }),
      this.prisma.appeal.deleteMany({ where: { studentId: id } }),
      this.prisma.review.deleteMany({ where: { reviewerId: id } }),
      this.prisma.evidenceFile.deleteMany({ where: { evidence: { studentId: id } } }),
      this.prisma.evidence.deleteMany({ where: { studentId: id } }),
      this.prisma.user.delete({ where: { id } }),
    ]);

    return { success: true, message: 'Đã xóa người dùng thành công' };
  }

  async bulkImport(dto: { users: any[] }) {
    if (!dto.users || !Array.isArray(dto.users) || dto.users.length === 0) {
      throw new BadRequestException('Danh sách người dùng import không được để trống');
    }

    const faculties = await this.prisma.faculty.findMany();
    const classes = await this.prisma.class.findMany();

    const facultyMap = new Map<string, string>(); // code/name lowercase -> id
    faculties.forEach((f) => {
      facultyMap.set(f.code.toLowerCase(), f.id);
      facultyMap.set(f.name.toLowerCase(), f.id);
      facultyMap.set(f.id, f.id);
    });

    const classMap = new Map<string, string>(); // code/name lowercase -> id
    classes.forEach((c) => {
      classMap.set(c.code.toLowerCase(), c.id);
      classMap.set(c.name.toLowerCase(), c.id);
      classMap.set(c.id, c.id);
    });

    const defaultPasswordHash = await bcrypt.hash('123456', 10);
    let importedCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < dto.users.length; i++) {
      const row = dto.users[i];
      const rowIdx = i + 1;

      if (!row.fullName || !row.fullName.trim()) {
        errors.push(`Dòng ${rowIdx}: Họ tên không được để trống`);
        continue;
      }
      if (!row.email || !row.email.trim()) {
        errors.push(`Dòng ${rowIdx}: Email không được để trống`);
        continue;
      }

      const email = row.email.trim().toLowerCase();
      const fullName = row.fullName.trim();
      const studentCode = row.studentCode ? String(row.studentCode).trim() : undefined;
      const role = row.role || Role.STUDENT;

      let facultyId = row.facultyId;
      if (!facultyId && row.facultyCode) {
        facultyId = facultyMap.get(String(row.facultyCode).toLowerCase());
      }

      let classId = row.classId;
      if (!classId && row.classCode) {
        classId = classMap.get(String(row.classCode).toLowerCase());
      }

      try {
        // Tìm xem user đã tồn tại chưa bằng email hoặc studentCode
        let existingUser = await this.prisma.user.findUnique({ where: { email } });
        if (!existingUser && studentCode) {
          existingUser = await this.prisma.user.findFirst({ where: { studentCode } });
        }

        if (existingUser) {
          await this.prisma.user.update({
            where: { id: existingUser.id },
            data: {
              fullName,
              studentCode: studentCode || existingUser.studentCode,
              classId: classId || existingUser.classId,
              facultyId: facultyId || existingUser.facultyId,
            },
          });
          updatedCount++;
        } else {
          await this.prisma.user.create({
            data: {
              email,
              fullName,
              role,
              studentCode: studentCode || null,
              password: defaultPasswordHash,
              classId: classId || null,
              facultyId: facultyId || null,
            },
          });
          importedCount++;
        }
      } catch (err: any) {
        errors.push(`Dòng ${rowIdx} (${email}): ${err.message || 'Lỗi lưu dữ liệu'}`);
      }
    }

    return {
      total: dto.users.length,
      importedCount,
      updatedCount,
      errorCount: errors.length,
      errors,
    };
  }
}

