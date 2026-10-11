import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Reports & Statistics')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('summary')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Lấy các chỉ số KPI tổng quan (Admin, Cán bộ)' })
  async getKpiSummary(@Query('termId') termId?: string) {
    return this.reportsService.getKpiSummary(termId);
  }

  @Get('distribution')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Thống kê phân bổ xếp loại ĐRL theo Khoa / Kỳ' })
  async getDistribution(@Query('termId') termId?: string, @Query('facultyId') facultyId?: string) {
    return this.reportsService.getDistribution(termId, facultyId);
  }
}
