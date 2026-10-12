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
}
