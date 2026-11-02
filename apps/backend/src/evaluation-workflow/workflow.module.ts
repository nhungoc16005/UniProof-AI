import { Global, Module } from '@nestjs/common';
import { AiJobsController } from './ai-jobs.controller';
import { WorkflowService } from './workflow.service';
import { WorkflowController } from './workflow.controller';
@Global()
@Module({ providers: [WorkflowService], controllers: [WorkflowController, AiJobsController], exports: [WorkflowService] })
export class WorkflowModule {}
