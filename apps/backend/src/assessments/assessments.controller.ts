import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsArray, IsNumber, IsObject, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Role } from '@prisma/client';
import { AssessmentsService } from './assessments.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

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
  returnToStudent(@CurrentUser() staff: { id: string; role: Role; facultyId?: string }, @Param('studentId') studentId: string, @Param('termId') termId: string, @Body() body: ReturnSelfAssessmentDto) {
    return this.assessments.returnSelfAssessment(staff, studentId, termId, body.reason);
  }
}
