import { Module } from '@nestjs/common';
import { ReportsModule } from '../reports/reports.module';
import { ConductScoresService } from './conduct-scores.service';
import { ConductScoresController } from './conduct-scores.controller';

@Module({
  imports: [ReportsModule],
  controllers: [ConductScoresController],
  providers: [ConductScoresService],
  exports: [ConductScoresService],
})
export class ConductScoresModule {}
