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

  private async validateUserPayload(data: {
    role: Role;
    email?: string;
    fullName?: string;
    studentCode?: string | null;
    classId?: string | null;
    facultyId?: string | null;
    isActive?: boolean;
    isUpdate?: boolean;
    existingUser?: any;
  }) {
    const role = data.role;

    if (data.fullName !== undefined) {
      if (!data.fullName || !data.fullName.trim()) {
        throw new BadRequestException('Họ và tên không được để trống hoặc chỉ chứa khoảng trắng');
      }
    }

    if (data.email !== undefined) {
      if (!data.email || !data.email.trim()) {
        throw new BadRequestException('Email không được để trống hoặc chỉ chứa khoảng trắng');
      }
    }

    const isUpdate = Boolean(data.isUpdate && data.existingUser);

    // Bổ sung hoặc thay đổi định danh/đơn vị:
    const isModifyingIdentity = isUpdate && (
      data.studentCode !== undefined ||
      data.classId !== undefined ||
      data.facultyId !== undefined
    );

    // Kích hoạt tài khoản (tài khoản đang bị khóa được mở lại isActive: true):
    const isActivating = isUpdate && (
      data.isActive === true && data.existingUser?.isActive === false
    );

    // Bắt buộc kiểm tra dữ liệu đầy đủ khi:
    // - Tạo mới (!isUpdate)
    // - Bổ sung/sửa định danh (isModifyingIdentity)
    // - Kích hoạt tài khoản (isActivating)
    const requiresFullValidation = !isUpdate || isModifyingIdentity || isActivating;

    if (role === Role.STUDENT) {
      const effectiveStudentCode = data.studentCode !== undefined
        ? (data.studentCode ? String(data.studentCode).trim() : '')
        : (data.existingUser?.studentCode ? String(data.existingUser.studentCode).trim() : '');

      const effectiveClassId = data.classId !== undefined
        ? data.classId
        : (data.existingUser?.classId ?? null);

      if (requiresFullValidation) {
        if (!effectiveStudentCode) {
          throw new BadRequestException('Sinh viên bắt buộc phải có Mã sinh viên (studentCode)');
        }
        if (!effectiveClassId) {
          throw new BadRequestException('Sinh viên bắt buộc phải thuộc một Lớp (classId)');
        }
        const cls = await this.prisma.class.findUnique({ where: { id: effectiveClassId } });
        if (!cls) {
          throw new BadRequestException(`Không tìm thấy Lớp với ID: ${effectiveClassId}`);
        }

        const effectiveFacultyId = data.facultyId !== undefined
          ? data.facultyId
          : (data.existingUser?.facultyId ?? null);
        if (effectiveFacultyId && cls.facultyId !== effectiveFacultyId) {
          throw new BadRequestException('Lớp học không thuộc Khoa đã chọn');
        }
      } else {
        // Sửa thông tin không liên quan của tài khoản legacy thiếu lớp/Khoa:
        // TUYỆT ĐỐI KHÔNG truy vấn class với ID null!
        if (effectiveClassId) {
          const cls = await this.prisma.class.findUnique({ where: { id: effectiveClassId } });
          if (!cls) {
            throw new BadRequestException(`Không tìm thấy Lớp với ID: ${effectiveClassId}`);
          }
        }
      }
    } else if (role === Role.STAFF) {
      if (data.classId) {
        throw new BadRequestException('Cán bộ quản lý Khoa không được gán vào lớp sinh viên');
      }
      if (data.studentCode) {
        throw new BadRequestException('Cán bộ không có Mã sinh viên');
      }

      const effectiveFacultyId = data.facultyId !== undefined
        ? data.facultyId
        : (data.existingUser?.facultyId ?? null);

      if (requiresFullValidation) {
        if (!effectiveFacultyId) {
          throw new BadRequestException('Cán bộ bắt buộc phải thuộc một Khoa (facultyId)');
        }
        const faculty = await this.prisma.faculty.findUnique({ where: { id: effectiveFacultyId } });
        if (!faculty) {
          throw new BadRequestException(`Không tìm thấy Khoa với ID: ${effectiveFacultyId}`);
        }
      } else {
        // Sửa thông tin không liên quan của tài khoản legacy STAFF thiếu facultyId:
        // TUYỆT ĐỐI KHÔNG truy vấn faculty với ID null!
        if (effectiveFacultyId) {
          const faculty = await this.prisma.faculty.findUnique({ where: { id: effectiveFacultyId } });
          if (!faculty) {
            throw new BadRequestException(`Không tìm thấy Khoa với ID: ${effectiveFacultyId}`);
          }
        }
      }
    } else if (role === Role.ADMIN) {
      if (data.classId) {
        throw new BadRequestException('Quản trị viên hệ thống không thuộc lớp sinh viên');
      }
      if (data.facultyId) {
        throw new BadRequestException('Quản trị viên hệ thống cấp trường không thuộc một Khoa riêng');
      }
      if (data.studentCode) {
        throw new BadRequestException('Quản trị viên không có Mã sinh viên');
      }
    }
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
          classId: true,
          facultyId: true,
          faculty: { select: { id: true, code: true, name: true } },
          class: {
            select: {
              id: true,
              code: true,
              name: true,
              cohort: true,
              facultyId: true,
              faculty: { select: { id: true, code: true, name: true } },
            },
          },
          createdAt: true,
          updatedAt: true,
          assessmentHandoffs: termId ? { where: { termId }, take: 1, select: { classId: true, facultyId: true, class: { select: { id: true, code: true, name: true, cohort: true, facultyId: true, faculty: { select: { id: true, code: true, name: true } } } } } } : false,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const scopedItems = items.map((item: any) => {
      const { assessmentHandoffs, ...user } = item;
      const handoff = assessmentHandoffs?.[0];
      const snapshotClass = handoff?.class || user.class;
      return {
        ...user,
        classId: handoff?.classId || user.classId,
        class: snapshotClass,
        facultyId: user.facultyId,
      };
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
    await this.validateUserPayload(dto);
    const normalizedEmail = dto.email.trim().toLowerCase();
    const normalizedCode = dto.studentCode ? dto.studentCode.trim() : null;

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          ...(normalizedCode ? [{ studentCode: normalizedCode }] : []),
        ],
      },
    });

    if (existing) {
      throw new BadRequestException('Email hoặc Mã sinh viên đã tồn tại');
    }

    const generatedPassword = !dto.password ? this.temporaryPassword() : null;
    const passwordToHash = dto.password || generatedPassword!;
    const hashedPassword = await bcrypt.hash(passwordToHash, 10);

    const user = await this.prisma.$transaction(async tx => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          password: hashedPassword,
          fullName: dto.fullName.trim(),
          role: dto.role,
          studentCode: normalizedCode,
          classId: dto.classId || null,
          facultyId: dto.facultyId || null,
          isFirstLogin: true,
        },
        include: {
          faculty: true,
          class: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'USER_CREATED',
          entityType: 'User',
          entityId: user.id,
          newValue: {
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            classId: user.classId,
            facultyId: user.facultyId,
            hasTemporaryPassword: Boolean(generatedPassword),
          },
        },
      });
      return user;
    });

    const { password, authVersion, ...safeUser } = user;
    return {
      user: safeUser,
      temporaryPassword: generatedPassword,
    };
  }

  async update(id: string, dto: UpdateUserDto, actor: { id: string; role: Role }) {
    if (actor.role !== Role.ADMIN) throw new ForbiddenException('Chỉ Admin được quản lý tài khoản người dùng');
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy người dùng');

    if (dto.isActive === false && id === actor.id) throw new BadRequestException('Không tự khóa tài khoản đang sử dụng');

    // Không cho phép xóa trường bắt buộc của role bằng chuỗi rỗng / null
    if (existing.role === Role.STUDENT) {
      if (dto.studentCode !== undefined && !dto.studentCode?.trim()) {
        throw new BadRequestException('Không được xóa Mã sinh viên của Sinh viên');
      }
      if (dto.classId !== undefined && !dto.classId) {
        throw new BadRequestException('Không được xóa Lớp của Sinh viên');
      }
    }
    if (existing.role === Role.STAFF) {
      if (dto.facultyId !== undefined && !dto.facultyId) {
        throw new BadRequestException('Không được xóa Khoa của Cán bộ');
      }
    }

    // Kiểm tra trùng lặp email và mã sinh viên nếu có thay đổi
    if (dto.email !== undefined && dto.email.trim().toLowerCase() !== existing.email.toLowerCase()) {
      const dup = await this.prisma.user.findFirst({
        where: { email: dto.email.trim().toLowerCase(), id: { not: id } },
      });
      if (dup) throw new BadRequestException('Email đã tồn tại trong hệ thống');
    }
    if (dto.studentCode !== undefined && dto.studentCode?.trim()) {
      const normalizedCode = dto.studentCode.trim();
      if (normalizedCode !== existing.studentCode) {
        const dup = await this.prisma.user.findFirst({
          where: { studentCode: normalizedCode, id: { not: id } },
        });
        if (dup) throw new BadRequestException('Mã sinh viên đã tồn tại trong hệ thống');
      }
    }

    await this.validateUserPayload({
      ...dto,
      role: existing.role,
      isUpdate: true,
      existingUser: existing,
    });

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

    const { password, authVersion, ...safeUser } = updated;
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
      if (f.code) facultyMap.set(f.code.toLowerCase(), f.id);
      if (f.name) facultyMap.set(f.name.toLowerCase(), f.id);
      facultyMap.set(f.id, f.id);
    });

    const classMap = new Map<string, string>(); // code/name lowercase -> id
    classes.forEach((c) => {
      if (c.code) classMap.set(c.code.toLowerCase(), c.id);
      if (c.name) classMap.set(c.name.toLowerCase(), c.id);
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

      try {
        await this.validateUserPayload({
          role,
          email,
          fullName,
          studentCode,
          classId,
          facultyId,
        });
      } catch (valErr: any) {
        errors.push(`Dòng ${rowIdx} (${email}): ${valErr.message}`);
        continue;
      }

      let isImported = false;
      let isUpdated = false;
      let newCred: { email: string; temporaryPassword: string } | null = null;

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
            isUpdated = true;
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
            newCred = { email, temporaryPassword };
            isImported = true;
          }
          const saved = await tx.user.findFirst({ where: { OR: [{ email }, ...(studentCode ? [{ studentCode }] : [])] } });
          if (saved) await tx.auditLog.create({ data: { userId: actorId, action: 'USER_IMPORTED', entityType: 'User', entityId: saved.id, oldValue: existingUser ? { fullName: existingUser.fullName, classId: existingUser.classId, facultyId: existingUser.facultyId } : undefined, newValue: { email, fullName, role, classId: saved.classId, facultyId: saved.facultyId } } });
        });

        // Chỉ tăng count và lưu temporaryCredentials sau khi transaction thành công và commit
        if (isImported) {
          importedCount++;
          if (newCred) temporaryCredentials.push(newCred);
        } else if (isUpdated) {
          updatedCount++;
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
      temporaryCredentials,
    };
  }
}
