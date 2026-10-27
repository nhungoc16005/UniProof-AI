import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from 'class-validator';
import { Role } from '@prisma/client';
import { WorkflowActor, WorkflowService } from './workflow.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
class SendDto { @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @IsString({ each: true }) studentIds: string[]; }
class ReasonDto { @IsString() reason: string; }
@Controller('evaluation-workflow')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkflowController {
  constructor(private readonly workflow: WorkflowService) {}
  @Get(':termId') @Roles(Role.STAFF, Role.ADMIN)
  list(@CurrentUser() actor: WorkflowActor, @Param('termId') termId: string, @Query('classId') classId?: string, @Query('facultyId') facultyId?: string) { return this.workflow.list(actor, termId, classId, facultyId); }
  @Get(':termId/students/:studentId/history') @Roles(Role.STAFF, Role.ADMIN)
  history(@CurrentUser() actor: WorkflowActor, @Param('termId') termId: string, @Param('studentId') studentId: string) { return this.workflow.history(actor, studentId, termId); }
  @Post(':termId/send') @Roles(Role.STAFF)
  send(@CurrentUser() actor: WorkflowActor, @Param('termId') termId: string, @Body() body: SendDto) { return this.workflow.send(actor, termId, body.studentIds); }
  @Post(':termId/students/:studentId/return') @Roles(Role.ADMIN)
  returnResult(@CurrentUser() actor: WorkflowActor, @Param('termId') termId: string, @Param('studentId') studentId: string, @Body() body: ReasonDto) { return this.workflow.returnResult(actor, studentId, termId, body.reason); }
  @Post(':termId/students/:studentId/not-submitted') @Roles(Role.STAFF)
  notSubmitted(@CurrentUser() actor: WorkflowActor, @Param('termId') termId: string, @Param('studentId') studentId: string, @Body() body: ReasonDto) { return this.workflow.recordNotSubmitted(actor, studentId, termId, body.reason); }
  @Post(':termId/publish') @Roles(Role.ADMIN)
  publish(@CurrentUser() actor: WorkflowActor, @Param('termId') termId: string) { return this.workflow.publish(actor, termId); }
  @Post(':termId/close') @Roles(Role.ADMIN)
  close(@CurrentUser() actor: WorkflowActor, @Param('termId') termId: string) { return this.workflow.close(actor, termId); }
}
