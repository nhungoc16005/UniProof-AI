import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsArray, IsNumber, IsObject, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Role } from '@prisma/client';
import { AssessmentsService } from './assessments.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { BatchFinalizeAssessmentsDto } from '../grounding-import/dto/grounding-import.dto';

class SelfAssessmentDto {
  @IsOptional() @IsNumber() @Min(0) score?: number | null;
  @IsOptional() @IsString() note?: string;
}

class ClassAssessmentDto {
  @IsNumber() @Min(0) score: number;
  @IsString() note: string;
}

class VerificationDto {
  @IsObject() data: Record<string, unknown>;
  @IsString() note: string;
}

class FinalAssessmentDto {
  @IsOptional() @IsNumber() @Min(0) score?: number;
  @IsOptional() @IsString() reason?: string;
}

class SelfAssessmentScoreDto {
  @IsString() criterionId: string;
  @IsOptional() @IsNumber() @Min(0) score: number | null;
}

class SelfAssessmentBatchDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => SelfAssessmentScoreDto)
  scores: SelfAssessmentScoreDto[];
}

class ReturnSelfAssessmentDto {
  @IsString() reason: string;
}

@ApiTags('Criterion Assessments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('assessments')
export class AssessmentsController {
  constructor(private readonly assessments: AssessmentsService) {}

  @Get('me')
  @Roles(Role.STUDENT)
  getMine(@CurrentUser('id') studentId: string, @Query('termId') termId: string) {
    return this.assessments.getMine(studentId, termId);
  }

  @Get('me/preflight')
  @Roles(Role.STUDENT)
  preflightMine(@CurrentUser('id') studentId: string, @Query('termId') termId: string) {
    return this.assessments.preflight(studentId, termId);
  }

  @Put('me/:criterionId')
  @Roles(Role.STUDENT)
  saveMine(
    @CurrentUser('id') studentId: string,
    @Query('termId') termId: string,
    @Param('criterionId') criterionId: string,
    @Body() body: SelfAssessmentDto,
  ) {
    return this.assessments.saveSelfAssessment(studentId, termId, criterionId, body);
  }

  @Post('me/save')
  @Roles(Role.STUDENT)
  saveMineBatch(@CurrentUser('id') studentId: string, @Query('termId') termId: string, @Body() body: SelfAssessmentBatchDto) {
    return this.assessments.saveSelfAssessmentBatch(studentId, termId, body.scores);
  }

  @Post('me/submit')
  @Roles(Role.STUDENT)
  submitMine(@CurrentUser('id') studentId: string, @Query('termId') termId: string) {
    return this.assessments.submitSelfAssessment(studentId, termId);
  }

  @Get('students/:studentId')
  @Roles(Role.STAFF, Role.ADMIN)
  getStudent(
    @CurrentUser() staff: { id: string; role: Role; facultyId?: string },
    @Param('studentId') studentId: string,
    @Query('termId') termId: string,
  ) {
    return this.assessments.getStudentAssessments(staff, studentId, termId);
  }

  @Put('students/:studentId/:termId/:criterionId/class')
  @Roles(Role.STAFF, Role.ADMIN)
  recordClass(
    @CurrentUser() staff: { id: string; role: Role; facultyId?: string },
    @Param('studentId') studentId: string,
    @Param('termId') termId: string,
    @Param('criterionId') criterionId: string,
    @Body() body: ClassAssessmentDto,
  ) {
    return this.assessments.recordClassAssessment(staff, studentId, termId, criterionId, body);
  }

  @Put('students/:studentId/:termId/:criterionId/verification')
  @Roles(Role.STAFF, Role.ADMIN)
  verify(
    @CurrentUser() staff: { id: string; role: Role; facultyId?: string },
    @Param('studentId') studentId: string,
    @Param('termId') termId: string,
    @Param('criterionId') criterionId: string,
    @Body() body: VerificationDto,
  ) {
    return this.assessments.verifyCriterion(staff, studentId, termId, criterionId, body);
  }

  @Put('students/:studentId/:termId/:criterionId/final')
  @Roles(Role.STAFF, Role.ADMIN)
  finalize(
    @CurrentUser() staff: { id: string; role: Role; facultyId?: string },
    @Param('studentId') studentId: string,
    @Param('termId') termId: string,
    @Param('criterionId') criterionId: string,
    @Body() body: FinalAssessmentDto,
  ) {
    return this.assessments.finalizeCriterion(staff, studentId, termId, criterionId, body);
  }

  @Put('students/:studentId/:termId/return')
  @Roles(Role.STAFF, Role.ADMIN)
  @ApiOperation({ summary: 'Trả phiếu lại cho sinh viên kèm lý do' })
  returnToStudent(@CurrentUser() staff: { id: string; role: Role; facultyId?: string }, @Param('studentId') studentId: string, @Param('termId') termId: string, @Body() body: ReturnSelfAssessmentDto) {
    return this.assessments.returnSelfAssessment(staff, studentId, termId, body.reason);
  }

  @Get('students/:studentId/:termId/preview-finalize')
  @Roles(Role.STAFF, Role.ADMIN)
  @ApiOperation({ summary: 'Xem trước bảng chốt 16 tiêu chí của một phiếu sinh viên' })
  previewFinalize(
    @CurrentUser() staff: { id: string; role: Role; facultyId?: string },
    @Param('studentId') studentId: string,
    @Param('termId') termId: string,
  ) {
    return this.assessments.previewFinalizeStudent(staff, studentId, termId);
  }

  @Get('student/:studentId/preview-finalize')
  @Roles(Role.STAFF, Role.ADMIN)
  @ApiOperation({ summary: 'Xem trước bảng chốt 16 tiêu chí (Route alias tương thích)' })
  previewFinalizeCompat(
    @CurrentUser() staff: { id: string; role: Role; facultyId?: string },
    @Param('studentId') studentId: string,
    @Query('termId') termId: string,
  ) {
    if (!termId) throw new BadRequestException('Mã học kỳ (termId) không được để trống');
    return this.assessments.previewFinalizeStudent(staff, studentId, termId);
  }

  @Post('students/:studentId/:termId/finalize')
  @Roles(Role.STAFF, Role.ADMIN)
  @ApiOperation({ summary: 'Chốt toàn bộ tiêu chí đủ điều kiện của một phiếu sinh viên' })
  finalizeStudent(
    @CurrentUser() staff: { id: string; role: Role; facultyId?: string },
    @Param('studentId') studentId: string,
    @Param('termId') termId: string,
  ) {
    return this.assessments.finalizeStudentAssessment(staff, studentId, termId);
  }

  @Post('student/:studentId/finalize')
  @Roles(Role.STAFF, Role.ADMIN)
  @ApiOperation({ summary: 'Chốt toàn bộ tiêu chí đủ điều kiện (Route alias tương thích)' })
  finalizeStudentCompat(
    @CurrentUser() staff: { id: string; role: Role; facultyId?: string },
    @Param('studentId') studentId: string,
    @Body('termId') bodyTermId?: string,
    @Query('termId') queryTermId?: string,
  ) {
    const termId = bodyTermId || queryTermId;
    if (!termId) throw new BadRequestException('Mã học kỳ (termId) không được để trống');
    return this.assessments.finalizeStudentAssessment(staff, studentId, termId);
  }

  @Post('batch-finalize')
  @Roles(Role.STAFF, Role.ADMIN)
  @ApiOperation({ summary: 'Chốt phiếu hàng loạt (Tối đa 100 phiếu, transaction riêng từng phiếu)' })
  batchFinalize(
    @CurrentUser() staff: { id: string; role: Role; facultyId?: string },
    @Query('termId') queryTermId: string,
    @Body() dto: BatchFinalizeAssessmentsDto,
  ) {
    const termId = queryTermId || dto.termId;
    if (!termId) throw new BadRequestException('Mã học kỳ (termId) không được để trống');
    return this.assessments.batchFinalizeAssessments(staff, termId, dto.studentIds);
  }
}
