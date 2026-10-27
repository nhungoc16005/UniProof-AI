import { Module } from '@nestjs/common';
import { EvidenceService } from './evidence.service';
import { EvidenceController } from './evidence.controller';
import { EvidenceProcessingWorker } from './evidence-processing.worker';

@Module({
  controllers: [EvidenceController],
  providers: [EvidenceService, EvidenceProcessingWorker],
  exports: [EvidenceService],
})
export class EvidenceModule {}
