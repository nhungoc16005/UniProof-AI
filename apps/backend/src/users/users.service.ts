import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { Role } from '@prisma/client';
import { WorkflowService } from '../evaluation-workflow/workflow.service';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService, private workflow: WorkflowService) {}

  private temporaryPassword() {
    return `Ep!${randomBytes(9).toString('base64url')}`;
  }

  async resetPassword(id: string, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true, email: true, fullName: true } });
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');
    const temporaryPassword = this.temporaryPassword();
    const password = await bcrypt.hash(temporaryPassword, 10);
    await this.prisma.$transaction(async tx => {
      await tx.user.update({ where: { id }, data: { password, isFirstLogin: true, authVersion: { increment: 1 } } });
      await tx.auditLog.create({ data: { userId: actorId, action: 'USER_PASSWORD_RESET', entityType: 'User', entityId: id, newValue: { email: user.email, sessionsRevoked: true, firstLoginRequired: true } } });
    });
    return { user: { id: user.id, email: user.email, fullName: user.fullName }, temporaryPassword };
  }

  async findAll(params: { role?: Role; facultyId?: string; classId?: string; termId?: string; search?: string; page?: number; pageSize?: number }, actor: { id: string; role: Role; facultyId?: string | null }) {
    const { role, facultyId, classId, termId, search } = params;
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 50));
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (actor.role === Role.STAFF) {
      if (!actor.facultyId) throw new ForbiddenException('Tài khoản cán bộ chưa được gán Khoa phụ trách');
      if (facultyId && facultyId !== actor.facultyId) throw new ForbiddenException('Không được tra cứu dữ liệu ngoài Khoa phụ trách');
      if (role && role !== Role.STUDENT) throw new ForbiddenException('Cán bộ chỉ được tra cứu danh sách sinh viên');
      where.role = Role.STUDENT;
      if (termId) where.assessmentHandoffs = { some: { termId, facultyId: actor.facultyId, ...(classId ? { classId } : {}) } };
      else where.class = { facultyId: actor.facultyId };
      if (classId && !termId) {
        const studentClass = await this.prisma.class.findFirst({ where: { id: classId, facultyId: actor.facultyId }, select: { id: true } });
        if (!studentClass) throw new ForbiddenException('Lớp không thuộc Khoa phụ trách');
        where.classId = classId;
      }
    } else if (role) {
      where.role = role;
    }

    if (actor.role !== Role.STAFF && facultyId) {
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

    if (classId && actor.role !== Role.STAFF) where.classId = classId;

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
          updatedAt: true,
          assessmentHandoffs: termId ? { where: { termId }, take: 1, select: { class: { select: { id: true, code: true, name: true, cohort: true, facultyId: true, faculty: { select: { id: true, code: true, name: true } } } } } } : false,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const scopedItems = items.map((item: any) => {
      const { assessmentHandoffs, ...user } = item;
      return { ...user, class: assessmentHandoffs?.[0]?.class || user.class };
    });
    return { items: scopedItems, total, page, pageSize };
  }

  async findOne(id: string, actor: { id: string; role: Role; facultyId?: string | null }, termId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        faculty: true,
        class: { include: { faculty: true } },
      },
    });

    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    if (actor.role === Role.STAFF) await this.workflow.scope(actor, id, termId);
    const { password, authVersion, ...safeUser } = user;
    return safeUser;
  }

  async create(dto: CreateUserDto, actorId: string) {
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

    const defaultPass = dto.password || this.temporaryPassword();
    const hashedPassword = await bcrypt.hash(defaultPass, 10);

    const user = await this.prisma.$transaction(async tx => {
    const user = await tx.user.create({
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

    await tx.auditLog.create({ data: { userId: actorId, action: 'USER_CREATED', entityType: 'User', entityId: user.id, newValue: { fullName: user.fullName, email: user.email, role: user.role, classId: user.classId, facultyId: user.facultyId } } });
    return user;
    });
    const { password, ...safeUser } = user;
    return safeUser;
  }

  async update(id: string, dto: UpdateUserDto, actor: { id: string; role: Role }) {
    if (actor.role !== Role.ADMIN) throw new ForbiddenException('Chỉ Admin được quản lý tài khoản người dùng');
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy người dùng');

    if (dto.isActive === false && id === actor.id) throw new BadRequestException('Không tự khóa tài khoản đang sử dụng');
    const updated = await this.prisma.$transaction(async tx => {
      const updated = await tx.user.update({
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

      const visible = (u: typeof existing) => ({ fullName: u.fullName, email: u.email, studentCode: u.studentCode, classId: u.classId, facultyId: u.facultyId, isActive: u.isActive });
      await tx.auditLog.create({ data: { userId: actor.id, action: 'USER_UPDATED', entityType: 'User', entityId: id, oldValue: visible(existing), newValue: visible(updated) } });
      return updated;
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

    // Accounts with decisions must retain their audit and assessment history.
    return this.prisma.user.update({ where: { id }, data: { isActive: false }, select: { id: true, fullName: true, isActive: true } });
  }

  async bulkImport(dto: { users: any[] }, actorId: string) {
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

    let importedCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];
    const seenEmails = new Set<string>();
    const seenStudentCodes = new Set<string>();
    const temporaryCredentials: Array<{ email: string; temporaryPassword: string }> = [];

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

      if (seenEmails.has(email)) { errors.push(`Dòng ${rowIdx}: Email ${email} bị lặp trong file`); continue; }
      seenEmails.add(email);
      if (studentCode && seenStudentCodes.has(studentCode)) { errors.push(`Dòng ${rowIdx}: MSSV ${studentCode} bị lặp trong file`); continue; }
      if (studentCode) seenStudentCodes.add(studentCode);

      let facultyId = row.facultyId;
      if (!facultyId && row.facultyCode) {
        facultyId = facultyMap.get(String(row.facultyCode).toLowerCase());
      }

      let classId = row.classId;
      if (!classId && row.classCode) {
        classId = classMap.get(String(row.classCode).toLowerCase());
      }

      if (row.facultyCode && !facultyId) { errors.push(`Dòng ${rowIdx}: Không tìm thấy Khoa ${row.facultyCode}`); continue; }
      if (row.classCode && !classId) { errors.push(`Dòng ${rowIdx}: Không tìm thấy Lớp ${row.classCode}`); continue; }
      if (role === Role.STUDENT && (!studentCode || !classId)) { errors.push(`Dòng ${rowIdx}: Sinh viên bắt buộc có MSSV và Lớp`); continue; }
      if (role === Role.STAFF && !facultyId) { errors.push(`Dòng ${rowIdx}: Cán bộ bắt buộc thuộc một Khoa`); continue; }
      if (classId && facultyId) {
        const cls = classes.find(item => item.id === classId);
        if (!cls || cls.facultyId !== facultyId) { errors.push(`Dòng ${rowIdx}: Lớp không thuộc Khoa đã chọn`); continue; }
      }

      try {
        await this.prisma.$transaction(async tx => {
        // Tìm xem user đã tồn tại chưa bằng email hoặc studentCode
        let existingUser = await tx.user.findUnique({ where: { email } });
        if (!existingUser && studentCode) {
          existingUser = await tx.user.findFirst({ where: { studentCode } });
        }

        if (existingUser && existingUser.role !== role) throw new BadRequestException('Vai trò import khác tài khoản hiện có');
        if (existingUser && !existingUser.isActive) throw new BadRequestException('Tài khoản đang bị khóa; cần mở khóa thủ công trước khi cập nhật');
        if (existingUser) {
          await tx.user.update({
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
          const temporaryPassword = this.temporaryPassword();
          const defaultPasswordHash = await bcrypt.hash(temporaryPassword, 10);
          await tx.user.create({
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
          temporaryCredentials.push({ email, temporaryPassword });
          importedCount++;
        }
        const saved = await tx.user.findFirst({ where: { OR: [{ email }, ...(studentCode ? [{ studentCode }] : [])] } });
        if (saved) await tx.auditLog.create({ data: { userId: actorId, action: 'USER_IMPORTED', entityType: 'User', entityId: saved.id, oldValue: existingUser ? { fullName: existingUser.fullName, classId: existingUser.classId, facultyId: existingUser.facultyId } : undefined, newValue: { email, fullName, role, classId: saved.classId, facultyId: saved.facultyId } } });
        });
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
      temporaryCredentials,
    };
  }
}
