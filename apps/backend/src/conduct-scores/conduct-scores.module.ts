import { Module } from '@nestjs/common';
import { ConductScoresService } from './conduct-scores.service';
import { ConductScoresController } from './conduct-scores.controller';

@Module({
  controllers: [ConductScoresController],
  providers: [ConductScoresService],
  exports: [ConductScoresService],
})
export class ConductScoresModule {}
