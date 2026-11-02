import { IsOptional, IsString } from 'class-validator';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkflowActor } from '../evaluation-workflow/workflow.service';
import { WorkflowQueryDto } from '../evaluation-workflow/dto/workflow-query.dto';
import { Role } from '@prisma/client';

class ReportQueryDto extends WorkflowQueryDto { @IsOptional() @IsString() termId?: string; }

@ApiTags('Reports & Statistics')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('summary')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Lấy các chỉ số KPI tổng quan (Admin, Cán bộ)' })
  async getKpiSummary(@CurrentUser() actor: WorkflowActor, @Query('termId') termId?: string) {
    return this.reportsService.getKpiSummary(actor, termId);
  }

  @Get('distribution')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Thống kê phân bổ xếp loại ĐRL theo Khoa / Kỳ' })
  async getDistribution(@CurrentUser() actor: WorkflowActor, @Query('termId') termId?: string, @Query('facultyId') facultyId?: string) {
    return this.reportsService.getDistribution(actor, termId, facultyId);
  }

  @Get('faculties')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Thống kê tiến độ đánh giá của tất cả các Khoa trong trường (Admin, Cán bộ)' })
  async getFacultyProgress(@CurrentUser() actor: WorkflowActor, @Query('termId') termId?: string) {
    return this.reportsService.getFacultyProgress(actor, termId);
  }
  @Get('results/export')
  @Roles(Role.ADMIN, Role.STAFF)
  async export(@CurrentUser() actor: WorkflowActor, @Query('termId') termId: string, @Query() query: ReportQueryDto) {
    return { success: true, data: await this.reportsService.results(actor, termId, query, true) };
  }
  @Get('results')
  @Roles(Role.ADMIN, Role.STAFF)
  async results(@CurrentUser() actor: WorkflowActor, @Query('termId') termId: string, @Query() query: ReportQueryDto) {
    return { success: true, data: await this.reportsService.results(actor, termId, query) };
  }
}
