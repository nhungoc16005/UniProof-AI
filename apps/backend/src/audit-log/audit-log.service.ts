import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class AuditLogService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: { userId?: string; action?: string; entityType?: string; search?: string; page?: number; pageSize?: number }) {
    const { userId, action, entityType, search } = params;
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(params.pageSize) || 50));
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;

    if (search?.trim()) where.OR = ['entityType','entityId','ipAddress','action'].map(key => ({ [key]: { contains: search.trim(), mode: 'insensitive' } })).concat([{ user: { fullName: { contains: search.trim(), mode: 'insensitive' } } } as any, { user: { email: { contains: search.trim(), mode: 'insensitive' } } } as any]);
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, fullName: true, email: true, role: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async checkHealth() {
    let dbStatus = 'UP';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'DOWN';
    }

    return {
      status: dbStatus === 'UP' ? 'healthy' : 'unhealthy',
      database: dbStatus,
      aiService: process.env.AI_PIPELINE_URL ? 'CONFIGURED_NOT_CHECKED' : 'NOT_CONFIGURED',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
