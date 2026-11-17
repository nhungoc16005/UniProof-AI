import { Module } from '@nestjs/common';
import { GroundingImportController } from './grounding-import.controller';
import { GroundingImportService } from './grounding-import.service';
import { ActivitiesModule } from '../activities/activities.module';
import { AssessmentsModule } from '../assessments/assessments.module';

@Module({
  imports: [ActivitiesModule, AssessmentsModule],
  controllers: [GroundingImportController],
  providers: [GroundingImportService],
  exports: [GroundingImportService],
})
export class GroundingImportModule {}
