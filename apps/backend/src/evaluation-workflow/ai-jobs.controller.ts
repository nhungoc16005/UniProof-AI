import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { WorkflowActor, WorkflowService } from './workflow.service';

class JobsQueryDto {
  @IsOptional() @IsString() termId?: string;
  @IsOptional() @IsIn(['QUEUED','PROCESSING','COMPLETED','FAILED','UNAVAILABLE','CANCELLED']) status?: string;
  @IsOptional() @IsInt() @Min(1) page: number = 1;
  @IsOptional() @IsInt() @Min(1) @Max(100) pageSize: number = 25;
}
@Controller('ai-jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AiJobsController {
  constructor(private workflow: WorkflowService) {}
  @Get()
  async list(@Query() query: JobsQueryDto) {
    return { success: true, data: await this.workflow.jobs(query) };
  }
  @Post(':id/retry')
  retry(@CurrentUser() actor: WorkflowActor, @Param('id') id: string) { return this.workflow.retryJob(actor, id); }
}
