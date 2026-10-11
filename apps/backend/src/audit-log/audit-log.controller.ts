import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuditLogService } from './audit-log.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Audit Logs & Health')
@Controller()
export class AuditLogController {
  constructor(private auditLogService: AuditLogService) {}

  @Get('audit-logs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy nhật ký kiểm toán hệ thống (Chỉ Admin)' })
  async findAll(
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.auditLogService.findAll({ userId, action, entityType, page: page ? Number(page) : 1, pageSize: pageSize ? Number(pageSize) : 50 });
  }

  @Get('health')
  @ApiOperation({ summary: 'Kiểm tra trạng thái hoạt động hệ thống (Health Check)' })
  async checkHealth() {
    return this.auditLogService.checkHealth();
  }
}
