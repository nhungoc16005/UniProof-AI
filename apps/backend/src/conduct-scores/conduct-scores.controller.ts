import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConductScoresService } from './conduct-scores.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkflowService } from '../evaluation-workflow/workflow.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';

@ApiTags('Conduct Scores')
@Controller('scores')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ConductScoresController {
  constructor(private scoresService: ConductScoresService, private workflow: WorkflowService, private prisma: PrismaService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Lấy bảng điểm rèn luyện tổng hợp của Sinh viên hiện tại (Dashboard)' })
  async getDashboard(@CurrentUser('id') studentId: string, @Query('termId') termId?: string) {
    return this.scoresService.getDashboard(studentId, termId);
  }

  @Get('trace/:evidenceId')
  @ApiOperation({ summary: 'Truy vết điểm số và căn cứ phê duyệt của 1 hồ sơ minh chứng' })
  async traceEvidenceScore(@Param('evidenceId') evidenceId: string, @CurrentUser() actor: any) {
    const evidence = await this.prisma.evidence.findUniqueOrThrow({ where: { id: evidenceId } });
    await this.workflow.scope(actor, evidence.studentId, evidence.termId);
    return this.scoresService.traceEvidenceScore(evidenceId);
  }

  @Get('class/:classId')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Lấy bảng điểm rèn luyện tổng hợp của tất cả sinh viên trong một Lớp (Theo kỳ)' })
  async getClassScores(@Param('classId') classId: string, @CurrentUser() actor: any, @Query('termId') termId?: string) {
    const cls = await this.prisma.class.findUniqueOrThrow({ where: { id: classId } });
    if (actor.role === Role.STAFF && (!actor.facultyId || actor.facultyId !== cls.facultyId)) throw new ForbiddenException('Lớp nằm ngoài Khoa phụ trách');
    return this.scoresService.getClassScores(classId, termId);
  }

  @Get(':studentId')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Tra cứu bảng điểm rèn luyện của một sinh viên (Cán bộ, Admin)' })
  async getScoreByStudent(@Param('studentId') studentId: string, @CurrentUser() actor: any, @Query('termId') termId?: string) {
    await this.workflow.scope(actor, studentId, termId);
    return this.scoresService.getScoreByStudent(studentId, termId);
  }
}
