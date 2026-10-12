import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConductScoresService } from './conduct-scores.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('Conduct Scores')
@Controller('scores')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ConductScoresController {
  constructor(private scoresService: ConductScoresService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Lấy bảng điểm rèn luyện tổng hợp của Sinh viên hiện tại (Dashboard)' })
  async getDashboard(@CurrentUser('id') studentId: string, @Query('termId') termId?: string) {
    return this.scoresService.getDashboard(studentId, termId);
  }

  @Get('trace/:evidenceId')
  @ApiOperation({ summary: 'Truy vết điểm số và căn cứ phê duyệt của 1 hồ sơ minh chứng' })
  async traceEvidenceScore(@Param('evidenceId') evidenceId: string) {
    return this.scoresService.traceEvidenceScore(evidenceId);
  }

  @Get('class/:classId')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Lấy bảng điểm rèn luyện tổng hợp của tất cả sinh viên trong một Lớp (Theo kỳ)' })
  async getClassScores(@Param('classId') classId: string, @Query('termId') termId?: string) {
    return this.scoresService.getClassScores(classId, termId);
  }

  @Get(':studentId')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Tra cứu bảng điểm rèn luyện của một sinh viên (Cán bộ, Admin)' })
  async getScoreByStudent(@Param('studentId') studentId: string, @Query('termId') termId?: string) {
    return this.scoresService.getScoreByStudent(studentId, termId);
  }
}
